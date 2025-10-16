import process from "node:process";
import { knex, Knex } from "knex";
import {
  Pool as MapepirePool,
  DaemonServer,
  JDBCOptions,
  QueryResult,
  BindingValue,
} from "@ibm/mapepire-js";

import SchemaCompiler from "./schema/ibmi-compiler";
import TableCompiler from "./schema/ibmi-tablecompiler";
import ColumnCompiler from "./schema/ibmi-columncompiler";
import Transaction from "./execution/ibmi-transaction";
import QueryCompiler from "./query/ibmi-querycompiler";

interface QueryObject {
  response?: { rows: any[]; rowCount: number };
  sqlMethod: SqlMethod;
  output?: (runner: any, response: any) => any;
  pluck?: (row: any) => any;
  select?: boolean;
  method?: string;
  sql?: string;
  bindings?: any[];
  returning?: string[];
}

enum SqlMethod {
  SELECT = "select",
  PLUCK = "pluck",
  FIRST = "first",
  INSERT = "insert",
  DELETE = "del",
  DELETE_ALT = "delete",
  UPDATE = "update",
  COUNTER = "counter",
}

class DB2Client extends knex.Client {
  driverName: string;
  private _pool?: MapepirePool;

  constructor(config: Knex.Config<DB2Config>) {
    super(config);
    this.driverName = "mapepire-js";

    if (this.dialect && !this.config.client) {
      this.printWarn(
        `Using 'this.dialect' is deprecated. Use configuration option 'client' instead.`
      );
    }

    const dbClient = this.config.client || this.dialect;
    if (!dbClient) throw new Error(`knex: Required configuration option 'client' is missing.`);
    if (config.version) this.version = config.version;

    // Mantén la pool de Knex (para acquire/release externos), aunque internamente usemos Mapepire Pool.
    if (this.driverName && config.connection) {
      this.initializeDriver();
      if (!config.pool || (config.pool && config.pool.max !== 0)) {
        this.initializePool(config);
      }
    }

    this.valueForUndefined = config.useNullAsDefault ? null : this.raw("DEFAULT");
  }

  // Driver stub (Knex lo llama al inicializar). No usamos driver “nativo” aquí.
  _driver() {
    return {};
  }

  wrapIdentifierImpl(value: any) {
    // Sin comillas para evitar case-sensitive en DB2 for i
    return value;
  }

  printDebug(message: string | object) {
    if (process.env.DEBUG === "true" && this.logger?.debug) {
      this.logger.debug(
        "knex-mapepire: " + (typeof message === "string" ? message : JSON.stringify(message))
      );
    }
  }
  printError(message: string) {
    if (this.logger?.error) this.logger.error("knex-mapepire: " + message);
  }
  printWarn(message: string) {
    if (process.env.DEBUG === "true" && this.logger?.warn) {
      this.logger.warn("knex-mapepire: " + message);
    }
  }

  // ===== Conexión (Mapepire) =====
  private async ensurePool(): Promise<MapepirePool> {
    if (this._pool) return this._pool;

    const cfg = this.config.connection as DaemonServer | undefined;
    if (!cfg) {
      this.printError("There is no connection config defined");
      throw new Error("Missing connection config");
    }

    // PoolOptions (Mapepire)
    const opts: any = {
      creds: {
        host: cfg.host,
        user: cfg.user,
        password: cfg.password,
        port: cfg.port ?? 8076,
        rejectUnauthorized: cfg.rejectUnauthorized,
        ca: cfg.ca,
      },
      // JDBCOptions opcionales desde this.config.connectionOpts (si quieres)
      opts: (this.config as any).jdbcOptions as JDBCOptions | undefined,
      maxSize: (this.config as any).mapepire?.maxSize ?? 10,
      startingSize: (this.config as any).mapepire?.startingSize ?? 1,
    };

    this.printDebug({ poolOptions: { ...opts, creds: { ...opts.creds, password: "***" } } });

    this._pool = new MapepirePool(opts);
    await this._pool.init(); // crea los SQLJob iniciales
    (this as any).pool = makeFeathersPoolView(this._pool, this.config);
    return this._pool;
  }

  async acquireRawConnection() {
    this.printDebug("acquiring raw connection (returns Mapepire Pool)");
    const pool = await this.ensurePool();
    // Devolvemos el pool como “conexión” para el runner de Knex
    return pool;
  }

  async destroyRawConnection(connection: any) {
    this.printDebug("destroy connection (ending Mapepire Pool)");
    try {
      const pool: MapepirePool | undefined = connection ?? this._pool;
      pool?.end();
    } finally {
      this._pool = undefined;
      (this as any).pool = undefined;
    }
  }

  // ===== Ejecución =====
  async _query(pool: MapepirePool, obj: QueryObject & { sql: string; bindings?: BindingValue[] }) {
    const queryObject = this.normalizeQueryObject(obj) as QueryObject & {
      sql: string;
      bindings?: BindingValue[];
    };
    const method = this.determineQueryMethod(queryObject);
    queryObject.sqlMethod = method as SqlMethod;

    if (this.isSelectMethod(method)) {
      await this.executeSelectQuery(pool, queryObject);
    } else {
      await this.executeStatementQuery(pool, queryObject);
    }

    this.printDebug(queryObject);
    return queryObject;
  }

  private normalizeQueryObject(obj: any): any {
    if (!obj || typeof obj === "string") return { sql: obj };
    return obj;
  }

  private determineQueryMethod(obj: any): SqlMethod {
    const m =
      (obj.hasOwnProperty("method") && obj.method !== "raw"
        ? obj.method
        : String(obj.sql || "").trim().split(/\s+/)[0]) || "";
    return (m.toLowerCase() as SqlMethod) || SqlMethod.SELECT;
  }

  private isSelectMethod(method: string): boolean {
    return method === "select" || method === "first" || method === "pluck";
  }

  private async executeSelectQuery(
    pool: MapepirePool,
    obj: { sql: string; bindings?: BindingValue[]; response?: any }
  ): Promise<void> {
    const res: QueryResult<any> = await pool.execute(obj.sql, {
      parameters: obj.bindings ?? [],
      //isTerseResults: true,
    });
    const rows = res?.data ?? [];
    obj.response = { rows, rowCount: rows.length };
  }

  private async executeStatementQuery(pool: MapepirePool, obj: any): Promise<void> {
    try {
      const method = String(obj.method || "").toLowerCase();
      const hasReturning = Array.isArray(obj.returning) && obj.returning.length > 0;

      // INSERT/UPDATE/DELETE con RETURNING → FINAL TABLE
      if (hasReturning && (method === "insert" || method === "update" || method === "del" || method === "delete")) {
        const runSql = `SELECT * FROM FINAL TABLE (${obj.sql})`;
        const res: QueryResult<any> = await pool.execute(runSql, {
          parameters: obj.bindings ?? [],
          //isTerseResults: true,
        });
        const rows = res?.data ?? [];
        obj.response = { rows, rowCount: rows.length };
        return;
      }

      // DML sin RETURNING
      const res: QueryResult<any> = await pool.execute(obj.sql, {
        parameters: obj.bindings ?? [],
        //isTerseResults: true,
      });
      obj.response = { rows: [], rowCount: res?.update_count ?? 0 };
    } catch (err: any) {
      this.printError(typeof err === "string" ? err : JSON.stringify(err, null, 2));
      throw err;
    }
  }

  // ===== Streaming =====
  async _stream(
    _pool: MapepirePool,
    obj: { sql: string; bindings?: BindingValue[] },
    _stream: NodeJS.WritableStream
  ) {
    // Mapepire no expone createReadStream; podríamos implementar paginado manual si lo necesitas.
    throw new Error("Streaming no soportado actualmente con Mapepire. Usa paginación.");
  }

  transaction(container: any, config: any, outerTx: any): Knex.Transaction {
    // Conservamos tu Transaction (si manejas autocommit con JDBCOptions "auto commit": false)
    return new Transaction(this, container, config, outerTx);
  }

  schemaCompiler(tableBuilder: any) {
    return new SchemaCompiler(this, tableBuilder);
  }

  tableCompiler(tableBuilder: any) {
    return new TableCompiler(this, tableBuilder);
  }

  columnCompiler(tableCompiler: any, columnCompiler: any) {
    return new ColumnCompiler(this, tableCompiler, columnCompiler);
  }

  queryCompiler(builder: Knex.QueryBuilder, bindings?: any[]) {
    return new QueryCompiler(this, builder, bindings);
  }

  processResponse(obj: QueryObject | null, runner: any): any {
    if (obj === null) return null;

    const validationResult = this.validateResponse(obj);
    if (validationResult !== null) return validationResult;

    const { response } = obj;
    if (obj.output) return obj.output(runner, response);
    return this.processSqlMethod(obj);
  }

  private validateResponse(obj: QueryObject): any {
    if (!obj.response) {
      this.printDebug("response undefined " + JSON.stringify(obj));
      return undefined;
    }
    if (!obj.response.rows) {
      this.printError("rows undefined " + JSON.stringify(obj));
      return undefined;
    }
    return null;
  }

  private processSqlMethod(obj: QueryObject): any {
    const { rows, rowCount } = obj.response!;
    switch (obj.sqlMethod) {
      case SqlMethod.SELECT:
        return rows;
      case SqlMethod.PLUCK:
        return rows.map(obj.pluck!);
      case SqlMethod.FIRST:
        return rows[0];
      case SqlMethod.INSERT:
        return rows;
      case SqlMethod.DELETE:
      case SqlMethod.DELETE_ALT:
      case SqlMethod.UPDATE:
        return obj.select ? rows : rowCount;
      case SqlMethod.COUNTER:
        return rowCount;
      default:
        return rows;
    }
  }
}

// ⬇️ Añade esta función helper dentro del archivo
function makeFeathersPoolView(mp: MapepirePool, cfg: any) {
  const max = cfg?.mapepire?.maxSize ?? 10;
  const min = cfg?.mapepire?.startingSize ?? 1;

  const numUsed = () => {
    // Toma “activos” como usados (busy+ready en tu pool)
    return typeof (mp as any).getActiveJobCount === 'function'
      ? mp.getActiveJobCount()
      : 0;
  };

  const numFree = () => Math.max(0, max - numUsed());

  // No tienes cola explícita en MapepirePool → 0 por defecto
  const numPendingAcquires = () => 0;

  // Si tu pool crea jobs on-demand puedes estimar “creates” cuando hay espacio y no hay ready,
  // pero como no expones ready/waiting, lo dejamos en 0.
  const numPendingCreates = () => 0;

  return {
    // API “generic-pool v2” que algunos handlers consultan:
    getRunningCount: numUsed,
    getWaitingCount: numPendingAcquires,
    getIdleCount: numFree,
    getMaxPoolSize: () => max,
    getMinPoolSize: () => min,

    // API “tarn” que otros consultan:
    numUsed,
    numFree,
    numPendingAcquires,
    numPendingCreates,
  };
}


// ===== Tipos de configuración =====

interface DB2PoolConfig {
  min?: number;
  max?: number;
  acquireConnectionTimeout?: number;
}

// Opcional: JDBCOptions a través de config
export interface DB2Config extends Knex.Config {
  client: any;
  connection: DaemonServer;
  pool?: DB2PoolConfig;
  jdbcOptions?: JDBCOptions;            // <- si quieres pasar opciones JDBC
  mapepire?: { maxSize?: number; startingSize?: number }; // <- tuning del Pool
}

export const DB2Dialect = DB2Client;
export default DB2Client;

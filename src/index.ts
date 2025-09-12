import process from "node:process";
import { knex, Knex } from "knex";
import { pool as jt400Pool, Connection } from "node-jt400";
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
  constructor(config: Knex.Config<DB2Config>) {
    super(config);
    this.driverName = "jt400";

    if (this.dialect && !this.config.client) {
      this.printWarn(
        `Using 'this.dialect' to identify the client is deprecated and support for it will be removed in the future. Please use configuration option 'client' instead.`
      );
    }

    const dbClient = this.config.client || this.dialect;
    if (!dbClient) throw new Error(`knex: Required configuration option 'client' is missing.`);

    if (config.version) this.version = config.version;

    // Mantén la pool de Knex activa para orquestar acquire/release
    if (this.driverName && config.connection) {
      this.initializeDriver();
      if (!config.pool || (config.pool && config.pool.max !== 0)) {
        this.initializePool(config);
      }
    }

    this.valueForUndefined = config.useNullAsDefault ? null : this.raw("DEFAULT");
  }

  // Devolvemos un stub de driver con 'pool' por compatibilidad con initializeDriver()
  _driver() {
    return { pool: jt400Pool };
  }

  wrapIdentifierImpl(value: any) {
    // Sin comillas para evitar case-sensitive en DB2 for i
    return value;
  }

  printDebug(message: string | object) {
    if (process.env.DEBUG === "true" && this.logger.debug) {
      this.logger.debug(
        "knex-jt400: " + (typeof message === "string" ? message : JSON.stringify(message))
      );
    }
  }
  printError(message: string) {
    if (this.logger.error) this.logger.error("knex-jt400: " + message);
  }
  printWarn(message: string) {
    if (process.env.DEBUG === "true" && this.logger.warn) {
      this.logger.warn("knex-jt400: " + message);
    }
  }

  // ===== Conexión (JT400) =====
  async acquireRawConnection() {
    this.printDebug("acquiring raw connection");
    const cfg = this.config.connection as DB2ConnectionConfig;
    if (!cfg) {
      this.printError("There is no connection config defined");
      throw new Error("Missing connection config");
    }

    // node-jt400 usa objeto de opciones (no connectionString)
    const opts: Record<string, any> = {
      host: cfg.host,
      user: cfg.user,
      password: cfg.password,
      port: cfg.port ?? 50000,
      ...(cfg.connectionStringParams || {}), // p.ej. naming, libraries, translate, etc.
    };

    this.printDebug({ connectionOptions: { ...opts, password: "***" } });

    // Usamos SIEMPRE el pool de jt400; para “sin pool” podemos dejar min=1 desde Knex
    const conn: Connection = jt400Pool(opts);
    return conn;
  }

  async destroyRawConnection(connection: any) {
    this.printDebug("destroy connection");
    if (connection?.close) await connection.close();
  }

  // ===== Ejecución =====
  async _query(connection: Connection, obj: any) {
    const queryObject = this.normalizeQueryObject(obj);
    const method = this.determineQueryMethod(queryObject);
    queryObject.sqlMethod = method;

    if (this.isSelectMethod(method)) {
      await this.executeSelectQuery(connection, queryObject);
    } else {
      await this.executeStatementQuery(connection, queryObject);
    }

    this.printDebug(queryObject);
    return queryObject;
  }

  private normalizeQueryObject(obj: any): any {
    if (!obj || typeof obj === "string") return { sql: obj };
    return obj;
  }

  private determineQueryMethod(obj: any): string {
    return (
      (obj.hasOwnProperty("method") && obj.method !== "raw" ? obj.method : String(obj.sql || "").split(" ")[0]) as string
    ).toLowerCase();
  }

  private isSelectMethod(method: string): boolean {
    return method === "select" || method === "first" || method === "pluck";
  }

  private async executeSelectQuery(
    connection: Connection,
    obj: { sql: string; bindings: any[]; response?: unknown }
  ): Promise<void> {
    const rows = await connection.query(obj.sql, obj.bindings || []);
    obj.response = { rows: rows || [], rowCount: rows?.length ?? 0 };
  }

  private async executeStatementQuery(connection: Connection, obj: any): Promise<void> {
    try {
      const method = String(obj.method || "").toLowerCase();
      const hasReturning = Array.isArray(obj.returning) && obj.returning.length > 0;

      // INSERT ... RETURNING <id> (una sola columna)
      if (method === "insert" && hasReturning && obj.returning.length === 1) {
        const idCol = obj.returning[0];
        const id = await connection.insertAndGetId(obj.sql, obj.bindings || []);
        obj.response = { rows: [{ [idCol]: id }], rowCount: 1 };
        return;
      }

      // RETURNING múltiple → FINAL TABLE
      if (hasReturning && (method === "insert" || method === "update" || method === "del" || method === "delete")) {
        const runSql = `SELECT * FROM FINAL TABLE (${obj.sql})`;
        const rows = await connection.query(runSql, obj.bindings || []);
        obj.response = { rows, rowCount: rows?.length ?? 0 };
        return;
      }

      // DML sin RETURNING
      const count: number = await connection.update(obj.sql, obj.bindings || []);
      obj.response = { rows: [], rowCount: count ?? 0 };
    } catch (err: any) {
      this.printError(typeof err === "string" ? err : JSON.stringify(err, null, 2));
      throw err;
    }
  }

  // ===== Streaming =====
  async _stream(
    connection: Connection,
    obj: { sql: string; bindings: any[] },
    stream: NodeJS.WritableStream,
    _options: { fetchSize?: number }
  ) {
    if (!obj.sql) throw new Error("A query is required to stream results");

    // node-jt400: createReadStream(sql, params)
    return new Promise<void>((resolve, reject) => {
      stream.once("error", reject);
      stream.once("finish", resolve);

      try {
        const rs = connection.createReadStream(obj.sql, obj.bindings || []);
        rs.once("error", (err) => {
          stream.emit("error", err);
          reject(err);
        });
        rs.pipe(stream);
      } catch (e) {
        reject(e);
      }
    });
  }

  transaction(container: any, config: any, outerTx: any): Knex.Transaction {
    // Conserva tu Transaction; si luego quieres integrar pool.transaction(cb), lo vemos.
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

// ===== Tipos de configuración =====

interface DB2PoolConfig {
  min?: number;
  max?: number;
  acquireConnectionTimeout?: number;
}

// Parámetros JDBC/driver que quieras pasar tal cual a jt400
interface DB2ConnectionParams {
  [k: string]: any;
}

interface DB2ConnectionConfig {
  host: string;
  port?: number; // por defecto 50000
  user: string;
  password: string;
  // 'driver' ya no aplica en jt400; lo dejamos opcional por compatibilidad
  driver?: string;
  connectionStringParams?: DB2ConnectionParams;
}

export interface DB2Config extends Knex.Config {
  client: any;
  connection: DB2ConnectionConfig;
  pool?: DB2PoolConfig;
}

export const DB2Dialect = DB2Client;
export default DB2Client;
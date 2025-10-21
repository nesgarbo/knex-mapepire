var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// node_modules/lodash/isObject.js
var require_isObject = __commonJS({
  "node_modules/lodash/isObject.js"(exports2, module2) {
    function isObject2(value) {
      var type = typeof value;
      return value != null && (type == "object" || type == "function");
    }
    module2.exports = isObject2;
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  DB2Dialect: () => DB2Dialect,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_node_process = __toESM(require("process"));
var import_knex = require("knex");
var import_mapepire_js = require("@ibm/mapepire-js");

// src/schema/ibmi-compiler.ts
var import_compiler = __toESM(require("knex/lib/schema/compiler"));
var IBMiSchemaCompiler = class extends import_compiler.default {
  hasTable(tableName) {
    const formattedTable = this.client.parameter(
      prefixedTableName(this.schema, tableName),
      this.builder,
      this.bindingsHolder
    );
    const bindings = [tableName];
    let sql = `select TABLE_NAME from QSYS2.SYSTABLES where TYPE = 'T' and TABLE_NAME = ${formattedTable}`;
    if (this.schema) {
      sql += " and TABLE_SCHEMA = ?";
      bindings.push(this.schema);
    }
    this.pushQuery({
      sql,
      bindings,
      output: (resp) => {
        return resp.rowCount > 0;
      }
    });
  }
  toSQL() {
    const sequence = this.builder._sequence;
    for (let i = 0, l = sequence.length; i < l; i++) {
      const query = sequence[i];
      this[query.method].apply(this, query.args);
    }
    return this.sequence;
  }
};
function prefixedTableName(prefix, table) {
  return prefix ? `${prefix}.${table}` : table;
}
var ibmi_compiler_default = IBMiSchemaCompiler;

// src/schema/ibmi-tablecompiler.ts
var import_tablecompiler = __toESM(require("knex/lib/schema/tablecompiler"));
var import_isObject = __toESM(require_isObject());
var IBMiTableCompiler = class extends import_tablecompiler.default {
  createQuery(columns, ifNot, like) {
    let createStatement = ifNot ? `if object_id('${this.tableName()}', 'U') is null ` : "";
    if (like) {
      createStatement += `select * into ${this.tableName()} from ${this.tableNameLike()} WHERE 0=1`;
    } else {
      createStatement += "create table " + this.tableName() + (this._formatting ? " (\n    " : " (") + columns.sql.join(this._formatting ? ",\n    " : ", ") + this._addChecks() + ")";
    }
    this.pushQuery(createStatement);
    if (this.single.comment) {
      this.comment(this.single.comment);
    }
    if (like) {
      this.addColumns(columns, this.addColumnsPrefix);
    }
  }
  dropUnique(columns, indexName) {
    indexName = indexName ? this.formatter.wrap(indexName) : this._indexCommand("unique", this.tableNameRaw, columns);
    this.pushQuery(`drop index ${indexName}`);
  }
  unique(columns, indexName) {
    let deferrable = "";
    let predicate;
    if ((0, import_isObject.default)(indexName)) {
      deferrable = indexName.deferrable;
      predicate = indexName.predicate;
      indexName = indexName.indexName;
    }
    if (deferrable && deferrable !== "not deferrable") {
      this.client.logger.warn?.(
        `IBMi: unique index \`${indexName}\` no ser\xE1 deferrable (${deferrable}).`
      );
    }
    indexName = indexName ? this.formatter.wrap(indexName) : this._indexCommand("unique", this.tableNameRaw, columns);
    columns = this.formatter.columnize(columns);
    const predicateQuery = predicate ? " " + this.client.queryCompiler(predicate).where() : "";
    this.pushQuery(
      `create unique index ${indexName} on ${this.tableName()} (${columns})${predicateQuery}`
    );
  }
  // Añadir columnas
  addColumns(columns, prefix) {
    prefix = prefix || this.addColumnsPrefix;
    if (columns.sql.length > 0) {
      const columnSql = columns.sql.map((column) => prefix + column);
      this.pushQuery({
        sql: (this.lowerCase ? "alter table " : "ALTER TABLE ") + this.tableName() + " " + columnSql.join(" "),
        bindings: columns.bindings
      });
    }
  }
  // Commit usando Mapepire Pool (el "connection" que recibe Knex en tu client es el Pool)
  async commit(connection) {
    try {
      if (connection && typeof connection.execute === "function") {
        await connection.execute("COMMIT", { parameters: [] });
      } else if (connection && typeof connection.execute === "function") {
        await connection.execute("COMMIT", { parameters: [] });
      }
    } catch {
    }
  }
};
var ibmi_tablecompiler_default = IBMiTableCompiler;

// src/schema/ibmi-columncompiler.ts
var import_columncompiler = __toESM(require("knex/lib/schema/columncompiler"));
var IBMiColumnCompiler = class extends import_columncompiler.default {
  increments(options = { primaryKey: true }) {
    return "int not null generated always as identity (start with 1, increment by 1)" + (this.tableCompiler._canBeAddPrimaryKey(options) ? " primary key" : "");
  }
};
var ibmi_columncompiler_default = IBMiColumnCompiler;

// src/execution/ibmi-transaction.ts
var import_transaction = __toESM(require("knex/lib/execution/transaction"));
var IBMiTransaction = class extends import_transaction.default {
  begin(connection) {
    return connection.beginTransaction();
  }
  rollback(connection) {
    return connection.rollback();
  }
  commit(connection) {
    return connection.commit();
  }
};
var ibmi_transaction_default = IBMiTransaction;

// src/query/ibmi-querycompiler.ts
var import_querycompiler = __toESM(require("knex/lib/query/querycompiler"));
var import_wrappingFormatter = require("knex/lib/formatter/wrappingFormatter");
var import_date_fns = require("date-fns");
var IBMiQueryCompiler = class extends import_querycompiler.default {
  insert() {
    const insertValues = this.single.insert || [];
    let sql = `select ${this.single.returning ? this.formatter.columnize(this.single.returning) : "IDENTITY_VAL_LOCAL()"} from FINAL TABLE(`;
    sql += this.with() + `insert into ${this.tableName} `;
    const { returning } = this.single;
    const returningSql = returning ? this._returning("insert", returning, void 0) + " " : "";
    if (Array.isArray(insertValues)) {
      if (insertValues.length === 0) {
        return "";
      }
    } else if (typeof insertValues === "object" && Object.keys(insertValues).length === 0) {
      return {
        sql: sql + returningSql + this._emptyInsertValue,
        returning
      };
    }
    sql += this._buildInsertData(insertValues, returningSql);
    sql += ")";
    return {
      sql,
      returning
    };
  }
  _buildInsertData(insertValues, returningSql) {
    let sql = "";
    const insertData = this._prepInsert(insertValues);
    if (insertData.columns.length) {
      sql += `(${this.formatter.columnize(insertData.columns)}`;
      sql += `) ${returningSql}values (` + this._buildInsertValues(insertData) + ")";
    } else if (insertValues.length === 1 && insertValues[0]) {
      sql += returningSql + this._emptyInsertValue;
    } else {
      return "";
    }
    return sql;
  }
  _prepInsert(data) {
    if (typeof data === "object" && data.migration_time) {
      const parsed = new Date(data.migration_time);
      data.migration_time = (0, import_date_fns.format)(parsed, "yyyy-MM-dd HH:mm:ss");
    }
    const isRaw = (0, import_wrappingFormatter.rawOrFn)(
      data,
      void 0,
      this.builder,
      this.client,
      this.bindingsHolder
    );
    if (isRaw) {
      return isRaw;
    }
    let columns = [];
    const values = [];
    if (!Array.isArray(data)) {
      data = data ? [data] : [];
    }
    let i = -1;
    while (++i < data.length) {
      if (data[i] == null) {
        break;
      }
      if (i === 0) {
        columns = Object.keys(data[i]).sort();
      }
      const row = new Array(columns.length);
      const keys = Object.keys(data[i]);
      let j = -1;
      while (++j < keys.length) {
        const key = keys[j];
        let idx = columns.indexOf(key);
        if (idx === -1) {
          columns = columns.concat(key).sort();
          idx = columns.indexOf(key);
          let k = -1;
          while (++k < values.length) {
            values[k].splice(idx, 0, void 0);
          }
          row.splice(idx, 0, void 0);
        }
        row[idx] = data[i][key];
      }
      values.push(row);
    }
    return {
      columns,
      values
    };
  }
  update() {
    const withSQL = this.with();
    const updates = this._prepUpdate(this.single.update);
    const where = this.where();
    const order = this.order();
    const limit = this.limit();
    const { returning } = this.single;
    let sql = "";
    if (returning) {
      console.error("IBMi DB2 does not support returning in update statements, only inserts");
      sql += `select ${this.formatter.columnize(this.single.returning)} from FINAL TABLE(`;
    }
    sql += withSQL + `update ${this.single.only ? "only " : ""}${this.tableName} set ` + updates.join(", ") + (where ? ` ${where}` : "") + (order ? ` ${order}` : "") + (limit ? ` ${limit}` : "");
    if (returning) {
      sql += `)`;
    }
    return { sql, returning };
  }
  _returning(method, value, withTrigger) {
    switch (method) {
      case "update":
      case "insert":
        return value ? `${withTrigger ? " into #out" : ""}` : "";
      case "del":
        return value ? `${withTrigger ? " into #out" : ""}` : "";
      case "rowcount":
        return value ? "select @@rowcount" : "";
    }
  }
  columnizeWithPrefix(prefix, target) {
    const columns = typeof target === "string" ? [target] : target;
    let str = "";
    let i = -1;
    while (++i < columns.length) {
      if (i > 0) str += ", ";
      str += prefix + this.wrap(columns[i]);
    }
    return str;
  }
};
var ibmi_querycompiler_default = IBMiQueryCompiler;

// src/index.ts
var DB2Client = class extends import_knex.knex.Client {
  constructor(config) {
    super(config);
    __publicField(this, "driverName");
    __publicField(this, "_pool");
    this.driverName = "mapepire-js";
    if (this.dialect && !this.config.client) {
      this.printWarn(
        `Using 'this.dialect' is deprecated. Use configuration option 'client' instead.`
      );
    }
    const dbClient = this.config.client || this.dialect;
    if (!dbClient)
      throw new Error(
        `knex: Required configuration option 'client' is missing.`
      );
    if (config.version) this.version = config.version;
    if (this.driverName && config.connection) {
      this.initializeDriver();
      if (!config.pool || config.pool && config.pool.max !== 0) {
        this.initializePool(config);
      }
    }
    this.valueForUndefined = config.useNullAsDefault ? null : this.raw("DEFAULT");
  }
  // Driver stub (Knex lo llama al inicializar). No usamos driver “nativo” aquí.
  _driver() {
    return {};
  }
  wrapIdentifierImpl(value) {
    return value;
  }
  printDebug(message) {
    if (import_node_process.default.env.DEBUG === "true" && this.logger?.debug) {
      this.logger.debug(
        "knex-mapepire: " + (typeof message === "string" ? message : JSON.stringify(message))
      );
    }
  }
  printError(message) {
    if (this.logger?.error) this.logger.error("knex-mapepire: " + message);
  }
  printWarn(message) {
    if (import_node_process.default.env.DEBUG === "true" && this.logger?.warn) {
      this.logger.warn("knex-mapepire: " + message);
    }
  }
  // ===== Conexión (Mapepire) =====
  async ensurePool() {
    if (this._pool) return this._pool;
    const cfg = this.config.connection;
    if (!cfg) {
      this.printError("There is no connection config defined");
      throw new Error("Missing connection config");
    }
    const opts = {
      creds: {
        host: cfg.host,
        user: cfg.user,
        password: cfg.password,
        port: cfg.port ?? 8076,
        rejectUnauthorized: cfg.rejectUnauthorized,
        ca: cfg.ca
      },
      // JDBCOptions opcionales desde this.config.connectionOpts (si quieres)
      opts: this.config.jdbcOptions,
      maxSize: this.config.mapepire?.maxSize ?? 10,
      startingSize: this.config.mapepire?.startingSize ?? 1
    };
    this.printDebug({
      poolOptions: { ...opts, creds: { ...opts.creds, password: "***" } }
    });
    this._pool = new import_mapepire_js.Pool(opts);
    await this._pool.init();
    this.pool = makeFeathersPoolView(this._pool, this.config);
    return this._pool;
  }
  async acquireRawConnection() {
    this.printDebug("acquiring raw connection (returns Mapepire Pool)");
    const pool = await this.ensurePool();
    return pool;
  }
  async destroyRawConnection(connection) {
    this.printDebug("destroy connection (ending Mapepire Pool)");
    try {
      const pool = connection ?? this._pool;
      pool?.end();
    } finally {
      this._pool = void 0;
      this.pool = void 0;
    }
  }
  // ===== Ejecución =====
  async _query(pool, obj) {
    const queryObject = this.normalizeQueryObject(obj);
    const method = this.determineQueryMethod(queryObject);
    queryObject.sqlMethod = method;
    if (this.isSelectMethod(method)) {
      await this.executeSelectQuery(pool, queryObject);
    } else {
      await this.executeStatementQuery(pool, queryObject);
    }
    this.printDebug(queryObject);
    return queryObject;
  }
  normalizeQueryObject(obj) {
    if (!obj || typeof obj === "string") return { sql: obj };
    return obj;
  }
  determineQueryMethod(obj) {
    const m = (obj.hasOwnProperty("method") && obj.method !== "raw" ? obj.method : String(obj.sql || "").trim().split(/\s+/)[0]) || "";
    return m.toLowerCase() || "select" /* SELECT */;
  }
  isSelectMethod(method) {
    return method === "select" || method === "first" || method === "pluck";
  }
  async executeSelectQuery(pool, obj) {
    const res = await pool.execute(obj.sql, {
      parameters: obj.bindings ?? []
      //isTerseResults: true,
    });
    const rows = res?.data ?? [];
    obj.response = { rows, rowCount: rows.length };
  }
  async executeStatementQuery(pool, obj) {
    try {
      const method = String(obj.method || "").toLowerCase();
      const hasReturning = Array.isArray(obj.returning) && obj.returning.length > 0;
      if (hasReturning && (method === "insert" || method === "update" || method === "del" || method === "delete")) {
        const runSql = `SELECT * FROM FINAL TABLE (${obj.sql})`;
        const res2 = await pool.execute(runSql, {
          parameters: obj.bindings ?? []
          //isTerseResults: true,
        });
        const rows = res2?.data ?? [];
        obj.response = { rows, rowCount: rows.length };
        return;
      }
      const res = await pool.execute(obj.sql, {
        parameters: obj.bindings ?? []
        //isTerseResults: true,
      });
      obj.response = { rows: [], rowCount: res?.update_count ?? 0 };
    } catch (err) {
      this.printError(
        typeof err === "string" ? err : JSON.stringify(err, null, 2)
      );
      throw err;
    }
  }
  // ===== Streaming =====
  async _stream(_pool, obj, _stream) {
    throw new Error(
      "Streaming no soportado actualmente con Mapepire. Usa paginaci\xF3n."
    );
  }
  transaction(container, config, outerTx) {
    return new ibmi_transaction_default(this, container, config, outerTx);
  }
  schemaCompiler(tableBuilder) {
    return new ibmi_compiler_default(this, tableBuilder);
  }
  tableCompiler(tableBuilder) {
    return new ibmi_tablecompiler_default(this, tableBuilder);
  }
  columnCompiler(tableCompiler, columnCompiler) {
    return new ibmi_columncompiler_default(this, tableCompiler, columnCompiler);
  }
  queryCompiler(builder, bindings) {
    return new ibmi_querycompiler_default(this, builder, bindings);
  }
  processResponse(obj, runner) {
    if (obj === null) return null;
    const validationResult = this.validateResponse(obj);
    if (validationResult !== null) return validationResult;
    const { response } = obj;
    if (obj.output) return obj.output(runner, response);
    return this.processSqlMethod(obj);
  }
  validateResponse(obj) {
    if (!obj.response) {
      this.printDebug("response undefined " + JSON.stringify(obj));
      return void 0;
    }
    if (!obj.response.rows) {
      this.printError("rows undefined " + JSON.stringify(obj));
      return void 0;
    }
    return null;
  }
  processSqlMethod(obj) {
    const { rows, rowCount } = obj.response;
    switch (obj.sqlMethod) {
      case "select" /* SELECT */:
        return rows;
      case "pluck" /* PLUCK */:
        return rows.map(obj.pluck);
      case "first" /* FIRST */:
        return rows[0];
      case "insert" /* INSERT */:
        return rows;
      case "del" /* DELETE */:
      case "delete" /* DELETE_ALT */:
      case "update" /* UPDATE */:
        return obj.select ? rows : rowCount;
      case "counter" /* COUNTER */:
        return rowCount;
      default:
        return rows;
    }
  }
};
function makeFeathersPoolView(mp, cfg) {
  const max = cfg?.mapepire?.maxSize ?? 10;
  const min = cfg?.mapepire?.startingSize ?? 1;
  const numUsed = () => typeof mp.getActiveJobCount === "function" ? mp.getActiveJobCount() : 0;
  const numFree = () => Math.max(0, max - numUsed());
  const numPendingAcquires = () => 0;
  const numPendingCreates = () => 0;
  const createAcquireReturn = () => {
    const promise = Promise.resolve(mp);
    const thenable = {
      promise,
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally?.bind(promise)
    };
    return thenable;
  };
  return {
    // Lecturas de estado (compat gen-pool/tarn):
    getRunningCount: numUsed,
    getWaitingCount: numPendingAcquires,
    getIdleCount: numFree,
    getMaxPoolSize: () => max,
    getMinPoolSize: () => min,
    numUsed,
    numFree,
    numPendingAcquires,
    numPendingCreates,
    // 🔑 Compat:
    acquire() {
      return createAcquireReturn();
    },
    release(_conn) {
      return;
    },
    destroy(_conn) {
      mp.end();
    }
  };
}
var DB2Dialect = DB2Client;
var index_default = DB2Client;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DB2Dialect
});

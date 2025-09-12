import { knex, Knex } from 'knex';
import { Connection, pool } from 'node-jt400';
import SchemaCompiler from 'knex/lib/schema/compiler';
import TableCompiler from 'knex/lib/schema/tablecompiler';
import ColumnCompiler from 'knex/lib/schema/columncompiler';
import QueryCompiler from 'knex/lib/query/querycompiler';

declare class IBMiSchemaCompiler extends SchemaCompiler {
    hasTable(tableName: any): void;
    toSQL(): any[];
}

declare class IBMiTableCompiler extends TableCompiler {
    createQuery(columns: {
        sql: any[];
    }, ifNot: any, like: any): void;
    dropUnique(columns: string[], indexName: any): void;
    unique(columns: string[], indexName: {
        indexName: any;
        deferrable: any;
        predicate: any;
    }): void;
    addColumns(columns: any, prefix: any): void;
    commit(connection: Connection): Promise<void>;
}

declare class IBMiColumnCompiler extends ColumnCompiler {
    increments(options?: {
        primaryKey: boolean;
    }): string;
}

declare class IBMiQueryCompiler extends QueryCompiler {
    insert(): "" | {
        sql: string;
        returning: any;
    };
    _buildInsertData(insertValues: string | any[], returningSql: string): string;
    _prepInsert(data: any): {
        columns: any;
        values: any;
    };
    update(): {
        sql: string;
        returning: any;
    };
    _returning(method: string, value: any, withTrigger: undefined): string | undefined;
    columnizeWithPrefix(prefix: string, target: any): string;
}

interface QueryObject {
    response?: {
        rows: any[];
        rowCount: number;
    };
    sqlMethod: SqlMethod;
    output?: (runner: any, response: any) => any;
    pluck?: (row: any) => any;
    select?: boolean;
}
declare enum SqlMethod {
    SELECT = "select",
    PLUCK = "pluck",
    FIRST = "first",
    INSERT = "insert",
    DELETE = "del",
    DELETE_ALT = "delete",
    UPDATE = "update",
    COUNTER = "counter"
}
declare class DB2Client extends knex.Client {
    constructor(config: Knex.Config<DB2Config>);
    _driver(): {
        pool: typeof pool;
    };
    wrapIdentifierImpl(value: any): any;
    printDebug(message: string | object): void;
    printError(message: string): void;
    printWarn(message: string): void;
    acquireRawConnection(): Promise<Connection>;
    destroyRawConnection(connection: any): Promise<void>;
    _query(connection: Connection, obj: any): Promise<any>;
    private normalizeQueryObject;
    private determineQueryMethod;
    private isSelectMethod;
    private executeSelectQuery;
    private executeStatementQuery;
    _stream(connection: Connection, obj: {
        sql: string;
        bindings: any[];
    }, stream: NodeJS.WritableStream, _options: {
        fetchSize?: number;
    }): Promise<void>;
    transaction(container: any, config: any, outerTx: any): Knex.Transaction;
    schemaCompiler(tableBuilder: any): IBMiSchemaCompiler;
    tableCompiler(tableBuilder: any): IBMiTableCompiler;
    columnCompiler(tableCompiler: any, columnCompiler: any): IBMiColumnCompiler;
    queryCompiler(builder: Knex.QueryBuilder, bindings?: any[]): IBMiQueryCompiler;
    processResponse(obj: QueryObject | null, runner: any): any;
    private validateResponse;
    private processSqlMethod;
}
interface DB2PoolConfig {
    min?: number;
    max?: number;
    acquireConnectionTimeout?: number;
}
interface DB2ConnectionParams {
    [k: string]: any;
}
interface DB2ConnectionConfig {
    host: string;
    port?: number;
    user: string;
    password: string;
    driver?: string;
    connectionStringParams?: DB2ConnectionParams;
}
interface DB2Config extends Knex.Config {
    client: any;
    connection: DB2ConnectionConfig;
    pool?: DB2PoolConfig;
}
declare const DB2Dialect: typeof DB2Client;

export { type DB2Config, DB2Dialect, DB2Client as default };

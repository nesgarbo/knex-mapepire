import { knex, Knex } from 'knex';
import { Pool, DaemonServer, JDBCOptions, BindingValue } from '@ibm/mapepire-js';
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
    commit(connection: Pool | {
        execute?: Function;
    }): Promise<void>;
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
    method?: string;
    sql?: string;
    bindings?: any[];
    returning?: string[];
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
    driverName: string;
    private _pool?;
    constructor(config: Knex.Config<DB2Config>);
    _driver(): {};
    wrapIdentifierImpl(value: any): any;
    printDebug(message: string | object): void;
    printError(message: string): void;
    printWarn(message: string): void;
    private ensurePool;
    acquireRawConnection(): Promise<Pool>;
    destroyRawConnection(connection: any): Promise<void>;
    _query(pool: Pool, obj: QueryObject & {
        sql: string;
        bindings?: BindingValue[];
    }): Promise<QueryObject & {
        sql: string;
        bindings?: BindingValue[];
    }>;
    private normalizeQueryObject;
    private determineQueryMethod;
    private isSelectMethod;
    private executeSelectQuery;
    private executeStatementQuery;
    _stream(_pool: Pool, obj: {
        sql: string;
        bindings?: BindingValue[];
    }, _stream: NodeJS.WritableStream): Promise<void>;
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
interface DB2Config extends Knex.Config {
    client: any;
    connection: DaemonServer;
    pool?: DB2PoolConfig;
    jdbcOptions?: JDBCOptions;
    mapepire?: {
        maxSize?: number;
        startingSize?: number;
    };
}
declare const DB2Dialect: typeof DB2Client;

export { type DB2Config, DB2Dialect, DB2Client as default };

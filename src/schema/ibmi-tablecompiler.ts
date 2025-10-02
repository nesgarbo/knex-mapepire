import TableCompiler from "knex/lib/schema/tablecompiler";
import isObject from "lodash/isObject";
import { Pool as MapepirePool } from "@ibm/mapepire-js";

class IBMiTableCompiler extends TableCompiler {
  createQuery(columns: { sql: any[] }, ifNot: any, like: any) {
    let createStatement = ifNot
      ? `if object_id('${this.tableName()}', 'U') is null `
      : "";

    if (like) {
      // Copia solo columnas (no índices/keys).
      createStatement += `select * into ${this.tableName()} from ${this.tableNameLike()} WHERE 0=1`;
    } else {
      createStatement +=
        "create table " +
        this.tableName() +
        (this._formatting ? " (\n    " : " (") +
        columns.sql.join(this._formatting ? ",\n    " : ", ") +
        this._addChecks() +
        ")";
    }

    this.pushQuery(createStatement);

    if (this.single.comment) {
      this.comment(this.single.comment);
    }

    if (like) {
      this.addColumns(columns, this.addColumnsPrefix);
    }
  }

  dropUnique(columns: string[], indexName: any) {
    indexName = indexName
      ? this.formatter.wrap(indexName)
      : this._indexCommand("unique", this.tableNameRaw, columns);

    this.pushQuery(`drop index ${indexName}`);
  }

  unique(
    columns: string[],
    indexName: { indexName: any; deferrable: any; predicate: any },
  ) {
    let deferrable: string = "";
    let predicate: any;

    if (isObject(indexName)) {
      deferrable = indexName.deferrable;
      predicate = indexName.predicate;
      indexName = indexName.indexName;
    }

    if (deferrable && deferrable !== "not deferrable") {
      this.client.logger.warn?.(
        `IBMi: unique index \`${indexName}\` no será deferrable (${deferrable}).`,
      );
    }

    indexName = indexName
      ? this.formatter.wrap(indexName)
      : this._indexCommand("unique", this.tableNameRaw, columns);
    columns = this.formatter.columnize(columns);

    const predicateQuery = predicate
      ? " " + this.client.queryCompiler(predicate).where()
      : "";

    this.pushQuery(
      `create unique index ${indexName} on ${this.tableName()} (${columns})${predicateQuery}`,
    );
  }

  // Añadir columnas
  addColumns(columns: any, prefix: any) {
    prefix = prefix || this.addColumnsPrefix;

    if (columns.sql.length > 0) {
      const columnSql = columns.sql.map((column) => prefix + column);
      this.pushQuery({
        sql:
          (this.lowerCase ? "alter table " : "ALTER TABLE ") +
          this.tableName() +
          " " +
          columnSql.join(" "),
        bindings: columns.bindings,
      });
    }
  }

  // Commit usando Mapepire Pool (el "connection" que recibe Knex en tu client es el Pool)
  async commit(connection: MapepirePool | { execute?: Function }) {
    try {
      // Ejecuta COMMIT si está disponible; ignora si no existe (no rompe migraciones).
      if (connection && typeof (connection as MapepirePool).execute === "function") {
        await (connection as MapepirePool).execute("COMMIT", { parameters: [] });
      } else if (connection && typeof (connection as any).execute === "function") {
        // fallback genérico
        await (connection as any).execute("COMMIT", { parameters: [] });
      }
    } catch {
      // no-op para no romper si el entorno no usa compromiso explícito
    }
  }
}

export default IBMiTableCompiler;

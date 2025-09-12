[![npm version](http://img.shields.io/npm/v/knex-jt400.svg)](https://npmjs.org/package/knex-jt400)

**Please submit an issue for any bug encounter or any questions you have.**

## Description

This is an external dialect for [knex](https://knexjs.org).
This library uses JDBC and is only tested on IBMi.

## Supported functionality

- Query building
- Query execution
- Transactions
- Streaming

## Installation

```
npm install --save knex knex-jt400
```

Requires Node v16 or higher.

## Dependencies

`npm install knex` see [knex](https://github.com/tgriesser/knex)

## Usage

This library can be used as commonjs, esm or TypeScript.

### CommonJs

```javascript
const knex = require("knex");
const { DB2Dialect } = require("knex-jt400");

const db = knex({
  client: DB2Dialect,
  connection: {
    host: "localhost", // hostname or ip address of server
    user: "<user>", // IBMi username
    password: "<password>", // IBMi password
    connectionStringParams: {
      // DSN connection string parameters https://www.ibm.com/docs/en/i/7.5?topic=details-connection-string-keywords
      ALLOWPROCCALLS: 1,
      CMT: 0,
      DBQ: "MYLIB", // library or schema that holds the tables
    },
  },
  pool: {
    min: 2,
    max: 10,
  },
});

const query = db.select("*").from("table").where({ foo: "bar" });

query
  .then((result) => console.log(result))
  .catch((err) => console.error(err))
  .finally(() => process.exit());
```

### ESM

```javascript
import knex from "knex";
import { DB2Dialect } from "knex-jt400";

/**
 * @type {import("knex-jt400").DB2Config}
 */
const config = {
  client: DB2Dialect,
  connection: {
    host: "localhost", // hostname or ip address of server
    user: "<user>", // IBMi username
    password: "<password>", // IBMi password
    connectionStringParams: {
      // DSN connection string parameters https://www.ibm.com/docs/en/i/7.5?topic=details-connection-string-keywords
      ALLOWPROCCALLS: 1,
      CMT: 0,
      DBQ: "MYLIB", // library or schema that holds the tables
    },
  },
  pool: {
    min: 2,
    max: 10,
  },
};

const db = knex(config);

try {
  const data = await db.select("*").from("table").where({ foo: "bar" });
  console.log(data);
} catch (err) {
  throw new Error(err);
} finally {
  process.exit();
}
```

### TypeScript

```typescript
import { knex } from "knex";
import { DB2Dialect, DB2Config } from "knex-jt400";

const config: DB2Config = {
  client: DB2Dialect,
  connection: {
    host: "localhost", // hostname or ip address of server
    user: "<user>", // IBMi username
    password: "<password>", // IBMi password
    connectionStringParams: {
      // DSN connection string parameters https://www.ibm.com/docs/en/i/7.5?topic=details-connection-string-keywords
      ALLOWPROCCALLS: 1,
      CMT: 0,
      DBQ: "MYLIB", // library or schema that holds the tables
    },
  },
  pool: {
    min: 2,
    max: 10,
  },
};

const db = knex(config);

try {
  const data = await db.select("*").from("table").where({ foo: "bar" });
  console.log(data);
} catch (err) {
  throw new Error(err);
} finally {
  process.exit();
}
```

### Streaming example

```typescript
import { knex } from "knex";
import { DB2Dialect, DB2Config } from "knex-jt400";
import { Transform } from "node:stream";
import { finished } from "node:stream/promises";

const config: DB2Config = {
  client: DB2Dialect,
  connection: {
    host: "localhost", // hostname or ip address of server
    user: "<user>", // IBMi username
    password: "<password>", // IBMi password
    connectionStringParams: {
      // DSN connection string parameters https://www.ibm.com/docs/en/i/7.5?topic=details-connection-string-keywords
      ALLOWPROCCALLS: 1,
      CMT: 0,
      DBQ: "MYLIB", // library or schema that holds the tables
    },
  },
  pool: {
    min: 2,
    max: 10,
  },
};

const db = knex(config);

try {
  const data = await db
    .select("*")
    .from("table")
    .stream({ fetchSize: 1 }); // optional, fetchSize defaults to 1

  // use an objectMode transformer
  const transform = new Transform({
    objectMode: true,
    transform(
      chunk: any,
      encoding: BufferEncoding,
      callback: TransformCallback,
    ) {
      // chunk will be an array of objects
      // the length of the array is the chunk size
      console.log(chunk);
      callback(null, chunk);
    },
  });

  // pipe through the transformer
  data.pipe(transform);

  await finished(data); // db queries are promises, we need to wait until resolved

  // or we can iterate through each record
  for await (const record of data) {
    console.log(record);
  }
} catch (err) {
  throw err;
} finally {
  process.exit();
}
```

## Bundling with Vite
If you are bundling your application with Vite, then you will need to add this to your config.

```javascript
// vite.config.js

export default {
  optimizeDeps: {
    exclude: ["@mapbox"],
  }
}
```

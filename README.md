[![npm version](http://img.shields.io/npm/v/knex-mapepire.svg)](https://npmjs.org/package/knex-mapepire)

**Please submit an issue for any bug encounter or any questions you have.**

## Description

This is an external dialect for [knex](https://knexjs.org).
This library uses @ibm/mapepire-js.

## Supported functionality

- Query building
- Query execution
- Transactions

## Future functionality
- Streaming

## Installation

```
npm install --save knex knex-mapepire
```

Requires Node v16 or higher.

## Dependencies

`npm install knex` see [knex](https://github.com/tgriesser/knex)

## Usage

This library can be used as commonjs, esm or TypeScript.

### CommonJs

```javascript
const knex = require("knex");
const { DB2Dialect } = require("knex-mapepire");

const db = knex({
  client: DB2Dialect,
  connection: {
    host: "localhost", // hostname or ip address of server
    user: "<user>", // IBMi username
    password: "<password>", // IBMi password
    rejectUnauthorized: false
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
import { DB2Dialect } from "knex-mapepire";

/**
 * @type {import("knex-mapepire").DB2Config}
 */
const config = {
  client: DB2Dialect,
  connection: {
    host: "localhost", // hostname or ip address of server
    user: "<user>", // IBMi username
    password: "<password>", // IBMi password
    rejectUnauthorized: false
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
import { DB2Dialect, DB2Config } from "knex-mapepire";

const config: DB2Config = {
  client: DB2Dialect,
  connection: {
    host: "localhost", // hostname or ip address of server
    user: "<user>", // IBMi username
    password: "<password>", // IBMi password
    rejectUnauthorized: false
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

### Streaming example in future

```typescript
import { knex } from "knex";
import { DB2Dialect, DB2Config } from "knex-mapepire";
import { Transform } from "node:stream";
import { finished } from "node:stream/promises";

const config: DB2Config = {
  client: DB2Dialect,
  connection: {
    host: "localhost", // hostname or ip address of server
    user: "<user>", // IBMi username
    password: "<password>", // IBMi password
    rejectUnauthorized: false
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

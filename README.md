# Nova PostgreSQL DAO
Simple, yet incredibly flexible ORM for Nova framework.

## Usage

This module is created for [Nova](https://www.npmjs.com/org/nova) framework, but it can be used as a standalone ORM just as well. It is designed for scenarios when connection to the database is needed for a series of short and relatively simple requests. If you need a connection to execute long running queries (or queries that return large amounts of data) or require complex transaction logic, this module is probably not for you.

## Requirements

This module is written in TypeScript and compiled down to JavaScript (ES6). Aa such, it can be used in any JavaScript application which satisfies the runtime requirements. The most recent version of the module **requires Node.js 8.0 or later**.

## Install

```sh
$ npm install --save @nova/pg-dao
```

## Examples

### Executing Queries
```TypeScript
import { Database, Query } from '@nova/pg-dao';

// create a database object
const db = new Database({ /* database config */ });

async function runQueries() {
    let dao: Session;

    try {
        // create a session object in read-only mode
        dao = db.getSession({ readonly: true });

        // create and execute simple query
        const query1 = Query.from('SELECT * FROM users;', { name: 'qGetAllUsers', mask: 'list' });
        const users = await session.execute(query1);

        // create and execute parameterized query
        const qSelectUsers = Query.template('SELECT * from users WHERE status={{status}}', { mask: 'list' } );
        const query2 = new qSelectUsers({ status: 'active' });
        const activeUsers = await session.execute(query2);

        // close the session
        await dao.close('commit');
    }
    catch(error) {
        // log error somewhere
        
        // then make sure connection is closed
        if (dao && dao.isActive) {
            await dao.close('rollback');
        }

        // maybe re-throw the error
    }
}

```

### Updating Models
```TypeScript
import { Database, Session, Model, PgIdGenerator, dbModel, dbField } from '@nova/pg-dao';

// Define a simple model backed by 'users' table in the database
@dbModel('users', new PgIdGenerator('users_id_seq'))
export class User extends Model {
    
    // username field is expected to be a string
    @dbField(String)
    username: string;
    
    // status field is expected to be a number
    @dbField(Number)
    status: number;
}

// create a database object
const db = new Database({ /* database config */ });

// define a function to update a model
async function updateStatus(userId: string, newStatus: number) {
    let dao: Session;

    try {
        // create a session object in read-write mode
        dao = db.getSession({ readonly: false });

        // fetch a user model from the database, and lock it for edit
        const user = await dao.fetchOne(User, { id: userId }, true);

        // update the model
        user.status = newStatus;

        // commit the changes and close the session
        await dao.close('commit');
    }
    catch(error) {
        // log error somewhere
        
        // then make sure connection is closed
        if (dao && dao.isActive) {
            await dao.close('rollback');
        }

        // maybe re-throw the error
    }
}

```

## API Reference
Complete public API definitions can be found in [nova-pg-dao.d.ts](https://github.com/herculesinc/nova.pg-dao/blob/master/nova-pg-dao.d.ts) file. The below sections explain in more detail how the API can be used for specific tasks:

* [Obtaining database connection](#obtaining-database-connection)
  * [Creating a session](#creating-a-session)
  * [Session lifecycle](#session-lifecycle)
* [Querying the database](#querying-the-database)
  * [Simple Queries](#simple-queries)
  * [Parameterized Queries](#parameterized-queries)
  * [Result Parsing](#result-parsing)
* [Working with models](#working-with-models)
  * [Defining models](#defining-models)
  * [Fetching models from the database](#fetching-models-from-the-database)
  * [Creating, deleting, updating models](#creating-deleting-updating-models)
* [Errors](#errors)

### Obtaining database connection
To obtain a database connection, you first need to create a `Database` object, and then call `Database.getSession()` method on it. The `Database` object can be created like so:

```TypeScript
const db = new Database(config);
```

where, `config` should have the following form:

```TypeScript
interface DatabaseConfig {
    name?               : string;   // defaults to 'database', used for logging
    connection: {                   // required connection settings
        host            : string;
        port?           : number;   // optional, default 5432
        ssl?            : boolean;  // optional, default false
        user            : string;
        password        : string;
        database        : string;
    };
    pool?: {                        // optional connection pool settings
        maxSize?        : number;   // defaults to 20   
        idleTimeout?    : number;   // defaults to 30000 milliseconds
        reapInterval?   : number;   // defaults to 1000 milliseconds
    };
    session?            : SessionConfig;    // optional, described below
}
```
Creation of the database object does not establish a database connection but rather allocates a pool to hold connections to the database specified by the options object.

#### Creating a session
Once a `Database` object is created, you can use it to acquire connection sessions like so:

```TypeScript
const dao = database.getSession(options, logger);
```
Both, `options` and `logger` are optional parameters. If supplied, `options` object should have the following form:

```TypeScript
interface SessionOptions {                     
    readonly?           : boolean;              // default true
    verifyImmutability? : boolean;              // default true
    logQueryText?       : QueryTextLogLevel;    // default OnError
}

const enum QueryTextLogLevel {
    never = 0, onError = 1, always = 2
}
```
The meaning of the above options is as follows:

* **readonly** - when set to "true", all queries in the session will be executed in a read-only transaction. Thus, no database mutations will be possible.
* **verifyImmutability** - when set to "true", all models will be checked for changes before the session is closed; otherwise, only mutable models will be checked for changes. Checking all models for changes may incur a performance penalty - so, in performance-intensive applications (or in production environments), it might make sense to set this property to "false";
* **logQueryText** - defines how query text will be sent to the `logger`; can be one of the following values:
  * `never` - query text is never logged;
  * `onError` - query text is logged only if the query results in an error; this is the default; 
  * `always` - query text is logged for every query.

If supplied, the `logger` object must satisfy the following interface:

```TypeScript
interface Logger {        
    debug(message: string)  : void;
    info(message: string)   : void;
    warn(message: string)   : void;
    error(error: Error)     : void;

    trace(source: TraceSource, command: string, duration: number, success: boolean, details?: TraceDetails): void;
    trace(source: TraceSource, command: TraceCommand, duration: number, success: boolean, details?: TraceDetails): void;
}

interface TraceSource {
    readonly name   : string;
    readonly type   : string;
}

interface TraceCommand {
    readonly name   : string;
    readonly text?  : string;
}

interface TraceDetails {
    [key: string]: string;
}
```
By default, a logger that writes messages to console is used. If you wish to turn logging off completely, pass `null` as the second parameter into `Database.getSession()` method.

#### Session lifecycle

Creation of a session object does not establish a database connection. The connection is established on the first call to `Session.execute()` method or its aliases. In general, a session goes through the following stages:

1. A session is created using `Database.getSession()` method.
2. Upon the first call to `Session.execute()`:
   1. A database connection is created or retrieved from the connection pool;
   2. A new transaction is started; if the session is read-only, the transaction is started using `BEGIN READ ONLY` command, otherwise it is started using `BEGIN READ WRITE` command.
3. All subsequent calls to `Session.execute()` method execute queries in the context of the created transaction.
4. A session must be closed using `Session.close()` method. This method can be executed with the following parameters:
   1. `Session.close('commit')` to commit changes to the database, or to end read-only transaction;
   2. `Session.close('rollback')` to roll back any changes sent to the database during the session.

Always call the `Session.close()` method after session object is no longer needed. This will release the connection back to the pool. If you do not release the connection, the connection pool will become exhausted and bad things will happen.

Do not start or end transactions manually by executing `BEGIN`, `COMMIT`, or `ROLLBACK` commands. Doing so will confuse the session and bad things may (and probably, will) happen.

### Querying the database
To execute queries against the database, you can use `Session.execute()` method like so:

```TypeScript
const results = await session.execute(query);
```

where, `query` object should have the following form:

```TypeScript
interface Query {
    readonly text       : string;
    readonly name?      : string;
    readonly mask?      : 'list' | 'single';
    readonly values?    : any[];
    readonly handler?   : typeof Object | typeof Array | typeof Model | ResultHandler;
}
```
You can create query objects directly, but it is much easier to create them using `Query.from()` and `Query.template()` methods described below. The meaning of properties in the query object is as follows:

* **text** - SQL code to be executed; this is the only required property.
* **name** - name of the query, used for logging purposes only.
* **mask** - result mask which controls how the results are returned; can be one of the following values:
  * `undefined` - not results will be returned (even for `SELECT` statements);
  * `list` - result set returned as an array (an empty array if no results);
  * `single` - the first row of the result set is returned (or `undefined` if no results).
* **values** - an array of query parameters (for parameterized queries). These parameters can be referred to in the query text as `$1`, `$2` etc.
* **handler** - for queries returning results, this property describes how each row should be parsed; can be one of the following values:
  * `Object` - each row will be parsed into an object;
  * `Array` - each row will be parsed into an array;
  * `Model` - each row will be parsed into a model;
  * `ResultHandler` - each row will be parsed using `Handler.parse()` method.
  
#### Simple Queries
The best way to create a simple (non-parameterized) query is by using `Query.from()` method. This method has the following signatures:

```TypeScript
from(text: string): Query;
from(text: string, name: string): Query;
from(text: string, name: string, mask: 'list' | 'single'): Query;
from(text: string, name: string, options: QueryOptions): Query;
from(text: string, options: QueryOptions): Query;
```

Here are a few examples:
```TypeScript
// this query that will return no results
const query1 = Query.from(`UPDATE users SET username='User1' WHERE id = 1;`);

// this query will return an array of user objects
const query2 = Query.from('SELECT * FROM users;', 'qSelectAllUsers', 'list');

// this query will return an array of user rows where each row is an array
const query4 = Query.from('SELECT * FROM users;', { mask: 'list', handler: Array });

// this query will return a single user object (or undefined)
const query3 = Query.from('SELECT * FROM users WHERE id = 1;' { mask: 'single' });

```

In general, the query `options` object should have the following form:

```TypeScript
interface QueryOptions {
    readonly name?      : string;
    readonly mask       : 'list' | 'single';
    readonly handler?   : typeof Object | typeof Array | typeof Model | ResultHandler;
}
```
As can be seen above, `mask` is the only required property for the options.

#### Parameterized Queries

#### Result Parsing

### Working with models

#### Defining models

#### Fetching models from the database

#### Creating, deleting, updating models

### Errors

* **ConnectionError**, thrown when:
  * establishing a database connection fails
  * other?
* **SessionError**, thrown when:
  * an attempt to use an already closed session is made
  * an attempt to make changes in a read-only session is detected
  * an attempt to make changes to an immutable model is detected
  * other?
* **ModelError**, thrown when:
  * a model definition is invalid
  * parsing of database rows into models fails
  * other?
* **QueryError**, thrown when:
  * execution of a query fails
* **ParseError**, thrown when:
  * parsing of query results fails

## License
Copyright (c) 2019 Credo360, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
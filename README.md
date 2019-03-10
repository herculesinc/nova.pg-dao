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
        const users = await dao.execute(query1);

        // create and execute parameterized query
        const qSelectUsers = Query.template('SELECT * from users WHERE status={{status}}', { mask: 'list' } );
        const query2 = new qSelectUsers({ status: 'active' });
        const activeUsers = await dao.execute(query2);

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

# API Reference
Complete public API definitions can be found in [nova-pg-dao.d.ts](https://github.com/herculesinc/nova.pg-dao/blob/master/nova-pg-dao.d.ts) file. The below sections explain in more detail how the API can be used for specific tasks:

* [Obtaining database connection](#obtaining-database-connection)
  * [Creating a session](#creating-a-session)
  * [Session lifecycle](#session-lifecycle)
* [Querying the database](#querying-the-database)
  * [Simple Queries](#simple-queries)
  * [Parameterized Queries](#parameterized-queries)
  * [Result Parsing](#result-parsing)
  * [Query batching](#query-batching)
* [Working with models](#working-with-models)
  * [Defining models](#defining-models)
  * [Fetching models from the database](#fetching-models-from-the-database)
  * [Updating, creating, deleting models](#updating-creating-deleting-models)
* [Errors](#errors)

## Obtaining database connection
To obtain a database connection, you first need to create a `Database` object, and then call `Database.getSession()` method on it. The `Database` object can be created like so:

```TypeScript
const db = new Database(config);
```

where, `config` should have the following form:

```TypeScript
interface DatabaseConfig {
    name?               : string;           // defaults to 'database', used for logging
    connection: {                           // required connection settings
        host            : string;
        port?           : number;           // optional, default 5432
        ssl?            : boolean;          // optional, default false
        user            : string;
        password        : string;
        database        : string;
    };
    pool?: {                                // optional connection pool settings
        maxSize?        : number;           // defaults to 20   
        idleTimeout?    : number;           // defaults to 30000 milliseconds
        reapInterval?   : number;           // defaults to 1000 milliseconds
    };
    session?            : SessionConfig;    // optional, described below
}
```
Creation of the database object does not establish a database connection but rather allocates a pool to hold connections to the database specified by the options object.

### Creating a session
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

    trace(source: TraceSource, command: string, duration: number, success: boolean): void;
    trace(source: TraceSource, command: TraceCommand, duration: number, success: boolean): void;
}
```
By default, a logger that writes messages to console is used. If you wish to turn logging off completely, pass `null` as the second parameter into `Database.getSession()` method.

### Session lifecycle

Creation of a session object does not establish a database connection. The connection is established on the first call to `Session.execute()` method or its aliases. In general, a session goes through the following stages:

1. A session is created using `Database.getSession()` method.
2. Upon the first call to `Session.execute()`:
   1. A database connection is created or retrieved from the connection pool;
   2. A new transaction is started; if the session is read-only, the transaction is started using `BEGIN READ ONLY` command, otherwise it is started using `BEGIN READ WRITE` command.
3. All subsequent calls to `Session.execute()` method execute queries in the context of the created transaction.
4. A session must be closed using `Session.close()` method. This method can be executed with the following parameters:
   1. `Session.close('commit')` to commit changes to the database, or to end read-only transaction;
   2. `Session.close('rollback')` to roll back any changes sent to the database during the session.

Always call `Session.close()` method after session object is no longer needed. This will release the connection back to the pool. If you do not release the connection, the connection pool will become exhausted and bad things will happen.

Do not start or end transactions manually by executing `BEGIN`, `COMMIT`, or `ROLLBACK` commands. Doing so will confuse the session and bad things may (and probably, will) happen.

#### Checking session state
You can check session state using `Session.isActive` and `Session.inTransaction` properties like so:
```TypeScript
// create a session object
const dao = db.getSession({ readonly: true });
dao.isActive        // true
dao.inTransaction   // false

// execute a query
const query1 = Query.from('SELECT * FROM users;', { name: 'qGetAllUsers', mask: 'list' });
const users = await dao.execute(query1);
dao.isActive        // true
dao.inTransaction   // true

// close the session
await dao.close('commit');
dao.isActive        // false
dao.inTransaction   // false
```

You can also check whether a session is read only using `Session.isReadonly` property.

## Querying the database
To execute queries against the database, you can use `Session.execute()` method like so:

```TypeScript
const results = await session.execute(query);
```

where, `query` object should have the following form:

```TypeScript
interface Query {
    text        : string;
    name?       : string;
    mask?       : 'list' | 'single';
    values?     : any[];
    handler?    : typeof Object | typeof Array | typeof Model | ResultHandler;
}
```
You can create query objects directly, but it is much easier to create them using `Query.from()` and `Query.template()` methods described in the following sections. The meaning of properties in the query object is as follows:

* **text** - SQL code to be executed; this is the only required property.
* **name** - name of the query, used for logging purposes only.
* **mask** - result mask which controls how the results are returned; can be one of the following values:
  * `undefined` - no results will be returned (even for `SELECT` statements);
  * `list` - result set will be returned as an array (an empty array if no results);
  * `single` - the first row of the result set will be returned (or `undefined` if no results).
* **values** - an array of query parameters (for parameterized queries). These parameters can be referenced in the query text as `$1`, `$2` etc.
* **handler** - for queries returning results, this property describes how each row should be parsed; can be one of the following values:
  * `Object` - each row will be parsed into an object;
  * `Array` - each row will be parsed into an array;
  * `Model` - each row will be parsed into a model;
  * `ResultHandler` - each row will be parsed using `Handler.parse()` method.
  
### Simple Queries
The best way to create a simple (non-parameterized) query is by using `Query.from()` method. This method has the following signatures:

```TypeScript
namespace Query {
    from(text: string): Query;
    from(text: string, name: string): Query;
    from(text: string, name: string, mask: 'list' | 'single'): Query;
    from(text: string, name: string, options: QueryOptions): Query;
    from(text: string, options: QueryOptions): Query;
}
```

Here are a few examples:
```TypeScript
// this query that will return no results
const query1 = Query.from(`UPDATE users SET username='User1' WHERE id=1;`);

// this query will return an array of user objects
const query2 = Query.from('SELECT * FROM users;', 'qSelectAllUsers', 'list');

// this query will return an array of user rows where each row is an array
const query4 = Query.from('SELECT * FROM users;', { mask: 'list', handler: Array });

// this query will return a single user object (or undefined)
const query3 = Query.from('SELECT * FROM users WHERE id = 1;' { name: 'qGetUser', mask: 'single' });

```

In general, the query `options` object should have the following form:

```TypeScript
interface QueryOptions {
    name?       : string;
    mask        : 'list' | 'single';
    handler?    : typeof Object | typeof Array | typeof Model | ResultHandler;
}
```
As can be seen above, `mask` is the only required property. Providing a custom `ResultHandler` allows great flexibility over [parsing query results](#result-parsing).

### Parameterized Queries
You can create parameterized queries by using `Query.template()` method. This method return a query template, which can then be used to instantiate queries with specific parameters. `Query.template()` method has the following signatures:

```TypeScript
namespace Query {
    template(text: string): QueryTemplate;
    template(text: string, name: string): QueryTemplate;
    template(text: string, name: string, mask: 'list' | 'single'): QueryTemplate;
    template(text: string, name: string, options: QueryOptions): QueryTemplate;
    template(text: string, options: QueryOptions): QueryTemplate;
}
```

Here are a few examples:
```TypeScript
const qUpdateUser = Query.template('UPDATE users SET username={{username}} WHERE id={{id}};');

const query1 = new qUpdateUser({ id: 1, username: 'joe' });
// will be executed as: UPDATE users SET username='joe' WHERE id=1;

const query2 = new qUpdateUser({ id: 2, username: `j'ane` });
// will be executed as: UPDATE users SET username=$1 WHERE id=2; 
// with values: ["j'ane"]

const qSelectUser = Query.template('SELECT * FROM users WHERE id={{id}};', { mask: 'single' });

const query3 = new qSelectUser({ id: 3 });
// will be executed as: SELECT * FROM users WHERE id=3;
```

Within query `text`, the parameters must be enclosed withing double curly brackets `{{}}`. Safe parameters (e.g. booleans, numbers, safe strings) are inlined into the query text before the query is sent to the database. If one of the parameters is an unsafe string, the query is executed as a parameterized query against the database to avoid possibility of SQL-injection. In general, parameters are treated as follows:

* **boolean** - always inlined;
* **number** - always inlined;
* **Date** - converted to ISO string and always inlined;
* **string** - if the string is safe, it is inlined, otherwise the query is executed as a parameterized query;
* **object** - object parameters are treated as follows:
  * `valueOf()` method is called on the object and if it returns a number, a boolean, a safe string, or a date, the value is inlined; if the returned value is an unsafe string, the query is executed as parameterized query,
  * if `valueOf()` method returns an object, the parameter is converted to string using `JSON.stringify()` and if the resulting string is safe, inlined; otherwise the query is executed as parameterized query;
* **array** - arrays are parameterized same as objects;
* **null** or **undefined** - always inlined as 'null';
* **function** - functions are parameterized as follows:
  * `valueOf()` method is called on the function, and if it returns a primitive value, the value is inlined,
  * otherwise `QueryError` will be thrown.

It is also possible to parameterize arrays of primitives in a special way to make them useful for `IN` clauses. This can be done by using `[[]]` brackets. In this case, the parameterization logic is as follows:

* arrays of numbers are always inlined using commas as a separator;
* arrays of strings are either inlined (if all strings are safe) or sent to the database as parameterized queries (if any of the strings is unsafe);
* all other array types (and arrays of mixed numbers and strings) are not supported and will throw QueryError.

Examples of array parametrization:
```TypeScript
const qSelectUsers1 = Query.template('SELECT * FROM users WHERE id IN ([[ids]]);', { mask: 'list' });
const query1 = new qSelectUsers1({ ids: [1, 2] });
// will be executed as: SELECT * FROM users WHERE id IN (1, 2);
// if {{}} were used, the query would have been: SELECT * FROM users WHERE id IN ("[1,2]");

const qSelectUsers2 = Query.template('SELECT * FROM users WHERE username IN ([[names]]);', { mask: 'list' });
const query2 = new qSelectUsers2({ names: [`joe`, `j'ane`, `jill` ]});
// will be executed as: SELECT * FROM users WHERE firstName IN ('joe', $1, 'jane');
// with values: ["j'ane"]
```

You can also forego parameter escaping by putting `~` within the parameter brackets. For example:
```TypeScript
const qSelectUser1 = Query.template('SELECT * FROM users WHERE id={{id}};', { mask: 'single' });
const query1 = new qSelectUsers1({ id: '1' });
// will be executed as: SELECT * FROM users WHERE id='1';

// but
const qSelectUsers2 = Query.template('SELECT * FROM users WHERE id={{~id}};', { mask: 'single' });
const query2 = new qSelectUsers2({ id: '1' });
// will be executed as: SELECT * FROM users WHERE id=1;
```

### Result Parsing
The `Query.handler` property specifies how rows read from the database will be parsed. Standard parsing options include:

* `Object` - each row will be parsed into an object;
* `Array` - each row will be parsed into an array;
* `Model` - each row will be parsed into a model.

If you wish parse query results using custom logic, you can provide a `ResultHandler` object for a query. The handler object must have a single `parse()` method which takes a row as input and produces custom output. The interfaces for `ResultHandler` are defined below:

```TypeScript
interface ResultHandler {
    parse(rowData: string[], fields?: FieldDescriptor[]): any;
}

interface FieldDescriptor {
    readonly name       : string;
    readonly oid        : number;
    readonly parser     : FieldParser;
}

interface FieldParser {
    (value: string): any;
}
```

The `rowData` array contains string representations of data read from the database. The `fields` array contains field definitions for the corresponding columns. Each field definition contains a `parser` function which can be used to parse string values read from the database into their JavaScript counterparts.

Here is an example of a custom parser:

```TypeScript
// define custom handler
const idExtractor = {
    parse: (row: string[]) => Number.parseInt(row[0])
};

const query = Query.from('SELECT * FROM users;', { mask: 'list', handler: idExtractor });
// when executed, this query will return an array of numbers, rather than objects
```

### Query batching
If you execute multiple queries in a row without waiting for results, the queries will be sent to the database in a single request, when possible. For example:
```TypeScript
// define queries
const query1 = Query.from('SELECT * FROM users WHERE id=1;', { mask: 'single' });
const query2 = Query.from('SELECT * FROM users WHERE id=2;', { mask: 'single' });
const query3 = Query.from('SELECT * FROM users WHERE id=3;', { mask: 'single' });

// execute queries one after another without 'await'
const result1 = session.execute(query1);
const result2 = session.execute(query2);
const result3 = session.execute(query3);

// wait for results here
const users = await Promise.all([result1, result2, result3]);
```
In the above example, all 3 quires will be combined and sent to the database as a single query:

 ```SQL
 SELECT * FROM users WHERE id=1;
 SELECT * FROM users WHERE id=2;
 SELECT * FROM users WHERE id=3;
 ```

Batching of queries is possible under the following conditions:
* No asynchronous code is executed between calls to `Session.execute()` method;
* None of the queries in a batch results in a parameterized query request (parameterized query requests cannot be batched with other queries).

## Working with models
This module provides a very flexible mechanism for defining managed models. Once a model is defined, the module takes care of synchronizing it with the database whenever changes are made. This drastically reduces the amount of boilerplate code you need to write.

### Defining models
To define a model, you need to extend the `Model` class like so:

```TypeScript
import { Model, PgIdGenerator, dbModel, dbField } from '@nova/pg-dao';

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
```
Until JavaScript supports decorators natively, you'll need to use `experimentalDecorators` compiler option for TypeScript to get the above to work. You can also define models without using decorators as [described later](#defining-models-without-decorators), but using decorators is so much more elegant!

Every model must be backed by a table which, in addition to user-defined fields, must have 3 required fields. These fields are:
* **id** - a primary key; on the JavaScript side, this field will be of string type; on the database side, this field can be backed by a `bigint`, a `text`, or a `uuid` field, depending on a type of ID generator which is used with the model.
* **created_on** - stores a timestamp (in milliseconds) of when the model row was created; on the JavaScript side, this field will be of number type; on the database side, it should be backed by a `bigint` field.
* **updated_on** - stores a timestamp (in milliseconds) of when the model was last updated; the types for this field are the same as for `updated_on`.

So, the table backing the `User` model defined above can be created using the following script:

```SQL
CREATE TABLE tokens
(
    id              bigint PRIMARY KEY,
    username        text NOT NULL,       
    status          smallint NOT NULL,
    created_on      bigint NOT NULL,
    updated_on      bigint NOT NULL
);
```

The are a couple of things to be aware of when defining managed models:
* All model properties must be in *camelCase* while all corresponding database fields must be in *snake_case*. So, for example, even though `created_on` field is defined using snake case in the database, on the model, it is accessible as `createdOn` property. If you don't adhere to this convention, queries generated automatically for your models will have syntax errors and bad things will happen.
* If you decide to override model constructor, the first thing you should do inside the constructor is to call `super(...arguments)`.

#### Model decorators
The module provides two decorators which can be used to define a model: `@dbModel` and `@dbField`.

As the name implies, `@dbModel` defines parameters for the entire model. The decorator must decorate the model class, and can accept two parameters:

* **tableName** - the name of the table backing the model; this parameter is required.
* **idGenerator** - the [ID Generator](#id-generators) which can be used to generate unique IDs for new instances of the model. This property is option and the default is `GuidGenerator`.

`@dbField` decorates a specific fields. Any property not decorated with `@dbField` will not be synced with the database. The following parameters can be specified for the `@dbField` decorator:

* **fieldType** - specifies the type of the field. This parameter is required. Currently the following field types are supported:
  * **Number** - must be backed by a database field that can be parsed into a JavaScript number; for example: `smallint`, `integer`, `real`, `double`. Using 64-bit integers (i.e. `bigint` or `bigserial`) for this field type may lead to data loss, and probably is not a good idea.
  * **Boolean** - must be backed by a database field that can be parsed into a boolean.
  * **String** - can be backed by a database field of character type (e.g. `text`) or by any other type that can be inferred from a string (e.g. `bigint`); on the JavaScript side, values for fields of this type will be represented as strings.
  * **Timestamp** - must be backed by a `bigint` database field; on the JavaScript side, values for fields of this type will be represented as numbers.
  * **Date** - must be backed by a database field of date/time type; on the JavaScript side, values for fields of this type will be represented as JavaScript `Date`.
  * **Object** - if no custom handler is provided, must be backed by `json` or `jsonb` database fields; if custom handler is provided, can be backed by pretty much anything.
  * **Array** - same as `Object` data type.
* **fieldOptions** - optional parameter to specify additional options for the field. Currently, the following options are supported:
  * **readonly** - a boolean flag which specifies if the field is read-only. Read-only fields are assumed to never change, and will not be synced with the database.
  * **handler** - an optional custom handler for the field to be used to parse, compare clone, and serialize field values. Providing custom handlers is only allowed for `Object` and `Array` fields.

#### Field handlers
Custom field handlers allow you to control all aspects of field parsing, comparing, and serialization. A field handler must comply with the following interface:

```TypeScript
interface FieldHandler {
    parse?      : (value: string) => any;
    serialize?  : (value: any) => string;
    clone       : (value: any) => any;
    areEqual    : (value1: any, value2: any) => boolean;
}
```
As seen from above, a field handler must supply functions for cloning and comparing field values, and can optionally supply functions for parsing and serializing field values.

This mechanism can be used, for example, to encrypt specific fields in a table. In such a case, `parse()` function would be responsible for decrypting values read from the database, while `serialize()` function would be responsible for encrypting values before they are sent back to the database.

#### ID generators
As described above, models require ID generators. Such generators can be anything as long as they comply with the following interface:

```TypeScript
interface IdGenerator {
  getNextId(logger?: Logger, session?: Session): Promise<string>;
}
```
The `getNextId()` method will receive references to a `Logger` and a `Session` whenever this method is called, but an ID generator does not need to rely on these object to generate unique IDs. This approach makes it possible to generate unique IDs in a variety of ways (e.g. [distributed ID generation using redis](https://www.npmjs.com/package/@nova/id-generator)) making models even more flexible.

Out of the box, this module provides two ID Generators:
* `GuidGenerator` which generates unique IDs using UUIDv4 format;
* `PgIdGenerator` which takes a name of a database sequence and whenever a new ID is requested, makes a call to the database to get the next value from that sequence.

#### Defining models without decorators
If you are not using TypeScript, or if you don't want to use decorators, you can still define models like so:

```TypeScript
import { Model, PgIdGenerator } from '@nova/pg-dao';

class User extends Model {    
    // nothing to do here, unless you need to override the constructor 
    // or add computed properties
}

// no need to set id, createdOn, updatedOn fields - they will be set automatically
User.setSchema('users', new PgIdGenerator('users_id_seq'), {
    username: { type: String },
    password: { type: Number }
});
```

The above will create a `User` model identical to the model defined earlier in this section using decorators.

#### Model extensions
You can easily add computed properties and custom methods to a model like so:
```TypeScript
@dbModel('users', new PgIdGenerator('users_id_seq'))
export class User extends Model {
    
    @dbField(String)
    username: string;
    
    @dbField(Number)
    status: number;

    // computed property
    get isActive(): boolean {
        return (this.status === 1);
    }

    // custom method
    activate() {
        this.status = 1;
    }
}
```

You can also define custom synchronization logic for a model by overriding `getSyncQueries()` method. This method is responsible for generating queries that are run against the database to synchronize model state. The method has the following signature:

```TypeScript
getSyncQueries(updatedOn: number, checkReadonlyFields?: boolean): Query[] | undefined;
```

Here is an example of how overriding this method can be used to update a different table when a model synchronizes:
```TypeScript
@dbModel('users', new PgIdGenerator('users_id_seq'))
export class User extends Model {
    
    @dbField(String)
    username: string;
    
    @dbField(Number)
    status: number;

    getSyncQueries(updatedOn: number, checkReadonlyFields?: boolean): Query[] | undefined {
        // call the base method to generate standard sync queries
        const queries = super.getSyncQueries(updatedOn, checkReadonlyFields);

        // get an object containing original values for all fields
        const original = this.getOriginal();

        if (original) {
            if (this.status === 1 && original.status != 1) {
                // if the user became active, add its ID to active_users table
                queries.push(Query.from(`INSERT INTO active_users (user_id) VALUES (${this.id});`));
            }
            else if (this.status != 1 && original.status === 1) {
                // if the user became inactive, delete its id from active_users table
                queries.push(Query.from(`DELETE FROM active_users WHERE id = ${this.id};`));
            }
        }

        return queries;
    }
}
```
The above example makes use of the following:
* It uses `super.getSyncQueries()` method to generate queries using standard model sync logic. You are not required to call this method, but if you don't, you'll need to:
  * Check all models fields for changes yourself and generate appropriate queries to sync these changes;
  * Update `updatedOn` field for the model yourself to the value passed in as `updatedOn` parameter.
* It uses `Model.getOriginal()` method to get state of the model at the time when it was read from the database. Keep in mind, that if a session is created with `verifyImmutability` flag set to false, original values for read-only fields will not be stored.
* It appends additional queries to the queries generated by the base `getSyncQueries()` method when needed. These queries will be run against the database when model changes are flushed.

Because `Model.getSyncQueries()` method is run just before model changes are flushed to the database, you can also use it to validate model state like so:
```TypeScript
@dbModel('users', new PgIdGenerator('users_id_seq'))
export class User extends Model {
    
    @dbField(String)
    username: string;
    
    @dbField(Number)
    status: number;

    getSyncQueries(updatedOn: number, checkReadonlyFields?: boolean): Query[] | undefined {
        // validate model state
        if (this.username.length > 25) {
            throw new Error('Username is too long!');
        }

        // return queries generated using standard sync logic
        return super.getSyncQueries(updatedOn, checkReadonlyFields);
    }
}
```

It is not recommended, but if you really need to you can also override model constructor. Just remember to pass all the arguments to the base constructor like so:
```TypeScript
@dbModel('users', new PgIdGenerator('users_id_seq'))
export class User extends Model {
    
    @dbField(String)
    username: string;
    
    @dbField(Number)
    status: number;

    constructor() {
        // call base constructor
        super(...arguments);

        // some custom initialization logic here;
        // you can assume that all fields have been initialized
        // but mutable flag has not yet been set
    }
}
```

### Fetching models from the database

Fetching models from the database can be done via `Session.fetchOne()` and `Session.fetchAll()` methods or via general `Session.execute()` method.

#### Fetching via fetchOne() and fetchAll()
The easiest way to retrieve models of a given type from the database is by using `fetchOne()` or `fetchAll()` methods. As the names imply, `fetchOne()` returns a single model, while `fetchAll()` returns an array of models. The signatures of these methods are as follows:

```TypeScript
fetchOne(type, selector, forUpdate?): Model;
fetchAll(type, selector, forUpdate?): Model[];
```

The meaning of the above parameters is as follows:
* **type** - class of the model to retrieve. This must be a type extending `Model` class.
* **selector** - describes which models should be retrieved as follows:
  * If `selector` is an object, each property name is assumed to be a *camelCase* version of the database column name, and each property value is expected to contain a [filter](#field-filters) to be applied to that column. The filters for each column are then combined using `AND` operator.
  * If `selector` is an array, each value of the array is processed as an object selector (described above), and the results are joined together using `OR` operator.
* **forUpdate** - a boolean flag indicating whether the retrieved models can be updated; the default is false. When `forUpdate` is set to true, a `SELECT` query will be executed with a `FOR UPDATE` clause. This will lock model rows in the database to prevent them from being modified by other sessions. The row will remain locked until the sessions is closed.

Here are a few examples:
```TypeScript
import { Operators as Op } from '@nova/pg-dao';

// retrieve an immutable User model where id=1
const user1 = await session.fetchOne(User, { id: '1'});

// retrieve a User model where id=2 and lock it for update
const user2 = await session.fetchOne(User, { id: '2'}, true);

// retrieve immutable user models where status=1 AND username LIKE 'j*'
const users1 = await session.fetchAll(User, { status: 1, username: op.like('j*') });

// retrieve user models where id IN ('1', '2', '3') and lock them for update
const users2 = await session.fetchAll(User, { id: ['1', '2', '3']}, true);

// retrieve immutable user models where id id=1 OR status=1
const users2 = await session.fetchAll(User, [{ id: '1' }, { status: 1 }]);
```

##### Field filters
Field filters specify conditions to be applied to a model field. They can be defined using `Operators`. For example:

```TypeScript
{
    id: Operators.eq('1'),          // resolves to: id='1'
    id: Operators.in(['1', '2']),   // resolves to: id IN ('1', '2')
    id: Operators.lt('10')          // resolves to: id < '10'
}
```

Currently, the following `Operators` are available:
* `eq(value)` - resolves to `= value`;
* `neq(value)` - resolves to `!= value`;
* `gt(value)` - resolves to `> value`;
* `gte(value)` - resolves to `>= value`;
* `lt(value)` - resolves to `< value`;
* `lte(value)` - resolves to `<= value`;
* `not(value)` - resolves to `IS NOT value`;
* `like(value)` - resolves to `LIKE value`;
* `contains(value)` - resolves to `@> value`;
* `in(values)` - resolves to `IN (...values)`;

For `eq` and `in` operators, you can also use short-hands like so:
```TypeScript
{
    id: '1',        // also resolves to: id='1'
    id: ['1', '2']  // also resolves to: id IN ('1', '2')
}
```

#### Fetching via execute()
While the operator syntax described above is quite powerful, it does not cover all possible ways in which one might want to fetch models. To create conditions of arbitrary complexity, you can create custom fetch queries for models, and then execute them like any other query using `Session.execute()` method. You can define a custom fetch query like so:
```TypeScript
// define a query to select all users for a given conversation
class qGetConversationUsers extends User.SelectQuery('list') {
    constructor(conversationId: string) {
        // indicate that models returned by this query are immutable
        super(false);

        // set custom WHERE condition for the query
        this.where = `id IN (SELECT user_id FROM conversations WHERE id = ${conversationId})`;
    }
}

// fetch users associated with conversation 123
const users = await session.execute(new qGetConversationUsers('123'));
```

In general, to create a custom fetch query, you should create a class that extends one of:
* `Model.SelectQuery('list')` - if you want the query to return an array of models.
* `Model.SelectQuery('single')` - if you want the query to return a single model.

Within the class constructor, you should call `super()` method with a parameter indicating whether the models returned by the query are mutable or not. Then, you can:
* Define a custom `WHERE` clause by setting `this.where` property;
* Define a custom `FROM` clause by setting `this.from` property;
* Define parameterization values for the query by setting `this.values` property.

Note, that if you define `values` for the query, the values must be in an array, and you'll need to use `$1`, `$2` etc. notation to reference them from within your custom `WHERE` clause.

#### Loading models from other sources
You can also load the models directly into session storage and make them appear as if they were loaded from the database. This may come in handy when you cache models somewhere else (e.g. redis cache) to reduce database load. Loading models can be done like so:

```TypeScript
// get model data from the caching system
const userData = await cache.get(modelId);

// create a User model
const user = new User(userData);

// load the model into the session
session.load(user);
user.isMutable(); // false
user.isCreated(); // false

const user2 = session.getOne(user.id);
user === user2; // true
```
In the above example, it is assumed that `userData` has the same fields as `User` model;

### Updating, creating, deleting models
The module monitors models retrieved from the database and created during the session. If changes to such models are detected, they are written out to the database when the session closes, or when `Session.flush()` method is called.

#### Updating models
Updating models is done simply by modifying model properties. No additional works is needed:
```TypeScript
// retrieve user model from the database and lock it for update
const user = await session.fetchOne(User, { id: '1' }, true);
user.isMutable(); // true

// update the model
user.username = 'john';
user.hasChanged(); // true

// sync changes with the database
await session.close('commit');
```
Note: you can updated only the models that were retrieved with the `forUpdate` parameter set to true.

#### Creating models
Creating new models can be done using `Session.create()` method as follows:
```TypeScript
// create a new model
const user = await session.create({ username: 'jake', status: 1 });
user.isCreated(); // true

// sync changes with the database
await session.close('commit');
```
Note: `id`, `createdOn`, and `updatedOn` properties will be set automatically.

#### Deleting models
Deleting models can be done using `Session.delete()` method as follows:
```TypeScript
// retrieve user model from the database and lock it for update
const user = await session.fetchOne(User, { id: '1'}, true);
user.isMutable(); // true

// delete the model
session.delete(user);
user.isDeleted(); // true

// sync changes with the database
await session.close('commit');
```
You can delete models that were retrieved with the `forUpdate` parameter set to true and models that have been created during the same session. If you create and then delete a model, before syncing the state with the database, the actions will cancel out and no commands will be sent to the database.

Note: deleting models deletes them from the database permanently.

#### Syncing model changes
All model changes will be either committed to the database or rolled back upon session close like so:
* `Session.close('commit')` - will sync all pending changes with the database and commit session transaction.
* `Session.close('rollback`) - will rollback any changes that were synced with the database during the session.

You can also sync model changes with the database before the session close by using `Session.flush()` method like so:
```TypeScript
await session.flush();
```
Calling `Session.flush()` will write out any pending model changes to the database, but will not close the session. Keep in mind, that if you close the session with `rollback` parameter, flushed changes will be rolled-back as well.

#### Checking model state
It is possible to check the state of a specific model using the following methods:
```TypeScript
model.isMutable()   : boolean   // true if the model was retrieved with forUpdate=true or just created
model.isCreated()   : boolean   // true if the new model has not yet been saved to the database
model.isDeleted()   : boolean   // true if the model has been deleted
model.hasChanged()  : boolean   // true if mutable properties in the model have been modified
```

You can also check if a model with a given ID is currently monitored by the session by using `getOne()` method like so:
```TypeScript
const user1 = await session.fetchOne(User, { id: '1'});
const user2 = session.getOne(User, user1.id);
user1 === user2; // true

```
If you delete a model and the call `Session.flush()` method, the deleted model will no longer be monitored by the session;

```TypeScript
const user1 = await session.fetchOne(User, { id: '1'}, true);
session.delete(user1);
await session.flush();

const user2 = session.getOne(User, user1.id);
user2 === undefined; // true
```

## Errors
The module provides several customized error classes which extend `Nova.Exception` class. These errors are:

* **ConnectionError**, thrown when:
  * establishing a database connection fails;
* **SessionError**, thrown when:
  * an attempt to use an already closed session is made;
  * an attempt to make changes in a read-only session is detected;
  * an attempt to fetch models for update in a read-only session is detected;
  * an attempt to flush a read-only session is detected;
  * an attempt to make changes to an immutable model is detected;
  * an attempt to reload a modified model is made;
  * an error is thrown when trying to close a session;
* **ModelError**, thrown when:
  * model definition is invalid;
  * model definition is inconsistent with the database;
  * parsing of a database row into a model fails;
  * serialization of a model fails;
  * cloning of model field values fails;
  * comparing of model field values fails;
* **QueryError**, thrown when:
  * an attempt to build an invalid query detected;
  * an invalid query is submitted for execution;
  * execution of a query fails;
* **ParseError**, thrown when:
  * parsing of query results fails;

# License
Copyright (c) 2019 Credo360, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// Type definitions for pg
// Project: https://github.com/brianc/node-postgres
// Definitions by: Phips Peter <http://pspeter3.com>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

declare module "pg" {
    import events = require("events");
    import stream = require("stream");

    export function connect(connection: string, callback: (err: Error, client: Client, done: (err?: any) => void) => void): void;
    export function connect(config: ClientConfig, callback: (err: Error, client: Client, done: (err?: any) => void) => void): void;
    export function end(): void;

    export interface ConnectionConfig {
        user?       : string;
        database?   : string;
        password?   : string;
        port?       : number;
        host?       : string;
        max?        : number;
        min?        : number;
        idleTimeoutMillis?: number;
        reapIntervalMillis?: number;
    }

    export interface Defaults extends ConnectionConfig {
        poolSize?: number;
        poolIdleTimeout?: number;
        reapIntervalMillis?: number;
        binary?: boolean;
        parseInt8?: boolean;
    }

    export interface ClientConfig extends ConnectionConfig {
        ssl?: boolean;
    }

    export interface QueryConfig {
        name?   : string;
        text    : string;
        rowMode?: 'array';
        values? : any[];
    }

    export interface QueryResult {
        command : string;
        rowCount: number;
        oid     : number;
        rows    : any[];
    }

    export interface ResultBuilder extends QueryResult {
        addRow(row: any): void;
    }

    export class Pool extends events.EventEmitter {
        _clients: Client[];
        _idle: Client[];

        constructor(config: ClientConfig);

        connect(): Promise<Client>;
        connect(callback: (err: Error, client: Client, done: (err: Error) => void) => void): void;

        end(): Promise<any>;
    }

    export class Client extends events.EventEmitter {
        _destroying: boolean;

        constructor(connection: string);
        constructor(config: ClientConfig);

        connect(callback: (err: Error) => void): void;
        release(error?: Error): void;

        end(): void;

        query(text: string): Promise<QueryResult>;
        query(text: string, callback?: (err: Error, result: QueryResult) => void): Query;

        query(text: string, values: any): Promise<QueryResult>;
        query(text: string, values: any[], callback?: (err: Error, result: QueryResult) => void): Query;

        query(config: QueryConfig): Promise<QueryResult>;
        query(config: QueryConfig, callback?: (err: Error, result: QueryResult) => void): Query;

        copyFrom(queryText: string): stream.Writable;
        copyTo(queryText: string): stream.Readable;

        pauseDrain(): void;
        resumeDrain(): void;

        public on(event: "drain", listener: () => void): this;
        public on(event: "error", listener: (err: Error) => void): this;
        public on(event: "notification", listener: (message: any) => void): this;
        public on(event: "notice", listener: (message: any) => void): this;
        public on(event: string, listener: Function): this;
    }

    export class Query extends events.EventEmitter {
        public on(event: "row", listener: (row: any, result?: ResultBuilder) => void): this;
        public on(event: "error", listener: (err: Error) => void): this;
        public on(event: "end", listener: (result: ResultBuilder) => void): this;
        public on(event: string, listener: Function): this;
    }

    export class Events extends events.EventEmitter {
        public on(event: "error", listener: (err: Error, client: Client) => void): this;
        public on(event: string, listener: Function): this;
    }

    namespace types {
        function setTypeParser<T>(typeId: number, parser: (value: string) => T): void;
        function getTypeParser<T>(oid: number, format: string): (value: string) => T;
    }

    export interface Connection {

        query(text: string): void;
    
        parse(query: { name?: string; text: string; types?: any[]; }, more: boolean): void;
        bind(config: { portal?: string; statement?: string; binary?: boolean; values: any[]; }, more: boolean): void;
        describe(msg: { type: string; name?: string; }, more: boolean): void;
        execute(config: { portal?: string; rows: number; }, more: boolean): void;
    
        flush(): void;
        sync(): void;
    }

    export interface Submittable {
        submit(connection: Connection): void;
        
        handleRowDescription(message: RowDescription): void;
        handleDataRow(message: DataRow): void;
        handleCommandComplete(message: CommandComplete, connection: Connection): void;
    
        handleReadyForQuery(connection: Connection): void;
        handleEmptyQuery(connection: Connection): void;
        handleError(error: Error, connection: Connection): void;
    
        handlePortalSuspended(connection: Connection): void;
        handleCopyInResponse(connection: Connection): void;
        handleCopyData(message: any, connection: Connection): void;
    }

    export interface RowDescription {
        name        : 'rowDescription';
        length      : number;
        fieldCount  : number;
        fields      : FieldDescription[];
    }
    
    export interface FieldDescription {
        name            : string;
        tableID         : number;
        columnID        : number;
        dataTypeID      : number;
        dataTypeSize    : number;
        dataTypeModifier: number;
        format          : string;
    }
    
    export interface DataRow {
        name            : 'dataRow';
        length          : number;
        fieldCount      : number;
        fields          : string[];
    }
    
    export interface CommandComplete {
        name            : 'commandComplete';
        length          : number;
        text            : string;
    }
}

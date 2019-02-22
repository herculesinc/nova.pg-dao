declare module "@nova/pg-dao" {

    // IMPORTS AND RE-EXPORTS
    // --------------------------------------------------------------------------------------------
    import { EventEmitter } from 'events';

    import { Dao, Logger, TraceSource, Exception } from '@nova/core';
    export { Dao, Logger, TraceSource, TraceCommand } from '@nova/core';

    // DATABASE
    // --------------------------------------------------------------------------------------------
    export interface DatabaseConfig {
        name?           : string;
        pool?           : PoolOptions;
        session?        : SessionOptions;
        connection      : ConnectionSettings;
    }

    export interface ConnectionSettings {
        host            : string;
        port?           : number;
        ssl?            : boolean;
        user            : string;
        password        : string;
        database        : string;
    }
    
    export interface PoolOptions {
        maxSize?        : number;
        idleTimeout?    : number;
        reapInterval?   : number;
    }

    export interface PoolState {
        readonly size   : number;
        readonly idle   : number;
    }

    export interface SessionOptions {
        readonly        : boolean;
        logQueryText    : boolean;
    }

    export class Database extends EventEmitter {

        constructor(config: DatabaseConfig);

        getPoolState(): PoolState;
        
        getSession(options?: Partial<SessionOptions>, logger?: Logger): DaoSession;
        close(): Promise<any>;

        on(event: 'error', listener: (error: Error) => void): this;
    }

    // DAO
    // --------------------------------------------------------------------------------------------
    export interface DaoSession {

        readonly inTransaction  : boolean;
        readonly isActive       : boolean;
        readonly isReadOnly     : boolean;
        
        execute<T>(query: SingleResultQuery<T>) : Promise<T | undefined>;
        execute<T>(query: ListResultQuery<T>)   : Promise<T[]>;
        execute(query: Query<void>)             : Promise<void>;

        close(action: 'commit' | 'rollback'): Promise<any>;
    }

    // RESULT HANDLER
    // --------------------------------------------------------------------------------------------
    export interface ResultHandler<T=any> {
        parse(rowData: string[], fields?: FieldDescriptor[]): T;
    }

    export interface FieldParser {
        (value: string): any;
    }

    export interface FieldDescriptor {
        readonly name       : string;
        readonly oid        : number;
        readonly parser     : FieldParser;
    }

    // QUERY
    // --------------------------------------------------------------------------------------------
    export type QueryMask = 'list' | 'single';
    export type QueryHandler<T=any> = typeof Object | typeof Array | ResultHandler<T>;

    export interface Query<T=any> {
        readonly text       : string;
        readonly name?      : string;
        readonly mask?      : QueryMask;
        readonly values?    : any[];
        readonly handler?   : QueryHandler<T>;
    }

    export const Query: {
        from(text: string): Query<void>;
        from(text: string, name: string): Query<void>;
        from<T=any>(text: string, name: string, mask: 'list'): ListResultQuery<T>;        
        from<T=any>(text: string, name: string, options: ListResultQueryOptions<T>): ListResultQuery<T>;
        from<T=any>(text: string, options: ListResultQueryOptions<T>): ListResultQuery<T>;
        from<T=any>(text: string, name: string, mask: 'single'): SingleResultQuery<T>;
        from<T=any>(text: string, name: string, options: SingleResultQueryOptions<T>): SingleResultQuery<T>;
        from<T=any>(text: string, options: SingleResultQueryOptions<T>): SingleResultQuery<T>;

        template(text: string): QueryTemplate<Query<void>>;
        template(text: string, name: string): QueryTemplate<Query<void>>;
        template<T=any>(text: string, name: string, mask: 'list'): QueryTemplate<ListResultQuery<T>>;
        template<T=any>(text: string, name: string, options: ListResultQueryOptions<T>): QueryTemplate<ListResultQuery<T>>;
        template<T=any>(text: string, options: ListResultQueryOptions<T>): QueryTemplate<ListResultQuery<T>>;
        template<T=any>(text: string, name: string, mask: 'single'): QueryTemplate<SingleResultQuery<T>>;
        template<T=any>(text: string, name: string, options: SingleResultQueryOptions<T>): QueryTemplate<SingleResultQuery<T>>;
        template<T=any>(text: string, options: SingleResultQueryOptions<T>): QueryTemplate<SingleResultQuery<T>>;
    }
    
    export interface ResultQuery<T=any> extends Query<T> {
        readonly mask       : QueryMask;
        readonly handler    : QueryHandler<T>;
    }
    
    export interface SingleResultQuery<T=any> extends ResultQuery<T> {
        readonly mask       : 'single';
    }
    
    export interface ListResultQuery<T> extends ResultQuery<T> {
        readonly mask       : 'list';
    }
    
    export interface ResultQueryOptions<T=any> {
        readonly name?      : string;
        readonly mask       : QueryMask;
        readonly handler?   : QueryHandler<T>;
    }
    
    export interface SingleResultQueryOptions<T=any> extends ResultQueryOptions<T> {
        readonly mask       : 'single';
        readonly handler?   : QueryHandler<T>;
    }
    
    export interface ListResultQueryOptions<T=any> extends ResultQueryOptions<T> {
        readonly mask       : 'list';
        readonly handler?   : QueryHandler<T>;
    }
    
    export interface QueryTemplate<T extends Query> {
        new(params: object): T;
    }

    // ERROR CLASSES
    // --------------------------------------------------------------------------------------------
    export class ConnectionError extends Exception {
        constructor(cause: Error);
	    constructor(message: string, cause?: Error);
    }

    export class QueryError extends Exception {
        constructor(cause: Error);
	    constructor(message: string, cause?: Error);
    }

    export class ParseError extends Exception {
        constructor(cause: Error);
	    constructor(message: string, cause?: Error);
    }
}
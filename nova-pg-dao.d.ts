declare module "@nova/pg-dao" {

    // IMPORTS AND RE-EXPORTS
    // --------------------------------------------------------------------------------------------
    import { EventEmitter } from 'events';

    import { Dao, Logger, TraceSource, Exception } from '@nova/core';
    export { Logger, TraceSource, TraceCommand } from '@nova/core';

    // DATABASE
    // --------------------------------------------------------------------------------------------
    export interface DatabaseConfig {
        name?           : string;
        pool?           : Partial<PoolOptions>;
        session?        : Partial<SessionOptions>;
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
        maxSize         : number;
        idleTimeout     : number;
        reapInterval    : number;
    }

    export interface PoolState {
        readonly size   : number;
        readonly idle   : number;
    }

    export interface SessionOptions {
        readonly        : boolean;
        checkImmutable  : boolean;
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

        getOne<T extends typeof Model>(type: T, id: string): InstanceType<T> | undefined;
        getAll<T extends typeof Model>(type: T): ReadonlyMap<string, InstanceType<T>>;

        fetchOne<T extends typeof Model>(type: T, selector: object, forUpdate?: boolean): Promise<InstanceType<T> | undefined>;
        fetchAll<T extends typeof Model>(type: T, selector: object, forUpdate?: boolean): Promise<InstanceType<T>[]>;

        load<T extends typeof Model>(type: T, seed: object): InstanceType<T>;
        create<T extends typeof Model>(type: T, seed: object): Promise<InstanceType<T>>;
        delete<T extends Model>(model: T): T;

        flush(): Promise<void>;
        close(action: 'commit' | 'rollback'): Promise<void>;
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
    export type QueryHandler<T=any> = typeof Object | typeof Array | typeof Model | ResultHandler<T>;

    export interface Query<T=any> {
        readonly text       : string;
        readonly name?      : string;
        readonly mask?      : QueryMask;
        readonly values?    : any[];
        readonly handler?   : QueryHandler<T>;
        readonly mutable?   : boolean;
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
    
    export interface ListResultQuery<T=any> extends ResultQuery<T> {
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
        readonly name?      : string;
        readonly mask       : 'list';
        readonly handler?   : QueryHandler<T>;
    }
    
    export interface QueryTemplate<T extends Query> {
        new(params: object): T;
    }

    // DATABASE SCHEMA
    // --------------------------------------------------------------------------------------------
    export type Timestamp = number;
    export namespace Timestamp {
        export function parse(value: any): Timestamp | undefined;
    }

    export type DbFieldType = typeof Number | typeof String | typeof Boolean | typeof Timestamp | typeof Date | typeof Object | typeof Array;

    export type Parser<T=any> = (value: string) => T;
    export type Serializer = (value: any) => string;
    export type Cloner<T=any> = (value: T) => T;
    export type Comparator = (value1: any, value2: any) => boolean;

    export interface FieldHandler {
        parse?      : Parser;
        serialize?  : Serializer;
        clone       : Cloner;
        areEqual    : Comparator;
    }

    export interface DbField {
        readonly name		: string;
        readonly snakeName	: string;
        readonly type		: DbFieldType;
        readonly readonly	: boolean;
        readonly areEqual?	: Comparator;
        readonly clone?		: Cloner;
        readonly parse?     : Parser;
        readonly serialize? : Serializer;
    }

    export interface DbFieldConfig {
        type		: DbFieldType;
        readonly?	: boolean;
        handler?	: FieldHandler;
    }

    export interface FieldMap {
        [fieldName: string]: DbFieldConfig;
    }

    export interface DbSchema {
        readonly name           : string;
        readonly table          : string;
        readonly idGenerator	: IdGenerator;
        readonly fields		    : ReadonlyArray<DbField>;

        hasField(fieldName: string) : boolean;
        getField(fieldNam: string)  : DbField | undefined;
    }

    // ID GENERATORS
    // --------------------------------------------------------------------------------------------
    export interface IdGenerator {
        getNextId(logger?: Logger, dao?: DaoSession): Promise<string>;
    }

    export class PgIdGenerator implements IdGenerator {
        constructor(idSequenceName: string);
        getNextId(logger?: Logger, dao?: DaoSession): Promise<string>;
    }

    export class GuidGenerator implements IdGenerator {
        constructor(options?: any);
        getNextId(): Promise<string>;
    }

    // DECORATORS
    // --------------------------------------------------------------------------------------------
    export function dbModel(table: string, idGenerator: IdGenerator): ClassDecorator;
    export function dbField(fieldType: DbFieldType, options?: dbFieldOptions): PropertyDecorator;

    export interface dbFieldOptions {
        readonly?   : boolean;
        handler?    : FieldHandler;
    }

    // MODELS
    // --------------------------------------------------------------------------------------------
    export class Model {

        constructor(seed: object, deepCopy?: boolean);
        constructor(rowData: string[], fields: FieldDescriptor[]);

        readonly id         : string;
        readonly createdOn  : number;
        readonly updatedOn  : number;

        infuse(rowData: string[], fields: FieldDescriptor[]): void;
        getSyncQueries(): Query[];

        isMutable: boolean;
        isCreated: boolean;
        isDeleted: boolean;
        isModified: boolean;

        static SelectQuery<T extends typeof Model>(this: T, mask: 'list'): SelectAllModelsQuery<InstanceType<T>>;
        static SelectQuery<T extends typeof Model>(this: T, mask: 'single'): SelectOneModelQuery<InstanceType<T>>;

        static setSchema(table: string, idGenerator: IdGenerator, fields: FieldMap): DbSchema;
        static getSchema(): DbSchema;
    }

    export interface SelectOneModelQuery<T=any> {
        new(mutable: boolean, selector?: object): SingleResultQuery<T> & ModelQueryInstance;
    }
    
    export interface SelectAllModelsQuery<T=any> {
        new(mutable: boolean, selector?: object): ListResultQuery<T> & ModelQueryInstance;
    }

    interface ModelQueryInstance {
        readonly mutable    : boolean;
        readonly select     : string;
        from                : string;
        where?              : string;
        readonly paramValues: any[];
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

    export class ModelError extends Exception {
        constructor(cause: Error);
	    constructor(message: string, cause?: Error);
    }
}
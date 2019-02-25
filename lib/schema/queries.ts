// IMPORTS
// ================================================================================================
import { QueryMask, ResultQuery, ResultHandler } from '@nova/pg-dao';
import { Query, stringifySingleParam, stringifyArrayParam } from '../Query';
import { Model } from '../Model';
import { ModelError, QueryError } from '../errors';
import { DbSchema } from './DbSchema';
import { DbField } from './DbField';

// INTERFACES
// ================================================================================================
export interface SelectModelQuery<T=any> {
    new(mask: QueryMask, mutable: boolean): ResultQuery<T>;
}

export interface FetchQueryClass {
    new(selector: object, mutable: boolean): ResultQuery;
}

export interface InsertQueryClass {
    new(params: object): Query<void>;
}

export interface UpdateQueryClass {
    new(params: object, changes: DbField[]): Query<void>;
}

export interface DeleteQueryClass {
    new(params: object): Query<void>;
}

// SELECT QUERY
// ================================================================================================
export function buildSelectQueryClass(schema: DbSchema, handler: ResultHandler): SelectModelQuery {

    const selectText = buildSelectText(schema);
    const fromText = schema.table;

    return class implements ResultQuery {

        readonly name       : string;
        readonly mask       : QueryMask;
        readonly handler    : ResultHandler;
        readonly mutable    : boolean;
        values?             : any[];

        readonly select     : string;
        from                : string;
        where?              : string;

        constructor(mask: QueryMask, mutable: boolean) {
            this.name		= this.constructor.name;
            this.mask       = mask;
            this.handler    = handler;
            this.mutable    = mutable || false;
            this.select     = selectText;
            this.from       = fromText;

            // TODO: add values
        }

        get text(): string {
            return `SELECT ${this.select} FROM ${this.from} WHERE ${this.where} ${ this.mutable ? 'FOR UPDATE' : ''};`;
        }
    } as SelectModelQuery;
}

// FETCH QUERY
// ================================================================================================
export function buildFetchQueryClass(schema: DbSchema, mask: QueryMask, handler: ResultHandler): FetchQueryClass {
    if (!schema) throw new ModelError('Cannot build a fetch query: model schema is undefined');
    
    const queryName = `qSelect${schema.name}Model${(mask === 'list' ? 's' : '')}`;
    const queryBase = `SELECT ${buildSelectText(schema)} FROM ${schema.table}`;
    
    return class implements ResultQuery {

        readonly name       : string;
        readonly mask       : QueryMask;
        readonly handler    : ResultHandler;
        readonly mutable    : boolean;

        text    : string;
        values? : any[];

        constructor(selector: any, mutable: boolean) {
            
            const values: any[] = [];
            const whereText = buildWhereText(schema, selector, values);
            
            this.name       = queryName;
            this.mask       = mask;
            this.handler    = handler;
            this.mutable    = mutable || false;
            this.text       = queryBase + ` WHERE ${whereText} ${ mutable ? 'FOR UPDATE' : ''};`;
            this.values     = values.length ? values : undefined;
        }
    };
}

// INSERT QUERY
// ================================================================================================
export function buildInsertQueryClass(schema: DbSchema): InsertQueryClass {
    if (!schema) throw new ModelError('Cannot build INSERT query template: model schema is undefined');
    
    const fields: string[] = [];
    const params: string[] = [];

    for (let field of schema.fields) {
        fields.push(field.snakeName);
        params.push(`{{${field.name}}}`);
    }

    const name = `qInsert${schema.name}Model`;
    const text = `INSERT INTO ${schema.table} (${fields.join(',')}) VALUES (${params.join(',')});`;

    return Query.template(text, name);
}

// UPDATE QUERY
// ================================================================================================
export function buildUpdateQueryClass(schema: DbSchema): UpdateQueryClass {
    if (!schema) throw new ModelError('Cannot build UPDATE query: model schema is undefined');
    
    const queryName = `qUpdate${schema.name}Model`;
    const queryBase = `UPDATE ${schema.table} SET`;
    
    return class implements Query {

        name    : string;
        text    : string;
        values? : any[];

        constructor(model: Model, changes: DbField[]) {
            
            const values: any[] = [];
            const setters: string[] = [];
            for (let field of changes) {
                let paramValue = model[field.name as keyof Model];
                if (field.serialize) {
                    // make sure custom serialization is respected
                    paramValue = field.serialize(paramValue);
                }
                setters.push(`${field.snakeName}=${stringifySingleParam(paramValue, values)}`);
            }

            this.name = queryName;
            this.text = queryBase + ` ${setters.join(', ')} WHERE id = '${model.id}';`;
            this.values = values.length ? values : undefined;
        }
    } as UpdateQueryClass;
}

// DELETE QUERY
// ================================================================================================
export function buildDeleteQueryClass(schema: DbSchema): DeleteQueryClass {
    if (!schema) throw new ModelError('Cannot build DELETE query template: model schema is undefined');
    
    const name = `qDelete${schema.name}Model`
    const text = `DELETE FROM ${schema.table} WHERE id = {{id}};`;

    return Query.template(text, name);
}

// HELPER FUNCTIONS
// ================================================================================================
function buildSelectText(schema: DbSchema): string {

    const fieldGetters: string[] = [];
    for (let field of schema.fields) {
        if (field.name === field.snakeName) {
            fieldGetters.push(field.name);
        }
        else {
            fieldGetters.push(`${field.snakeName} AS "${field.name}"`);
        }
    }

    return fieldGetters.join(',');
}

function buildWhereText(schema: DbSchema, selector: any, values: any[]): string {
    
    const criteria: string[] = [];

    // TODO: validate that selector is an object
    for (let filter in selector) {
        let field = schema.getField(filter);
        if (!field) {
            throw new QueryError('Cannot build a fetch query: model selector and schema are incompatible'); // TODO: model error?
        }

        // TODO: check for custom serialization?
        let paramValue = selector[filter];
        if (paramValue && Array.isArray(paramValue)) {
            criteria.push(`${field.snakeName} IN (${stringifyArrayParam(paramValue, values)})`);
        }
        else {
            criteria.push(`${field.snakeName}=${stringifySingleParam(paramValue, values)}`);
        }
    }

    return criteria.join(' AND ');
}
// IMPORTS
// ================================================================================================
import { Model, ModelSelector, QueryMask, ResultQuery } from '@nova/pg-dao';
import { Query, stringifySingleParam, stringifyArrayParam } from '../Query';
import { ModelError } from '../errors';
import { DbSchema } from './DbSchema';
import { DbField } from './DbField';
import { Condition } from './operators';

// INTERFACES
// ================================================================================================
export interface SelectModelQuery<T=any> {
    new(mutable: boolean, selector?: ModelSelector): ResultQuery<T>;
}

export interface InsertModelQuery {
    new(params: object): Query<void>;
}

export interface UpdateModelQuery {
    new(params: object, changes: DbField[]): Query<void>;
}

export interface DeleteModelQuery {
    new(params: object): Query<void>;
}

// SELECT QUERY
// ================================================================================================
export function buildSelectQueryClass(schema: DbSchema, mask: QueryMask, modelType: typeof Model): SelectModelQuery {

    const queryName = `qSelect${schema.name}Model${(mask === 'list' ? 's' : '')}`;
    const selectText = buildSelectText(schema);
    const fromText = schema.table;

    return class implements ResultQuery {

        readonly name       : string;
        readonly mask       : QueryMask;
        readonly handler    : typeof Model;
        readonly mutable    : boolean;

        readonly select     : string;
        from                : string;
        where?              : string;
        values?             : any[];

        constructor(mutable: boolean, selector?: ModelSelector) {
            this.name		= this.constructor.name || queryName;
            this.mask       = mask;
            this.handler    = modelType;
            this.mutable    = mutable || false;
            this.select     = selectText;
            this.from       = fromText;

            if (selector) {
                this.values = [];
                this.where  = buildWhereText(schema, selector, this.values);
                if (this.values.length === 0) {
                    this.values = undefined;
                }
            }
        }

        get text(): string {
            if (this.where === undefined) {
                throw new ModelError(`Invalid SELECT query for ${this.name} model: WHERE condition is undefined`);
            }
            return `SELECT ${this.select} FROM ${this.from} WHERE ${this.where}${ this.mutable ? ' FOR UPDATE' : ''};`;
        }
    };
}

// INSERT QUERY
// ================================================================================================
export function buildInsertQueryClass(schema: DbSchema): InsertModelQuery {
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
export function buildUpdateQueryClass(schema: DbSchema): UpdateModelQuery {
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
                    try {
                        // make sure custom serialization is respected
                        paramValue = field.serialize(paramValue);
                    }
                    catch (error) {
                        throw new ModelError(`Failed to serialize ${schema.name} model`, error);
                    }
                }
                setters.push(`${field.snakeName}=${stringifySingleParam(paramValue, values)}`);
            }

            this.name = queryName;
            this.text = queryBase + ` ${setters.join(', ')} WHERE id = '${model.id}';`;
            this.values = values.length ? values : undefined;
        }
    } as UpdateModelQuery;
}

// DELETE QUERY
// ================================================================================================
export function buildDeleteQueryClass(schema: DbSchema): DeleteModelQuery {
    if (!schema) throw new ModelError('Cannot build DELETE query template: model schema is undefined');

    const name = `qDelete${schema.name}Model`;
    const text = `DELETE FROM ${schema.table} WHERE id = {{id}};`;

    return Query.template(text, name);
}

// HELPER FUNCTIONS
// ================================================================================================
function buildSelectText(schema: DbSchema): string {

    const fieldGetters: string[] = [];
    for (let field of schema.fields) {
        if (field.name === field.snakeName) {
            fieldGetters.push(`${schema.table}.${field.name}`);
        }
        else {
            fieldGetters.push(`${schema.table}.${field.snakeName} AS "${field.name}"`);
        }
    }

    return fieldGetters.join(', ');
}

function buildWhereText(schema: DbSchema, selector: ModelSelector, values: any[]): string {

    let where: string;

    if (typeof selector === 'string') {
        where = selector;
    }
    else if (typeof selector === 'object') {
        if (Array.isArray(selector)) {
            const filters: string[] = [];
            for (let i = 0; i < selector.length; i++) {
                filters.push('(' + buildFilter(schema, selector[i], values) + ')');
            }
            where = filters.join(' OR ');
        }
        else {
            where = buildFilter(schema, selector, values);
        }
    }
    else {
        throw new TypeError('Cannot build a fetch query: model selector is invalid');
    }

    return where;
}

function buildFilter(schema: DbSchema, selector: any, values: any[]): string {
    if (!selector) throw new TypeError('Cannot build a fetch query: model selector is invalid');

    const criteria: string[] = [];
    for (let fieldName in selector) {
        let field = schema.getField(fieldName);
        if (!field) {
            throw new ModelError('Cannot build fetch query: model selector and schema are incompatible');
        }

        // TODO: check for custom serialization?
        let paramValue = selector[fieldName];
        if (Array.isArray(paramValue)) {
            criteria.push(`${schema.table}.${field.snakeName} IN (${stringifyArrayParam(paramValue, values)})`);
        }
        else if (Condition.isCondition(paramValue)) {
            criteria.push(Condition.stringify(paramValue, schema.table, field, values));
        }
        else {
            criteria.push(`${schema.table}.${field.snakeName}=${stringifySingleParam(paramValue, values)}`);
        }
    }
    return criteria.join(' AND ');
}

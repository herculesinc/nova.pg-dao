// IMPORTS
// ================================================================================================
import { QueryMask, ResultQuery, ResultHandler, QueryTemplate } from '@nova/pg-dao';
import { Query, stringifySingleParam, stringifyArrayParam } from '../Query';
import { Model } from '../Model';
import { ModelError, QueryError } from '../errors';
import { DbSchema } from './DbSchema';
import { DbField } from './DbField';

// INTERFACES
// ================================================================================================
export interface UpdateQueryTemplate {
    new(params: any, changes: DbField[]): Query;
}

export interface SelectQueryTemplate {
    new(selector: any, forUpdate: boolean): ResultQuery;
}

// FETCH QUERY
// ================================================================================================
export function buildSelectQueryTemplate(schema: DbSchema, mask: QueryMask, handler: ResultHandler): SelectQueryTemplate {
    if (!schema) throw new ModelError('Cannot build a fetch query: model schema is undefined');
    
    const queryName = `qSelect${schema.name}Model${(mask === 'list' ? 's' : '')}`;
    const queryBase = schema.selectSql;
    
    return class implements ResultQuery {

        name    : string;
        mask    : QueryMask;
        handler : ResultHandler;
        text    : string;
        values? : any[];

        constructor(selector: any, forUpdate: boolean) {
            
            const values: any[] = [];
            const criteria: string[] = [];
            for (let filter in selector) {
                let field = schema.getField(filter);
                if (!field) {
                    throw new QueryError('Cannot build a fetch query: model selector and schema are incompatible');
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
            
            this.name = queryName;
            this.text = queryBase + ` WHERE ${criteria.join(' AND ')} ${ forUpdate ? 'FOR UPDATE' : ''};`;
            this.values = values.length ? values : undefined;
            this.handler = handler;
            this.mask = mask;
        }
    };
}

// INSERT QUERY
// ================================================================================================
export function buildInsertQueryTemplate(schema: DbSchema): QueryTemplate<any> {
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
export function buildUpdateQueryTemplate(schema: DbSchema): UpdateQueryTemplate {
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
    };
}

// DELETE QUERY
// ================================================================================================
export function buildDeleteQueryTemplate(schema: DbSchema): QueryTemplate<any> {
    if (!schema) throw new ModelError('Cannot build DELETE query template: model schema is undefined');
    
    const name = `qDelete${schema.name}Model`
    const text = `DELETE FROM ${schema.table} WHERE id = {{id}};`;

    return Query.template(text, name);
}
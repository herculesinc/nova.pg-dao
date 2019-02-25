// IMPORTS
// ================================================================================================
import { FieldDescriptor, Query, ListResultQuery, SingleResultQuery, IdGenerator, FieldMap, } from '@nova/pg-dao';
import { DbSchema, DbField, FetchQueryClass, InsertQueryClass, UpdateQueryClass, DeleteQueryClass, queries } from './schema';
import { ModelError } from './errors';

// MODULE VARIABLES
// ================================================================================================
export const symDeleted = Symbol();
export const symCreated = Symbol();
export const symMutable = Symbol();

const symOriginal = Symbol();

// PUBLIC FUNCTIONS
// ================================================================================================
export function getModelClass(model: Model): typeof Model {
    if (!model) throw new TypeError('Model is undefined');
    const modelClass = model.constructor as typeof Model;
    if (modelClass.prototype instanceof Model === false) {
        throw new TypeError('Model is invalid');
    } 
    return modelClass;
}

export function isModelClass(modelClass: any): modelClass is typeof Model {
    if (!modelClass) throw TypeError('Model class is undefined');
    if (!modelClass.prototype) return false;
    return modelClass.prototype instanceof Model;
}

// CLASS DEFINITION
// ================================================================================================
export class Model {

    private static schema   : DbSchema;

    static qFetchOneModel   : FetchQueryClass;
    static qFetchAllModels  : FetchQueryClass;
    static qInsertModel     : InsertQueryClass;
    static qUpdateModel     : UpdateQueryClass;
    static qDeleteModel     : DeleteQueryClass;

    readonly id!            : string;    
    readonly createdOn!     : number;
    updatedOn!              : number;

    [symOriginal]           : any;

    [symMutable]            : boolean;
    [symCreated]            : boolean;
    [symDeleted]            : boolean;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(seed: string[] | object, fields: FieldDescriptor[]) {
        if (!seed) throw new TypeError('Model seed is undefined');

        if (Array.isArray(seed)) {
            if (!fields) throw new TypeError('Models fields are undefined');
            if (!Array.isArray(fields)) throw new TypeError('Model fields are invalid');
            this.infuse(seed, fields);
        }
        else {
            // TODO: build model
        }

        // initialize internal state
        this[symMutable] = false;
        this[symCreated] = false;
        this[symDeleted] = false;
    }

    // STATIC METHODS
    // --------------------------------------------------------------------------------------------
    static parse<T extends typeof Model>(this: T, rowData: string[], fields: FieldDescriptor[]): InstanceType<T> {
        return (new this(rowData, fields) as InstanceType<T>);
    }

    /*
    static SelectQueryBase<T extends typeof Model>(this: T, mask: 'list'): SelectModelQuery2<InstanceType<T>>
    static SelectQueryBase<T extends typeof Model>(this: T, mask: 'single'): SelectModelQuery<InstanceType<T>>
    static SelectQueryBase<T extends typeof Model>(this: T, mask: QueryMask): any {
        return this.SelectQuery as any;
    }
    */

    static getFetchOneQuery<T extends typeof Model>(this: T, selector: any, forUpdate: boolean): SingleResultQuery<InstanceType<T>> {
        return (new this.qFetchOneModel(selector, forUpdate) as SingleResultQuery<InstanceType<T>>);
    }

    static getFetchAllQuery<T extends typeof Model>(selector: any, forUpdate: boolean): ListResultQuery<InstanceType<T>> {
        return (new this.qFetchAllModels(selector, forUpdate) as ListResultQuery<InstanceType<T>>);
    }

    static setSchema(tableName: string, idGenerator: IdGenerator, fields: FieldMap) {
        // create and set schema
        const modelName = this.name;
        if (this.schema) throw new ModelError(`Cannot set model schema: schema for ${modelName} model has already been set`);
        const schema = new DbSchema(modelName, tableName, idGenerator, fields);
        this.schema = schema;

        // build query templates
        this.qFetchAllModels = queries.buildFetchQueryClass(schema, 'list', this);
        this.qFetchOneModel = queries.buildFetchQueryClass(schema, 'single', this);
        this.qInsertModel = queries.buildInsertQueryClass(schema);
        this.qUpdateModel = queries.buildUpdateQueryClass(schema);
        this.qDeleteModel = queries.buildDeleteQueryClass(schema);

        // this.SelectQuery = queries.buildSelectQueryClass(schema, this);
    }

    static getSchema(): DbSchema {
        return this.schema;
    }

    // STATE ACCESSORS
    // --------------------------------------------------------------------------------------------
    get isMutable(): boolean {
        return this[symMutable];
    }

    get isCreated(): boolean {
        return this[symCreated];
    }

    get isDeleted(): boolean {
        return this[symDeleted];
    }

    get isModified(): boolean {
        const schema = (this.constructor as typeof Model).getSchema();
        const original = this[symOriginal];

        for (let field of schema.fields) {
            if (field.readonly) continue;

            let fieldName = field.name as keyof this;
            if (field.areEqual) {
                if (!field.areEqual(this[fieldName], original[fieldName])) return true;
            }
            else {
                if (this[fieldName] !== original[fieldName]) return true;
            }
        }

        return false;
    }

    // MODEL METHODS
    // --------------------------------------------------------------------------------------------
    infuse(rowData: string[], dbFields: FieldDescriptor[]) {
        const schema = (this.constructor as typeof Model).getSchema();
        const original: any = {};
        for (let i = 0; i < schema.fields.length; i++) {
            let field = schema.fields[i];
            let fieldName = field.name as keyof this;
            let fieldValue = field.parse ? field.parse(rowData[i]) : dbFields[i].parser(rowData[i]);
            this[fieldName] = fieldValue;

            // don't keep originals of read-only fields
            if (field.readonly) continue;
            original[fieldName] = field.clone ? field.clone(fieldValue) : fieldValue;
        }
        this[symOriginal] = original;
    }

    getSyncQueries(): Query[] {
        const queries: Query[] = [];

        if (this[symCreated]) {
            queries.push(this.buildInsertQuery());
        }
        else if (this[symDeleted]) {
            queries.push(this.buildDeleteQuery());
        }
        else {
            // check if any fields have changed
            const schema = (this.constructor as typeof Model).getSchema();
            const original = this[symOriginal];
            const changes: DbField[] = [];
            for (let field of schema.fields) {
                if (field.readonly) continue;

                let fieldName = field.name as keyof this;
                if (field.areEqual) {
                    if (!field.areEqual(original[fieldName], this[fieldName])) {
                        changes.push(field);
                    }
                }
                else {
                    if (original[fieldName] !== this[fieldName]) {
                        changes.push(field);
                    }
                }
            }

            if (changes.length > 0) {
                queries.push(this.buildUpdateQuery(changes));
            }
        }

        return queries;
    }

    applyChanges() {
        const schema = (this.constructor as typeof Model).getSchema();
        const original: any = {};
        for (let field of schema.fields) {
            if (field.readonly) continue;
            let fieldName = field.name as keyof this;
            let fieldValue = this[fieldName];
            original[fieldName] = field.clone ? field.clone(fieldValue) : fieldValue;
        }
        this[symOriginal] = original;
    }

    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    private buildInsertQuery() {
        const schema = (this.constructor as typeof Model).getSchema();
        const qInsertModel = (this.constructor as typeof Model).qInsertModel;
        
        // make sure fields with custom serialization are treaded correctly
        if (schema.hasCustomSerializers) {
            const params: any = {};
            for (let field of schema.fields) {
                let fieldName = field.name as keyof this;
                let fieldValue = this[fieldName];
                params[fieldName] = field.serialize ? field.serialize(fieldValue) : fieldValue;
            }
            return new qInsertModel(params);
        }
        else {
            return new qInsertModel(this);
        }
    }

    private buildUpdateQuery(changes: DbField[]) {
        const qUpdateModel = (this.constructor as typeof Model).qUpdateModel;
        return new qUpdateModel(this, changes);
    }

    private buildDeleteQuery() {
        const qDeleteModel = (this.constructor as typeof Model).qDeleteModel;
        return new qDeleteModel(this);
    }
}
// IMPORTS
// ================================================================================================
import { FieldDescriptor, Query, SelectAllModelsQuery, SelectOneModelQuery, IdGenerator, FieldMap, QueryMask } from '@nova/pg-dao';
import { DbSchema, DbField, SelectModelQuery, InsertModelQuery, UpdateModelQuery, DeleteModelQuery, queries } from './schema';
import { ModelError } from './errors';

// MODULE VARIABLES
// ================================================================================================
export const symDeleted = Symbol('deleted');
export const symCreated = Symbol('created');
export const symMutable = Symbol('mutable');

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

    static qSelectOneModel  : SelectModelQuery;
    static qSelectAllModels : SelectModelQuery;
    static qInsertModel     : InsertModelQuery;
    static qUpdateModel     : UpdateModelQuery;
    static qDeleteModel     : DeleteModelQuery;

    readonly id!            : string;    
    readonly createdOn!     : number;
    updatedOn!              : number;

    [symOriginal]           : any;

    [symMutable]            : boolean;
    [symCreated]            : boolean;
    [symDeleted]            : boolean;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(seed: string[] | object, fieldsOrClone: FieldDescriptor[] | boolean) {
        if (!seed) throw new TypeError('Model seed is undefined');

        if (Array.isArray(seed)) {
            // the model is being built from database row
            if (!fieldsOrClone) throw new TypeError('Models fields are undefined');
            if (!Array.isArray(fieldsOrClone)) throw new TypeError('Model fields are invalid');
            this.infuse(seed, fieldsOrClone);
        }
        else {
            // the model is being built from an object
            if (typeof seed !== 'object') throw new TypeError('Model seed is invalid');
            const clone = (fieldsOrClone === undefined) ? false: fieldsOrClone;
            if (typeof clone !== 'boolean') throw new TypeError('Clone flag is invalid');

            const schema = (this.constructor as typeof Model).getSchema();
            if (clone) {
                // make a deep copy of the seed
                for (let field of schema.fields) {
                    let fieldName = field.name as keyof this;
                    let seedValue = (seed as any)[fieldName];
                    this[fieldName] = field.clone ? field.clone(seedValue) : seedValue;
                }
            }
            else {
                // make a shallow copy of the seed
                for (let field of schema.fields) {
                    this[field.name as keyof this] = (seed as any)[field.name];
                }
            }
        }

        // validate required fields
        if (!this.id) throw new ModelError('Model ID is undefined');
        if (!this.createdOn) throw new ModelError('Model createdOn is undefined');
        if (!this.updatedOn) throw new ModelError('Model updatedOn is undefined');
        
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

    static SelectQuery<T extends typeof Model>(this: T, mask: 'list'): SelectAllModelsQuery<InstanceType<T>>
    static SelectQuery<T extends typeof Model>(this: T, mask: 'single'): SelectOneModelQuery<InstanceType<T>>
    static SelectQuery<T extends typeof Model>(this: T, mask: QueryMask): any {
        if (mask === 'single') {
            return this.qSelectOneModel;
        }
        else if (mask === 'list') {
            return this.qSelectAllModels;
        }
        else {
            throw new TypeError(`Cannot get SelectQuery template for ${this.name} model: mask '${mask}' is invalid`)
        }
    }

    static setSchema(tableName: string, idGenerator: IdGenerator, fields: FieldMap) {
        // create and set schema
        const modelName = this.name;
        if (this.schema) throw new ModelError(`Cannot set model schema: schema for ${modelName} model has already been set`);
        const schema = new DbSchema(modelName, tableName, idGenerator, fields);
        this.schema = schema;

        // build query templates
        this.qSelectAllModels = queries.buildSelectQueryClass(schema, 'list', this);
        this.qSelectOneModel = queries.buildSelectQueryClass(schema, 'single', this);
        this.qInsertModel = queries.buildInsertQueryClass(schema);
        this.qUpdateModel = queries.buildUpdateQueryClass(schema);
        this.qDeleteModel = queries.buildDeleteQueryClass(schema);
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
        
        // make sure fields with custom serialization are treated correctly
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


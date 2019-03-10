// IMPORTS
// ================================================================================================
import { FieldDescriptor, Query, SelectAllModelsQuery, SelectOneModelQuery, IdGenerator, FieldMap, QueryMask, SaveOriginalMethod } from '@nova/pg-dao';
import { DbSchema, DbField, SelectModelQuery, InsertModelQuery, UpdateModelQuery, DeleteModelQuery, queries } from './schema';
import { ModelError } from './errors';
import { guidGenerator } from './schema/idGenerators';

// MODULE VARIABLES
// ================================================================================================
export const symMutable = Symbol('mutable');
export const symCreated = Symbol('created');
export const symDeleted = Symbol('deleted');

const symOriginal = Symbol('original');

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
    constructor(seed: string[] | object, fieldsOrDeepCopy?: FieldDescriptor[] | boolean, saveOriginal?: SaveOriginalMethod) {
        const schema = (this.constructor as typeof Model).getSchema();

        if (Array.isArray(seed)) {
            // the model is being built from database row
            if (!Array.isArray(fieldsOrDeepCopy)) throw new TypeError('Model fields are invalid');
            if (saveOriginal) {
                this[symOriginal] = {};
            }
            this.infuse(seed, fieldsOrDeepCopy, saveOriginal === SaveOriginalMethod.saveAllFields);
        }
        else {
            // the model is being built from an object
            if (!seed || typeof seed !== 'object') throw new TypeError('Model seed is invalid');
            const deepCopy = (fieldsOrDeepCopy === undefined) ? false: fieldsOrDeepCopy;
            if (typeof deepCopy !== 'boolean') throw new TypeError('Clone flag is invalid');

            if (deepCopy) {
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

            this[symOriginal] = undefined;
        }

        // validate required fields
        if (!this.id || typeof this.id !== 'string') throw new ModelError(`Failed to build ${schema.name} model: model ID is invalid'`);
        if (!this.createdOn || typeof this.createdOn !== 'number') throw new ModelError(`Failed to build ${schema.name} model: createdOn is invalid`);
        if (!this.updatedOn || typeof this.updatedOn !== 'number') throw new ModelError(`Failed to build ${schema.name} model: updatedOn is invalid`);

        // initialize internal state
        this[symMutable] = false;
        this[symCreated] = false;
        this[symDeleted] = false;
    }

    // STATIC METHODS
    // --------------------------------------------------------------------------------------------
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

    static setSchema(tableName: string, idGeneratorOrFields: IdGenerator | FieldMap, fields?: FieldMap): DbSchema {
        // create and set schema
        const modelName = this.name;
        if (this.schema) throw new ModelError(`Cannot set model schema: schema for ${modelName} model has already been set`);

        let idGenerator: IdGenerator;
        if (!fields) {
            idGenerator = guidGenerator;
            fields = idGeneratorOrFields as FieldMap;
        }
        else {
            idGenerator = idGeneratorOrFields as IdGenerator;
        }

        const schema = new DbSchema(modelName, tableName, idGenerator, fields);
        this.schema = schema;

        // build query templates
        this.qSelectAllModels = queries.buildSelectQueryClass(schema, 'list', this as any);
        this.qSelectOneModel = queries.buildSelectQueryClass(schema, 'single', this as any);
        this.qInsertModel = queries.buildInsertQueryClass(schema);
        this.qUpdateModel = queries.buildUpdateQueryClass(schema);
        this.qDeleteModel = queries.buildDeleteQueryClass(schema);

        return schema;
    }

    static getSchema(): DbSchema {
        return this.schema;
    }

    // STATE ACCESSORS
    // --------------------------------------------------------------------------------------------
    isMutable(): boolean {
        return this[symMutable];
    }

    isCreated(): boolean {
        return this[symCreated];
    }

    isDeleted(): boolean {
        return this[symDeleted];
    }

    hasChanged(checkReadonlyFields = true): boolean {
        const schema = (this.constructor as typeof Model).getSchema();
        const original = this[symOriginal];
        if (!original) return false;

        try {
            for (let field of schema.fields) {
                if (!checkReadonlyFields && field.readonly) continue;
    
                let fieldName = field.name as keyof this;
                if (field.areEqual) {
                    if (!field.areEqual(this[fieldName], original[fieldName])) return true;
                }
                else {
                    if (this[fieldName] !== original[fieldName]) return true;
                }
            }
        }
        catch (error) {
            throw new ModelError(`Failed to identify changes in ${schema.name} model`, error);
        }

        return false;
    }

    // INTERNAL METHODS
    // --------------------------------------------------------------------------------------------
    infuse(rowData: string[], dbFields: FieldDescriptor[], cloneReadonlyFields = true) {
        const fields = (this.constructor as typeof Model).getSchema().fields;
        if (fields.length !== rowData.length) throw new ModelError('Model row data is inconsistent');
        if (fields.length !== dbFields.length) throw new ModelError('Model fields are inconsistent');

        const original = this[symOriginal];
        try {
            for (let i = 0; i < fields.length; i++) {
                let field = fields[i];
                let fieldName = field.name as keyof this;
                let fieldValue = field.parse ? field.parse(rowData[i]) : dbFields[i].parser(rowData[i]);
                this[fieldName] = fieldValue;
    
                if (original) {
                    // don't keep originals of read-only fields when not needed
                    if (!cloneReadonlyFields && field.readonly) continue;
                    original[fieldName] = field.clone ? field.clone(fieldValue) : fieldValue;
                }
            }
        }
        catch (error) {
            const schema = (this.constructor as typeof Model).getSchema();
            throw new ModelError(`Failed to build ${schema.name} model`, error)
        }
        this[symOriginal] = original;
    }

    saveOriginal(cloneReadonlyFields: boolean) {
        const schema = (this.constructor as typeof Model).getSchema();
        const original: any = {};

        try {
            for (let field of schema.fields) {
                if (!cloneReadonlyFields && field.readonly) continue;
                let fieldName = field.name as keyof this;
                let fieldValue = this[fieldName];
                original[fieldName] = field.clone ? field.clone(fieldValue) : fieldValue;
            }
    
            this[symOriginal] = original;
        }
        catch (error) {
            throw new ModelError(`Failed to clone ${schema.name} model`, error);
        }
    }

    clearOriginal() {
        this[symOriginal] = undefined;
    }

    // PROTECTED METHODS
    // --------------------------------------------------------------------------------------------
    getOriginal() {
        return this[symOriginal];
    }

    getSyncQueries(updatedOn: number, checkReadonlyFields = true): Query[] | undefined {
        if (this[symCreated]) {
            return [this.buildInsertQuery()];
        }
        else if (this[symDeleted]) {
            return [this.buildDeleteQuery()];
        }
        else {
            const schema = (this.constructor as typeof Model).getSchema();
            const changes = this.getChanges(checkReadonlyFields);
            if (changes && changes.length > 0) {
                this.updatedOn = updatedOn;
                changes.push(schema.getField('updatedOn')!);
                return [this.buildUpdateQuery(changes)];
            }
        }
    }

    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    private getChanges(checkReadonlyFields: boolean) {
        
        // check if the model has original values
        const original = this[symOriginal];
        if (!original) return undefined;

        // check if any fields have changed
        const schema = (this.constructor as typeof Model).getSchema();
        const changes: DbField[] = [];
        try {
            for (let field of schema.fields) {
                if (!checkReadonlyFields && field.readonly) continue;

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
        }
        catch(error) {
            throw new ModelError(`Failed to identify changes in ${schema.name} model`, error);
        }

        return changes;
    }

    private buildInsertQuery() {
        const schema = (this.constructor as typeof Model).getSchema();
        const qInsertModel = (this.constructor as typeof Model).qInsertModel;

        // make sure fields with custom serialization are treated correctly
        if (schema.hasCustomSerializers) {
            try {
                const params: any = {};
                for (let field of schema.fields) {
                    let fieldName = field.name as keyof this;
                    let fieldValue = this[fieldName];
                    params[fieldName] = field.serialize ? field.serialize(fieldValue) : fieldValue;
                }
                return new qInsertModel(params);
            }
            catch (error) {
                throw new ModelError(`Failed to serialize ${schema.name} model`, error);
            }
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

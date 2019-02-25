"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const schema_1 = require("./schema");
const errors_1 = require("./errors");
// MODULE VARIABLES
// ================================================================================================
exports.symDeleted = Symbol();
exports.symCreated = Symbol();
exports.symMutable = Symbol();
const symOriginal = Symbol();
// PUBLIC FUNCTIONS
// ================================================================================================
function getModelClass(model) {
    if (!model)
        throw new TypeError('Model is undefined');
    const modelClass = model.constructor;
    if (modelClass.prototype instanceof Model === false) {
        throw new TypeError('Model is invalid');
    }
    return modelClass;
}
exports.getModelClass = getModelClass;
function isModelClass(modelClass) {
    if (!modelClass)
        throw TypeError('Model class is undefined');
    if (!modelClass.prototype)
        return false;
    return modelClass.prototype instanceof Model;
}
exports.isModelClass = isModelClass;
// CLASS DEFINITION
// ================================================================================================
class Model {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(seed, fields) {
        if (!seed)
            throw new TypeError('Model seed is undefined');
        if (Array.isArray(seed)) {
            if (!fields)
                throw new TypeError('Models fields are undefined');
            if (!Array.isArray(fields))
                throw new TypeError('Model fields are invalid');
            this.infuse(seed, fields);
        }
        else {
            // TODO: build model
        }
        // initialize internal state
        this[exports.symMutable] = false;
        this[exports.symCreated] = false;
        this[exports.symDeleted] = false;
    }
    // STATIC METHODS
    // --------------------------------------------------------------------------------------------
    static parse(rowData, fields) {
        return new this(rowData, fields);
    }
    /*
    static SelectQueryBase<T extends typeof Model>(this: T, mask: 'list'): SelectModelQuery2<InstanceType<T>>
    static SelectQueryBase<T extends typeof Model>(this: T, mask: 'single'): SelectModelQuery<InstanceType<T>>
    static SelectQueryBase<T extends typeof Model>(this: T, mask: QueryMask): any {
        return this.SelectQuery as any;
    }
    */
    static getFetchOneQuery(selector, forUpdate) {
        return new this.qFetchOneModel(selector, forUpdate);
    }
    static getFetchAllQuery(selector, forUpdate) {
        return new this.qFetchAllModels(selector, forUpdate);
    }
    static setSchema(tableName, idGenerator, fields) {
        // create and set schema
        const modelName = this.name;
        if (this.schema)
            throw new errors_1.ModelError(`Cannot set model schema: schema for ${modelName} model has already been set`);
        const schema = new schema_1.DbSchema(modelName, tableName, idGenerator, fields);
        this.schema = schema;
        // build query templates
        this.qFetchAllModels = schema_1.queries.buildFetchQueryClass(schema, 'list', this);
        this.qFetchOneModel = schema_1.queries.buildFetchQueryClass(schema, 'single', this);
        this.qInsertModel = schema_1.queries.buildInsertQueryClass(schema);
        this.qUpdateModel = schema_1.queries.buildUpdateQueryClass(schema);
        this.qDeleteModel = schema_1.queries.buildDeleteQueryClass(schema);
        // this.SelectQuery = queries.buildSelectQueryClass(schema, this);
    }
    static getSchema() {
        return this.schema;
    }
    // STATE ACCESSORS
    // --------------------------------------------------------------------------------------------
    get isMutable() {
        return this[exports.symMutable];
    }
    get isCreated() {
        return this[exports.symCreated];
    }
    get isDeleted() {
        return this[exports.symDeleted];
    }
    get isModified() {
        const schema = this.constructor.getSchema();
        const original = this[symOriginal];
        for (let field of schema.fields) {
            if (field.readonly)
                continue;
            let fieldName = field.name;
            if (field.areEqual) {
                if (!field.areEqual(this[fieldName], original[fieldName]))
                    return true;
            }
            else {
                if (this[fieldName] !== original[fieldName])
                    return true;
            }
        }
        return false;
    }
    // MODEL METHODS
    // --------------------------------------------------------------------------------------------
    infuse(rowData, dbFields) {
        const schema = this.constructor.getSchema();
        const original = {};
        for (let i = 0; i < schema.fields.length; i++) {
            let field = schema.fields[i];
            let fieldName = field.name;
            let fieldValue = field.parse ? field.parse(rowData[i]) : dbFields[i].parser(rowData[i]);
            this[fieldName] = fieldValue;
            // don't keep originals of read-only fields
            if (field.readonly)
                continue;
            original[fieldName] = field.clone ? field.clone(fieldValue) : fieldValue;
        }
        this[symOriginal] = original;
    }
    getSyncQueries() {
        const queries = [];
        if (this[exports.symCreated]) {
            queries.push(this.buildInsertQuery());
        }
        else if (this[exports.symDeleted]) {
            queries.push(this.buildDeleteQuery());
        }
        else {
            // check if any fields have changed
            const schema = this.constructor.getSchema();
            const original = this[symOriginal];
            const changes = [];
            for (let field of schema.fields) {
                if (field.readonly)
                    continue;
                let fieldName = field.name;
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
        const schema = this.constructor.getSchema();
        const original = {};
        for (let field of schema.fields) {
            if (field.readonly)
                continue;
            let fieldName = field.name;
            let fieldValue = this[fieldName];
            original[fieldName] = field.clone ? field.clone(fieldValue) : fieldValue;
        }
        this[symOriginal] = original;
    }
    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    buildInsertQuery() {
        const schema = this.constructor.getSchema();
        const qInsertModel = this.constructor.qInsertModel;
        // make sure fields with custom serialization are treaded correctly
        if (schema.hasCustomSerializers) {
            const params = {};
            for (let field of schema.fields) {
                let fieldName = field.name;
                let fieldValue = this[fieldName];
                params[fieldName] = field.serialize ? field.serialize(fieldValue) : fieldValue;
            }
            return new qInsertModel(params);
        }
        else {
            return new qInsertModel(this);
        }
    }
    buildUpdateQuery(changes) {
        const qUpdateModel = this.constructor.qUpdateModel;
        return new qUpdateModel(this, changes);
    }
    buildDeleteQuery() {
        const qDeleteModel = this.constructor.qDeleteModel;
        return new qDeleteModel(this);
    }
}
exports.Model = Model;
//# sourceMappingURL=Model.js.map
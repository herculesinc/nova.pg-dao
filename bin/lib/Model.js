"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const schema_1 = require("./schema");
const errors_1 = require("./errors");
// MODULE VARIABLES
// ================================================================================================
exports.symDeleted = Symbol('deleted');
exports.symCreated = Symbol('created');
exports.symMutable = Symbol('mutable');
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
    constructor(seed, fieldsOrClone) {
        if (!seed)
            throw new TypeError('Model seed is undefined');
        if (Array.isArray(seed)) {
            // the model is being built from database row
            if (!fieldsOrClone)
                throw new TypeError('Models fields are undefined');
            if (!Array.isArray(fieldsOrClone))
                throw new TypeError('Model fields are invalid');
            this.infuse(seed, fieldsOrClone);
        }
        else {
            // the model is being built from an object
            if (typeof seed !== 'object')
                throw new TypeError('Model seed is invalid');
            const clone = (fieldsOrClone === undefined) ? false : fieldsOrClone;
            if (typeof clone !== 'boolean')
                throw new TypeError('Clone flag is invalid');
            const schema = this.constructor.getSchema();
            if (clone) {
                // make a deep copy of the seed
                for (let field of schema.fields) {
                    let fieldName = field.name;
                    let seedValue = seed[fieldName];
                    this[fieldName] = field.clone ? field.clone(seedValue) : seedValue;
                }
            }
            else {
                // make a shallow copy of the seed
                for (let field of schema.fields) {
                    this[field.name] = seed[field.name];
                }
            }
        }
        // validate required fields
        if (!this.id)
            throw new errors_1.ModelError('Model ID is undefined');
        if (!this.createdOn)
            throw new errors_1.ModelError('Model createdOn is undefined');
        if (!this.updatedOn)
            throw new errors_1.ModelError('Model updatedOn is undefined');
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
    static SelectQuery(mask) {
        if (mask === 'single') {
            return this.qSelectOneModel;
        }
        else if (mask === 'list') {
            return this.qSelectAllModels;
        }
        else {
            throw new TypeError(`Cannot get SelectQuery template for ${this.name} model: mask '${mask}' is invalid`);
        }
    }
    static setSchema(tableName, idGenerator, fields) {
        // create and set schema
        const modelName = this.name;
        if (this.schema)
            throw new errors_1.ModelError(`Cannot set model schema: schema for ${modelName} model has already been set`);
        const schema = new schema_1.DbSchema(modelName, tableName, idGenerator, fields);
        this.schema = schema;
        // build query templates
        this.qSelectAllModels = schema_1.queries.buildSelectQueryClass(schema, 'list', this);
        this.qSelectOneModel = schema_1.queries.buildSelectQueryClass(schema, 'single', this);
        this.qInsertModel = schema_1.queries.buildInsertQueryClass(schema);
        this.qUpdateModel = schema_1.queries.buildUpdateQueryClass(schema);
        this.qDeleteModel = schema_1.queries.buildDeleteQueryClass(schema);
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
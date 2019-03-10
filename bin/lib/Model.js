"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const schema_1 = require("./schema");
const errors_1 = require("./errors");
const idGenerators_1 = require("./schema/idGenerators");
// MODULE VARIABLES
// ================================================================================================
exports.symMutable = Symbol('mutable');
exports.symCreated = Symbol('created');
exports.symDeleted = Symbol('deleted');
const symOriginal = Symbol('original');
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
    constructor(seed, fieldsOrDeepCopy, saveOriginal) {
        const schema = this.constructor.getSchema();
        if (Array.isArray(seed)) {
            // the model is being built from database row
            if (!Array.isArray(fieldsOrDeepCopy))
                throw new TypeError('Model fields are invalid');
            if (saveOriginal) {
                this[symOriginal] = {};
            }
            this.infuse(seed, fieldsOrDeepCopy, saveOriginal === 2 /* saveAllFields */);
        }
        else {
            // the model is being built from an object
            if (!seed || typeof seed !== 'object')
                throw new TypeError('Model seed is invalid');
            const deepCopy = (fieldsOrDeepCopy === undefined) ? false : fieldsOrDeepCopy;
            if (typeof deepCopy !== 'boolean')
                throw new TypeError('Clone flag is invalid');
            if (deepCopy) {
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
            this[symOriginal] = undefined;
        }
        // validate required fields
        if (!this.id || typeof this.id !== 'string')
            throw new errors_1.ModelError(`Failed to build ${schema.name} model: model ID is invalid'`);
        if (!this.createdOn || typeof this.createdOn !== 'number')
            throw new errors_1.ModelError(`Failed to build ${schema.name} model: createdOn is invalid`);
        if (!this.updatedOn || typeof this.updatedOn !== 'number')
            throw new errors_1.ModelError(`Failed to build ${schema.name} model: updatedOn is invalid`);
        // initialize internal state
        this[exports.symMutable] = false;
        this[exports.symCreated] = false;
        this[exports.symDeleted] = false;
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
    static setSchema(tableName, idGeneratorOrFields, fields) {
        // create and set schema
        const modelName = this.name;
        if (this.schema)
            throw new errors_1.ModelError(`Cannot set model schema: schema for ${modelName} model has already been set`);
        let idGenerator;
        if (!fields) {
            idGenerator = idGenerators_1.guidGenerator;
            fields = idGeneratorOrFields;
        }
        else {
            idGenerator = idGeneratorOrFields;
        }
        const schema = new schema_1.DbSchema(modelName, tableName, idGenerator, fields);
        this.schema = schema;
        // build query templates
        this.qSelectAllModels = schema_1.queries.buildSelectQueryClass(schema, 'list', this);
        this.qSelectOneModel = schema_1.queries.buildSelectQueryClass(schema, 'single', this);
        this.qInsertModel = schema_1.queries.buildInsertQueryClass(schema);
        this.qUpdateModel = schema_1.queries.buildUpdateQueryClass(schema);
        this.qDeleteModel = schema_1.queries.buildDeleteQueryClass(schema);
        return schema;
    }
    static getSchema() {
        return this.schema;
    }
    // STATE ACCESSORS
    // --------------------------------------------------------------------------------------------
    isMutable() {
        return this[exports.symMutable];
    }
    isCreated() {
        return this[exports.symCreated];
    }
    isDeleted() {
        return this[exports.symDeleted];
    }
    hasChanged(checkReadonlyFields = true) {
        const schema = this.constructor.getSchema();
        const original = this[symOriginal];
        if (!original)
            return false;
        try {
            for (let field of schema.fields) {
                if (!checkReadonlyFields && field.readonly)
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
        }
        catch (error) {
            throw new errors_1.ModelError(`Failed to identify changes in ${schema.name} model`, error);
        }
        return false;
    }
    // INTERNAL METHODS
    // --------------------------------------------------------------------------------------------
    infuse(rowData, dbFields, cloneReadonlyFields = true) {
        const fields = this.constructor.getSchema().fields;
        if (fields.length !== rowData.length)
            throw new errors_1.ModelError('Model row data is inconsistent');
        if (fields.length !== dbFields.length)
            throw new errors_1.ModelError('Model fields are inconsistent');
        const original = this[symOriginal];
        try {
            for (let i = 0; i < fields.length; i++) {
                let field = fields[i];
                let fieldName = field.name;
                let fieldValue = field.parse ? field.parse(rowData[i]) : dbFields[i].parser(rowData[i]);
                this[fieldName] = fieldValue;
                if (original) {
                    // don't keep originals of read-only fields when not needed
                    if (!cloneReadonlyFields && field.readonly)
                        continue;
                    original[fieldName] = field.clone ? field.clone(fieldValue) : fieldValue;
                }
            }
        }
        catch (error) {
            const schema = this.constructor.getSchema();
            throw new errors_1.ModelError(`Failed to build ${schema.name} model`, error);
        }
        this[symOriginal] = original;
    }
    saveOriginal(cloneReadonlyFields) {
        const schema = this.constructor.getSchema();
        const original = {};
        try {
            for (let field of schema.fields) {
                if (!cloneReadonlyFields && field.readonly)
                    continue;
                let fieldName = field.name;
                let fieldValue = this[fieldName];
                original[fieldName] = field.clone ? field.clone(fieldValue) : fieldValue;
            }
            this[symOriginal] = original;
        }
        catch (error) {
            throw new errors_1.ModelError(`Failed to clone ${schema.name} model`, error);
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
    getSyncQueries(updatedOn, checkReadonlyFields = true) {
        if (this[exports.symCreated]) {
            return [this.buildInsertQuery()];
        }
        else if (this[exports.symDeleted]) {
            return [this.buildDeleteQuery()];
        }
        else {
            const schema = this.constructor.getSchema();
            const changes = this.getChanges(checkReadonlyFields);
            if (changes && changes.length > 0) {
                this.updatedOn = updatedOn;
                changes.push(schema.getField('updatedOn'));
                return [this.buildUpdateQuery(changes)];
            }
        }
    }
    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    getChanges(checkReadonlyFields) {
        // check if the model has original values
        const original = this[symOriginal];
        if (!original)
            return undefined;
        // check if any fields have changed
        const schema = this.constructor.getSchema();
        const changes = [];
        try {
            for (let field of schema.fields) {
                if (!checkReadonlyFields && field.readonly)
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
        }
        catch (error) {
            throw new errors_1.ModelError(`Failed to identify changes in ${schema.name} model`, error);
        }
        return changes;
    }
    buildInsertQuery() {
        const schema = this.constructor.getSchema();
        const qInsertModel = this.constructor.qInsertModel;
        // make sure fields with custom serialization are treated correctly
        if (schema.hasCustomSerializers) {
            try {
                const params = {};
                for (let field of schema.fields) {
                    let fieldName = field.name;
                    let fieldValue = this[fieldName];
                    params[fieldName] = field.serialize ? field.serialize(fieldValue) : fieldValue;
                }
                return new qInsertModel(params);
            }
            catch (error) {
                throw new errors_1.ModelError(`Failed to serialize ${schema.name} model`, error);
            }
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
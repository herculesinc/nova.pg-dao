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
// CLASS DEFINITION
// ================================================================================================
class Model {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(seed, fields) {
        if (!seed)
            throw new errors_1.ModelError('Cannot instantiate a model: model seed is undefined');
        if (Array.isArray(seed)) {
            // TODO: this.infuse(seed);
        }
        else {
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
        this.qFetchAllModels = schema_1.queries.buildSelectQueryTemplate(schema, 'list', this);
        this.qFetchOneModel = schema_1.queries.buildSelectQueryTemplate(schema, 'single', this);
        this.qInsertModel = schema_1.queries.buildInsertQueryTemplate(schema);
        this.qUpdateModel = schema_1.queries.buildUpdateQueryTemplate(schema);
        this.qDeleteModel = schema_1.queries.buildDeleteQueryTemplate(schema);
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
    // MODEL METHODS
    // --------------------------------------------------------------------------------------------
    infuse(rowData, fields) {
        const schema = this.constructor.getSchema();
        const original = [];
        for (let i = 0; i < schema.fields.length; i++) {
            let field = schema.fields[i];
            let fieldValue = field.parse ? field.parse(rowData[i]) : fields[i].parser(rowData[i]);
            this[field.name] = fieldValue;
            // don't keep originals of read-only fields
            if (field.readonly)
                continue;
            original[i] = field.clone ? field.clone(fieldValue) : fieldValue;
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
class Account extends Model {
}
const x = Account.getFetchOneQuery(undefined, true);
//# sourceMappingURL=Model.js.map
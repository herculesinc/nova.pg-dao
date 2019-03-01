"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Model_1 = require("./Model");
const errors_1 = require("./errors");
// CLASS DEFINITION
// ================================================================================================
class Store {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(config) {
        this.models = new Map();
        this.checkImmutable = config.checkImmutable;
    }
    // ACCESSORS
    // --------------------------------------------------------------------------------------------
    get(type, id) {
        if (!Model_1.isModelClass(type))
            throw new TypeError('Cannot get model: model type is invalid');
        if (typeof id !== 'string')
            throw new TypeError('Cannot get model: model id is invalid');
        const uid = type.name + '::' + id;
        const model = this.models.get(uid);
        if (model && !model[Model_1.symDeleted])
            return model;
    }
    getAll(type) {
        if (!Model_1.isModelClass(type))
            throw new TypeError('Cannot get model: model type is invalid');
        const models = new Map();
        for (let model of this.models.values()) {
            if (model instanceof type && !model[Model_1.symDeleted]) {
                models.set(model.id, model);
            }
        }
        return models;
    }
    // LOADING METHODS
    // --------------------------------------------------------------------------------------------
    load(type, rows, fields, mutable) {
        if (!Model_1.isModelClass(type))
            throw new TypeError('Cannot load model: model class is invalid');
        const models = [];
        for (let rowData of rows) {
            let uid = type.name + '::' + rowData[0];
            let model = this.models.get(uid);
            if (model) {
                // don't reload deleted models
                if (model[Model_1.symDeleted])
                    continue;
                // check if the model can be reloaded
                if (model[Model_1.symMutable]) {
                    if (model[Model_1.symCreated])
                        throw new errors_1.ModelError(`Cannot reload ${type.name} model: model is newly inserted`);
                    if (model.isModified()) {
                        throw new errors_1.ModelError(`Cannot reload ${type.name} model: model has been modified`);
                    }
                }
                model.infuse(rowData, fields);
            }
            else {
                model = new type(rowData, fields);
                this.models.set(uid, model);
            }
            model[Model_1.symMutable] = mutable;
            models.push(model);
        }
        return models;
    }
    insert(model, created) {
        const type = Model_1.getModelClass(model);
        if (model[Model_1.symDeleted])
            throw new errors_1.ModelError(`Cannot insert ${type.name} model: model has been deleted`);
        const uid = type.name + '::' + model.id;
        if (this.models.has(uid))
            throw new errors_1.ModelError(`Cannot insert ${type.name} model: model has already been inserted`);
        if (created) {
            model[Model_1.symMutable] = true;
            model[Model_1.symCreated] = true;
        }
        else {
            // TODO: make based on config
            model.saveOriginal(true);
        }
        this.models.set(uid, model);
        return model;
    }
    delete(model) {
        const type = Model_1.getModelClass(model);
        if (!model[Model_1.symMutable])
            throw new errors_1.ModelError(`Cannot delete ${type.name} model: model is not mutable`);
        if (model[Model_1.symDeleted])
            throw new errors_1.ModelError(`Cannot delete ${type.name} model: model has already been deleted`);
        const uid = type.name + '::' + model.id;
        const storedModel = this.models.get(uid);
        if (!storedModel)
            throw new errors_1.ModelError(`Cannot delete ${type.name} model: model has not been loaded`);
        if (storedModel !== model)
            throw new errors_1.ModelError(`Cannot delete ${type.name} model: a different model with the same ID was found in the store`);
        if (model[Model_1.symCreated]) {
            this.models.delete(uid);
            model[Model_1.symCreated] = false;
        }
        model[Model_1.symDeleted] = true;
        return model;
    }
    // SYNC METHODS
    // --------------------------------------------------------------------------------------------
    getSyncQueries() {
        let queries = [];
        if (this.checkImmutable) {
            // iterate through models and check every model for changes
            for (let model of this.models.values()) {
                const mQueries = model.getSyncQueries();
                if (mQueries.length === 1) {
                    queries.push(mQueries[0]);
                }
                else if (mQueries.length > 1) {
                    queries = [...queries, ...mQueries];
                }
            }
        }
        else {
            // check only mutable models for changes
            for (let model of this.models.values()) {
                if (!model[Model_1.symMutable])
                    continue;
                const mQueries = model.getSyncQueries();
                if (mQueries.length > 0) {
                    if (mQueries.length === 1) {
                        queries.push(mQueries[0]);
                    }
                    else if (mQueries.length > 1) {
                        queries = [...queries, ...mQueries];
                    }
                }
            }
        }
        return queries;
    }
    applyChanges() {
        for (let model of this.models.values()) {
            if (!model[Model_1.symMutable])
                continue;
            if (model[Model_1.symDeleted]) {
                const type = Model_1.getModelClass(model);
                const uid = type.name + '::' + model.id;
                this.models.delete(uid);
                model.clearOriginal();
            }
            else {
                // TODO: make based on config
                model.saveOriginal(true);
                model[Model_1.symCreated] = false;
            }
        }
    }
}
exports.Store = Store;
//# sourceMappingURL=Store.js.map
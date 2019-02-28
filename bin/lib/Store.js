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
        this.cache = new Map();
        this.checkImmutable = config.checkImmutable;
    }
    // ACCESSORS
    // --------------------------------------------------------------------------------------------
    get(type, id) {
        if (!Model_1.isModelClass(type))
            throw new TypeError('Cannot get model: model type is invalid');
        if (typeof id !== 'string')
            throw new TypeError('Cannot get model: model id is invalid');
        const storedModels = this.cache.get(type);
        if (storedModels) {
            const model = storedModels.get(id);
            if (model && !model.isDeleted)
                return model;
        }
    }
    getAll(type) {
        if (!Model_1.isModelClass(type))
            throw new TypeError('Cannot get model: model type is invalid');
        const models = this.cache.get(type);
        return models ? models : new Map();
    }
    // LOADING METHODS
    // --------------------------------------------------------------------------------------------
    load(modelClass, rows, fields, mutable) {
        if (!Model_1.isModelClass(modelClass))
            throw new TypeError('Cannot load model: model class is invalid');
        const models = [];
        const storedModels = this.getModelMap(modelClass, true);
        for (let rowData of rows) {
            let model = storedModels.get(rowData[0]);
            if (model) {
                if (model.isMutable) {
                    if (model.isDeleted)
                        throw new errors_1.ModelError(`Cannot reload ${modelClass.name} model: model has been deleted`);
                    if (model.isCreated)
                        throw new errors_1.ModelError(`Cannot reload ${modelClass.name} model: model is newly inserted`);
                    if (model.isModified)
                        throw new errors_1.ModelError(`Cannot reload ${modelClass.name} model: model has been modified`);
                }
                model.infuse(rowData, fields);
            }
            else {
                model = new modelClass(rowData, fields);
                storedModels.set(model.id, model);
            }
            model[Model_1.symMutable] = mutable;
            models.push(model);
        }
        return models;
    }
    insert(model, created) {
        const modelClass = Model_1.getModelClass(model);
        if (model.isDeleted)
            throw new errors_1.ModelError(`Cannot insert ${modelClass.name} model: model has been deleted`);
        const storedModels = this.getModelMap(modelClass, true);
        if (storedModels.has(model.id))
            throw new errors_1.ModelError(`Cannot insert ${modelClass.name} model: model has already been inserted`);
        if (created) {
            model[Model_1.symCreated] = true;
            model[Model_1.symMutable] = true;
        }
        storedModels.set(model.id, model);
        return model;
    }
    delete(model) {
        const modelClass = Model_1.getModelClass(model);
        if (!model.isMutable)
            throw new errors_1.ModelError(`Cannot delete ${modelClass.name} model: model is not mutable`);
        if (!model.isDeleted)
            throw new errors_1.ModelError(`Cannot delete ${modelClass.name} model: model has already been deleted`);
        const storedModels = this.cache.get(modelClass);
        if (!storedModels)
            throw new errors_1.ModelError(`Cannot delete ${modelClass.name} model: model has not been loaded`);
        const storedModel = storedModels.get(model.id);
        if (!storedModel)
            throw new errors_1.ModelError(`Cannot delete ${modelClass.name} model: model has not been loaded`);
        if (storedModel !== model)
            throw new errors_1.ModelError(`Cannot delete ${modelClass.name} model: a different model with the same ID was found in the store`);
        if (model.isCreated) {
            storedModels.delete(model.id);
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
            for (let models of this.cache.values()) {
                for (let model of models.values()) {
                    const mQueries = model.getSyncQueries();
                    if (mQueries.length === 1) {
                        queries.push(mQueries[0]);
                    }
                    else if (mQueries.length > 1) {
                        queries = [...queries, ...mQueries];
                    }
                }
            }
        }
        else {
            // check only mutable models for changes
            for (let models of this.cache.values()) {
                for (let model of models.values()) {
                    if (!model.isMutable)
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
        }
        return queries;
    }
    applyChanges() {
        for (let models of this.cache.values()) {
            for (let model of models.values()) {
                if (!model.isMutable)
                    continue;
                if (model.isDeleted) {
                    models.delete(model.id);
                }
                else {
                    model.applyChanges();
                }
            }
        }
    }
    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    getModelMap(modelClass, create = false) {
        let modelMap = this.cache.get(modelClass);
        if (create && modelMap === undefined) {
            modelMap = new Map();
            this.cache.set(modelClass, modelMap);
        }
        return modelMap;
    }
}
exports.Store = Store;
//# sourceMappingURL=Store.js.map
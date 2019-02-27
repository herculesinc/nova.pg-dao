// IMPORTS
// ================================================================================================
import { Query, FieldDescriptor } from '@nova/pg-dao';
import { Model, symMutable, symCreated, symDeleted, getModelClass, isModelClass } from './Model';
import { ModelError } from './errors';

// INTERFACES
// ================================================================================================
interface StoreConfig {
    checkImmutable  : boolean;
}

// CLASS DEFINITION
// ================================================================================================
export class Store {

    private readonly cache          : Map<typeof Model, Map<string, Model>>;
    private readonly checkImmutable : boolean;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(config: StoreConfig) {
        this.cache = new Map();
        this.checkImmutable = config.checkImmutable;
    }

    // ACCESSORS
    // --------------------------------------------------------------------------------------------
    get<T extends Model>(type: typeof Model, id: string): T | undefined {
        if (!isModelClass(type)) throw new TypeError('Cannot get model: model type is invalid');
        if (typeof id !== 'string') throw new TypeError('Cannot get model: model id is invalid');

        const storedModels = this.cache.get(type); 
        if (storedModels) {
            const model = storedModels.get(id);
            if (model && !model.isDeleted) return model as T;
        }
    }

    getAll<T extends Model>(type: typeof Model): ReadonlyMap<string, T> {
        if (!isModelClass(type)) throw new TypeError('Cannot get model: model type is invalid');

        const models = this.cache.get(type); 
        return models ? models : new Map();
    }

    // LOADING METHODS
    // --------------------------------------------------------------------------------------------
    load(modelClass: typeof Model, rows: string[][], fields: FieldDescriptor[], mutable: boolean) {
        if (!isModelClass(modelClass)) throw new TypeError('Cannot load model: model class is invalid');
        
        const models: Model[] = [];
        const storedModels = this.getModelMap(modelClass, true)!;

        for (let rowData of rows) {
            let model = storedModels.get(rowData[0]);
            if (model) {
                if (model.isMutable) {
                    if (model.isDeleted) throw new ModelError(`Cannot reload ${modelClass.name} model: model has been deleted`);
                    if (model.isCreated) throw new ModelError(`Cannot reload ${modelClass.name} model: model is newly inserted`);
                    if (model.isModified) throw new ModelError(`Cannot reload ${modelClass.name} model: model has been modified`);
                }
                model.infuse(rowData, fields);
            }
            else {
                model = new modelClass(rowData, fields);
                storedModels.set(model.id, model);
            }
            model[symMutable] = mutable;
            models.push(model);
        }

        return models;
    }

    insert(model: Model, created: boolean) {
        const modelClass = getModelClass(model);
        if (model.isDeleted) throw new ModelError(`Cannot insert ${modelClass.name} model: model has been deleted`);

        const storedModels = this.getModelMap(modelClass, true)!;
        if (storedModels.has(model.id)) throw new ModelError(`Cannot insert ${modelClass.name} model: model has already been inserted`);

        if (created) {
            model[symCreated] = true;
            model[symMutable] = true;
        }

        return model;
    }

    delete(model: Model) {
        const modelClass = getModelClass(model);
        if (!model.isMutable) throw new ModelError(`Cannot delete ${modelClass.name} model: model is not mutable`);
        if (!model.isDeleted) throw new ModelError(`Cannot delete ${modelClass.name} model: model has already been deleted`);

        const storedModels = this.cache.get(modelClass);
        if (!storedModels) throw new ModelError(`Cannot delete ${modelClass.name} model: model has not been loaded`);
        const storedModel = storedModels.get(model.id);
        if (!storedModel) throw new ModelError(`Cannot delete ${modelClass.name} model: model has not been loaded`);
        if (storedModel !== model) throw new ModelError(`Cannot delete ${modelClass.name} model: a different model with the same ID was found in the store`);

        if (model.isCreated) {
            storedModels.delete(model.id);
            model[symCreated] = false;
        }
        model[symDeleted] = true;

        return model;
    }

    // SYNC METHODS
    // --------------------------------------------------------------------------------------------
    getSyncQueries(): Query[] {
        let queries: Query[] = [];

        if (this.checkImmutable) {
            // iterate through models and check every model for changes
            for (let models of this.cache.values()) {
                for (let model of models.values()) {
                    const mQueries = model.getSyncQueries();
                    if (mQueries.length === 1) {
                        queries.push(mQueries[0]);
                    }
                    else if (mQueries.length > 1) {
                        queries = [ ...queries, ...mQueries ];
                    }
                }
            }
        }
        else {
            // check only mutable models for changes
            for (let models of this.cache.values()) {
                for (let model of models.values()) {
                    if (!model.isMutable) continue;
                    const mQueries = model.getSyncQueries();
                    if (mQueries.length > 0) {
                        if (mQueries.length === 1) {
                            queries.push(mQueries[0]);
                        }
                        else if (mQueries.length > 1) {
                            queries = [ ...queries, ...mQueries ];
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
                if (!model.isMutable) continue;

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
    private getModelMap(modelClass: typeof Model, create = false) {
        let modelMap = this.cache.get(modelClass);
        if (create && modelMap === undefined) {
            modelMap = new Map<string, Model>();
            this.cache.set(modelClass, modelMap);
        }
        return modelMap;
    }
}
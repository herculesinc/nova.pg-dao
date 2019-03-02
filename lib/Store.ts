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

    private readonly models         : Map<string, Model>;
    private readonly checkImmutable : boolean;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(config: StoreConfig) {
        this.models = new Map();
        this.checkImmutable = config.checkImmutable;
    }

    // ACCESSORS
    // --------------------------------------------------------------------------------------------
    get<T extends Model>(type: typeof Model, id: string): T | undefined {
        if (!isModelClass(type)) throw new TypeError('Cannot get model: model type is invalid');
        if (typeof id !== 'string') throw new TypeError('Cannot get model: model id is invalid');

        const uid = type.name + '::' + id;
        const model = this.models.get(uid);
        if (model && !model[symDeleted]) return model as T;
    }

    getAll<T extends Model>(type: typeof Model): ReadonlyMap<string, T> {
        if (!isModelClass(type)) throw new TypeError('Cannot get model: model type is invalid');

        const models = new Map<string, T>();
        for (let model of this.models.values()) {
            if (model instanceof type && !model[symDeleted]) {
                models.set(model.id, model as T);
            }
        }
        return models;
    }

    // LOADING METHODS
    // --------------------------------------------------------------------------------------------
    load(type: typeof Model, rowData: string[], fields: FieldDescriptor[], mutable: boolean): Model | undefined {

        let uid = type.name + '::' + rowData[0];
        let model = this.models.get(uid);
        if (model) {
            // don't reload deleted models
            if (model[symDeleted]) return undefined;

            // check if the model can be reloaded
            if (model[symMutable]) {
                if (model[symCreated]) throw new ModelError(`Cannot reload ${type.name} model: model is newly inserted`);
                if (model.isModified()) {
                    throw new ModelError(`Cannot reload ${type.name} model: model has been modified`);
                }
            }
            model.infuse(rowData, fields);
        }
        else {
            model = new type(rowData, fields);
            this.models.set(uid, model);
        }
        model[symMutable] = mutable;

        return model;
    }

    insert(model: Model, created: boolean) {
        const type = getModelClass(model);
        if (model[symDeleted]) throw new ModelError(`Cannot insert ${type.name} model: model has been deleted`);

        const uid = type.name + '::' + model.id;
        if (this.models.has(uid)) throw new ModelError(`Cannot insert ${type.name} model: model has already been inserted`);

        if (created) {
            model[symMutable] = true;
            model[symCreated] = true;
        }
        else {
            // TODO: make based on config
            model.saveOriginal(true);
        }

        this.models.set(uid, model);

        return model;
    }

    delete(model: Model) {
        const type = getModelClass(model);
        if (!model[symMutable]) throw new ModelError(`Cannot delete ${type.name} model: model is not mutable`);
        if (model[symDeleted]) throw new ModelError(`Cannot delete ${type.name} model: model has already been deleted`);

        const uid = type.name + '::' + model.id;
        const storedModel = this.models.get(uid);
        if (!storedModel) throw new ModelError(`Cannot delete ${type.name} model: model has not been loaded`);
        if (storedModel !== model) throw new ModelError(`Cannot delete ${type.name} model: a different model with the same ID was found in the store`);

        if (model[symCreated]) {
            this.models.delete(uid);
            model[symCreated] = false;
        }
        model[symDeleted] = true;

        return model;
    }

    // SYNC METHODS
    // --------------------------------------------------------------------------------------------
    getSyncQueries(): Query[] {

        let queries: Query[] = [];
        const updatedOn = Date.now();

        if (this.checkImmutable) {
            // iterate through models and check every model for changes
            for (let model of this.models.values()) {
                const mQueries = model.getSyncQueries(updatedOn);
                if (!mQueries) continue;
                if (mQueries.length === 1) {
                    queries.push(mQueries[0]);
                }
                else if (mQueries.length > 1) {
                    queries = [ ...queries, ...mQueries ];
                }
            }
        }
        else {
            // check only mutable models for changes
            for (let model of this.models.values()) {
                if (!model[symMutable]) continue;
                const mQueries = model.getSyncQueries(updatedOn);
                if (!mQueries) continue;
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

        return queries;
    }

    applyChanges() {

        for (let model of this.models.values()) {
            if (!model[symMutable]) continue;

            if (model[symDeleted]) {
                const type = getModelClass(model);
                const uid = type.name + '::' + model.id;
                this.models.delete(uid);
                model.clearOriginal();
            }
            else {
                // TODO: make based on config
                model.saveOriginal(true);
                model[symCreated] = false;
            }
        }

    }
}

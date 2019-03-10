// IMPORTS
// ================================================================================================
import { Query, FieldDescriptor, SaveOriginalMethod } from '@nova/pg-dao';
import { Model, symMutable, symCreated, symDeleted, getModelClass, isModelClass } from './Model';
import { SessionError } from './errors';

// INTERFACES
// ================================================================================================
interface StoreConfig {
    verifyImmutability  : boolean;
}

// CLASS DEFINITION
// ================================================================================================
export class Store {

    private readonly models             : Map<string, Model>;
    private readonly verifyImmutability : boolean;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(config: StoreConfig) {
        this.models = new Map();
        this.verifyImmutability = config.verifyImmutability;
    }

    // ACCESSORS
    // --------------------------------------------------------------------------------------------
    getOne<T extends Model>(type: typeof Model, id: string): T | undefined {
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
                if (model[symCreated]) throw new SessionError(`Cannot reload ${type.name} model: model is newly inserted`);
                if (model.hasChanged(this.verifyImmutability)) {
                    throw new SessionError(`Cannot reload ${type.name} model: model has been modified`);
                }
            }
            model.infuse(rowData, fields, this.verifyImmutability);
        }
        else {
            let saveOriginal = SaveOriginalMethod.dontSave;
            if (this.verifyImmutability) {
                saveOriginal = SaveOriginalMethod.saveAllFields;
            }
            else if (mutable) {
                saveOriginal = SaveOriginalMethod.saveMutableFields;
            }

            model = new type(rowData, fields, saveOriginal);
            this.models.set(uid, model);
        }
        model[symMutable] = mutable;

        return model;
    }

    insert(model: Model, created: boolean) {
        const type = getModelClass(model);
        if (model[symDeleted]) throw new SessionError(`Cannot insert ${type.name} model: model has been deleted`);

        const uid = type.name + '::' + model.id;
        if (this.models.has(uid)) throw new SessionError(`Cannot insert ${type.name} model: model has already been inserted`);

        if (created) {
            model[symMutable] = true;
            model[symCreated] = true;
        }
        else {
            model.saveOriginal(this.verifyImmutability);
        }

        this.models.set(uid, model);

        return model;
    }

    delete(model: Model) {
        const type = getModelClass(model);
        if (!model[symMutable]) throw new SessionError(`Cannot delete ${type.name} model: model is not mutable`);
        if (model[symDeleted]) throw new SessionError(`Cannot delete ${type.name} model: model has already been deleted`);

        const uid = type.name + '::' + model.id;
        const storedModel = this.models.get(uid);
        if (!storedModel) throw new SessionError(`Cannot delete ${type.name} model: model has not been loaded`);
        if (storedModel !== model) throw new SessionError(`Cannot delete ${type.name} model: a different model with the same ID was found in the store`);

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

        if (this.verifyImmutability) {
            // iterate through models and check every model for changes
            for (let model of this.models.values()) {
                const mQueries = model.getSyncQueries(updatedOn, true);
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
                const mQueries = model.getSyncQueries(updatedOn, false);
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

    hasChanges(): boolean {
        for (let model of this.models.values()) {
            if (model[symDeleted]) return true;
            if (model[symCreated]) return true;
            if (model.hasChanged(this.verifyImmutability)) return true;
        }
        return false;
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
            else if (model[symCreated]) {
                model[symCreated] = false;
                model.saveOriginal(this.verifyImmutability);
            }
            else {
                model.saveOriginal(this.verifyImmutability);
            }
        }

    }
}

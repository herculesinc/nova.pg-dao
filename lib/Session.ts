// IMPORTS
// ================================================================================================
import { Dao } from '@nova/core';
import { Model, ModelSelector, Query, SingleResultQuery, ListResultQuery, SessionOptions, Logger, TraceSource, QueryTextLogLevel } from '@nova/pg-dao';
import { Client } from 'pg';
import { Request } from './Request';
import { Store } from './Store';
import { isModelClass } from './Model';
import { ConnectionError, SessionError } from './errors';

// INTERFACES AND ENUMS
// ================================================================================================
const enum DaoState {
    pending = 1, connecting, active, closing, closed
}

interface SessionFactory {
    connect(): Promise<Client>;
}

// CLASS DEFINITION
// ================================================================================================
export class DaoSession implements Dao {

    private readonly db             : SessionFactory;
    private readonly source         : TraceSource;

    private state                   : DaoState;
    private client?                 : Client;
    private requests                : Request[];

    private readonly store          : Store;
    private readonly logger?        : Logger;
    private readonly readonly       : boolean;
    private readonly logQueryText   : QueryTextLogLevel;
    private readonly verifyImmutability : boolean;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(db: SessionFactory, options: SessionOptions, source: TraceSource, logger?: Logger) {

        this.db = db;
        this.source = source;

        this.readonly = options.readonly;
        this.logQueryText = options.logQueryText;
        this.verifyImmutability = options.verifyImmutability;
        this.logger = logger;
        this.store = new Store(options);

        this.state = DaoState.pending;
        this.client = undefined;
        this.requests = [];
    }

    // PUBLIC ACCESSORS
    // --------------------------------------------------------------------------------------------
    get isReadOnly(): boolean {
        return this.readonly;
    }

    get inTransaction(): boolean {
        return (this.state === DaoState.active);
    }

    get isActive(): boolean {
        return (this.state <= DaoState.active);
    }

    // MODEL METHODS
    // --------------------------------------------------------------------------------------------
    getOne<T extends typeof Model>(type: T, id: string): InstanceType<T> | undefined {
        return this.store.getOne(type as any, id);
    }

    getAll<T extends typeof Model>(type: T): ReadonlyMap<string, InstanceType<T>> {
        return this.store.getAll(type as any);
    }

    async fetchOne<T extends typeof Model>(type: T, selector: ModelSelector, forUpdate?: boolean): Promise<InstanceType<T> | undefined> {
        if (!isModelClass(type)) {
            throw new TypeError('Cannot fetch model: model type is invalid');
        }
        else if (!selector || (typeof selector !== 'object' && typeof selector !== 'string')) {
            throw new TypeError('Cannot fetch model: selector is invalid');
        }
        else if (forUpdate !== undefined && typeof forUpdate !== 'boolean') {
            throw new TypeError('Cannot fetch model: forUpdate flag is invalid');
        }
        else if (forUpdate && this.isReadOnly) {
            throw new SessionError('Cannot fetch mutable model: session is read-only');
        }

        const qSelectModel = type.SelectQuery('single');
        const query = new qSelectModel(forUpdate || false, selector);
        return this.execute(query);
    }

    async fetchAll<T extends typeof Model>(type: T, selector: ModelSelector, forUpdate?: boolean): Promise<InstanceType<T>[]> {
        if (!isModelClass(type)) {
            throw new TypeError('Cannot fetch models: model type is invalid');
        }
        else if (!selector || (typeof selector !== 'object' && typeof selector !== 'string')) {
            throw new TypeError('Cannot fetch models: selector is invalid');
        }
        else if (forUpdate !== undefined && typeof forUpdate !== 'boolean') {
            throw new TypeError('Cannot fetch models: forUpdate flag is invalid');
        }
        else if (forUpdate && this.isReadOnly) {
            throw new SessionError('Cannot fetch mutable models: session is read-only');
        }

        const qSelectModels = type.SelectQuery('list');
        const query = new qSelectModels(forUpdate || false, selector);
        return this.execute(query);
    }

    load<T extends typeof Model>(type: T, seed: object): InstanceType<T> {
        if (!isModelClass(type)) throw new TypeError('Cannot load model: model type is invalid');
        if (!this.isActive) {
            throw new SessionError('Cannot load model: session has already been closed');
        }

        const model = new type(seed, false) as InstanceType<T>;
        this.store.insert(model, false);
        return model;
    }

    async create<T extends typeof Model>(type: T, seed: object): Promise<InstanceType<T>> {
        if (!isModelClass(type)) throw new TypeError('Cannot create model: model type is invalid');
        if (!this.isActive) {
            throw new SessionError('Cannot create model: session has already been closed');
        }
        else if (this.isReadOnly) {
            throw new SessionError('Cannot create model: session is read-only');
        }

        // create new model
        const id = await type.getSchema().idGenerator.getNextId(this.logger, this);
        const createdOn = Date.now();
        const updatedOn = createdOn;
        const model = new type({ id, ...seed, createdOn, updatedOn }, true) as InstanceType<T>;

        // add the model to the store and return
        this.store.insert(model, true);
        return model;
    }

    delete<T extends Model>(model: T): T {
        if (!this.isActive) {
            throw new SessionError('Cannot delete model: session has already been closed');
        }
        else if (this.isReadOnly) {
            throw new SessionError('Cannot delete model: session is read-only');
        }

        this.store.delete(model as any);
        return model;
    }

    // SYNC METHODS
    // --------------------------------------------------------------------------------------------
    async flush(): Promise<void> {
        if (!this.isActive) {
            throw new SessionError('Cannot flush session: session has already been closed');
        }
        else if (this.isReadOnly) {
            throw new SessionError('Cannot flush session: session is read-only');
        }

        // build a list of sync queries
        const queries = this.store.getSyncQueries();
        if (queries.length === 0) return;

        // execute sync queries
        const promises: Promise<any>[] = [];
        for (let query of queries) {
            promises.push(this.execute(query));
        }
        await Promise.all(promises);

        // clean changes from all models
        this.store.applyChanges();
    }

    async close(action: 'commit' | 'rollback'): Promise<any> {
        if (!this.isActive) {
            throw new SessionError('Cannot close session: session has already been closed');
        }
        else if (action !== 'commit' && action !== 'rollback') {
            throw new TypeError(`Cannot close session: '${action}' action is invalid`);
        }

        if (!this.inTransaction) {
            this.state = DaoState.closed;
            return;
        }

        let closeError: Error | undefined;
        try {
            let closePromise: Promise<any>;
            if (action === 'commit') {
                this.logger && this.logger.debug('Committing and closing session');

                // flush changes, if needed
                const flushPromises: Promise<any>[] = [];
                if (!this.isReadOnly) {
                    // if the session is not read-only, get a list of sync queries to execute
                    const queries = this.store.getSyncQueries();
                    if (queries.length > 0) {
                        for (let query of queries) {
                            flushPromises.push(this.execute(query));
                        }
                    }
                }
                else if (this.verifyImmutability) {
                    // check immutability for read-only sessions
                    if (this.store.hasChanges())  {
                        throw new SessionError('Dirty models detected in read-only session');
                    }
                }

                // commit the transaction
                if (flushPromises.length > 0) {
                    flushPromises.push(this.execute(COMMIT_TRANSACTION));
                    closePromise = Promise.all(flushPromises);
                }
                else {
                    closePromise = this.execute(COMMIT_TRANSACTION);
                }
            }
            else if (action === 'rollback') {
                // rollback the transaction
                this.logger && this.logger.debug('Committing and closing session');
                closePromise = this.execute(ROLLBACK_TRANSACTION);
            }

            this.state = DaoState.closing;
            await closePromise!;
            this.store.applyChanges();
        }
        catch (error) {
            closeError = new SessionError(`Error while closing session`, error);
        }

        this.releaseClient(closeError);
        if (closeError) throw closeError;
    }

    // EXECUTE METHOD
    // --------------------------------------------------------------------------------------------
    async execute<T>(query: ListResultQuery<T>): Promise<T[]>
    async execute<T>(query: SingleResultQuery<T>): Promise<T | undefined>
    async execute(query: Query<void>): Promise<void>
    async execute<T>(query: Query<T>): Promise<any> {
        if (!this.isActive) {
            throw new SessionError('Cannot execute a query: session is closed');
        }

        let firstRequest: Request | undefined;

        // make sure sessions starts out with BEGIN statement
        if (this.state === DaoState.pending) {
            firstRequest = this.queueFirstRequest();
            this.state = DaoState.connecting;
        }

        // add query to the request
        const result = this.appendToRequestQueue(query, firstRequest);

        // connect to database, but only if the BEGIN statement was queued in this context
        if (firstRequest) {
            const start = Date.now();
            try {
                this.logger && this.logger.debug('Connecting to the database');
                this.client = await this.db.connect();
                this.logger && this.logger.trace(this.source, 'connect', Date.now() - start, true);
            }
            catch(error) {
                this.logger && this.logger.trace(this.source, 'connect', Date.now() - start, false);
                error = new ConnectionError('Cannot execute a query: database connection failed', error);

                // make all queued requests resolve to an error
                process.nextTick(() => {
                    for (let request of this.requests) {
                        request.abort(error);
                    }
                });

                // result will resolve to an error on next tick
                return result;
            }
            this.state = DaoState.active;
        }

        // execute the entire request queue on next tick
        if (this.state === DaoState.active) {
            process.nextTick(() => {
                const requests = this.requests;
                this.requests = [];

                for (let request of requests) {
                    this.client!.query(request as any);
                }
            });
        }

        // return the result
        return result;
    }

    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    private queueFirstRequest(): Request {
        // create a request and add it to the request queue
        const request = new Request(this.store, this.logger, this.source, this.logQueryText);
        this.requests.push(request);

        // add begin transaction query to the request
        const txStartQuery = this.readonly ? BEGIN_RO_TRANSACTION : BEGIN_RW_TRANSACTION;
        request.add(txStartQuery).catch((error) => {
            // TODO: log error?
        });
        return request;
    }

    private appendToRequestQueue(query: Query, firstRequest?: Request): Promise<any> {
        let result: any;
        if (query.values) {
            // if parameterized query, it must start a new request
            const request = new Request(this.store, this.logger, this.source, this.logQueryText);
            this.requests.push(request);
            result = request.add(query);;
        }
        else if (firstRequest) {
            result = firstRequest.add(query);
        }
        else {
            // try to append the query to the last request in the queue
            let request = this.requests[this.requests.length - 1];
            if (!request || request.isParameterized) {
                request = new Request(this.store, this.logger, this.source, this.logQueryText);
                this.requests.push(request);
            }
            result = request.add(query);;
        }

        return result;
    }

    private releaseClient(error?: Error) {
        this.state = DaoState.closed;
        if (this.client) {
            this.client.release(error);
            this.client = undefined;
            this.logger && this.logger.debug('Session closed');
        }
        else {
            this.logger && this.logger.warn('Overlapping client release detected');
        }
    }
}

// TRANSACTION QUERIES
// ================================================================================================
const BEGIN_RO_TRANSACTION: Query = {
    name: 'qBeginReadOnlyTransaction',
    text: 'BEGIN READ ONLY;'
};

const BEGIN_RW_TRANSACTION: Query = {
    name: 'qBeginReadWriteTransaction',
    text: 'BEGIN READ WRITE;'
};

const COMMIT_TRANSACTION: Query = {
    name: 'qCommitTransaction',
    text: 'COMMIT;'
};

const ROLLBACK_TRANSACTION: Query = {
    name: 'qRollbackTransaction',
    text: 'ROLLBACK;'
};

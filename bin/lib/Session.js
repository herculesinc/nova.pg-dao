"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Request_1 = require("./Request");
const Store_1 = require("./Store");
const Model_1 = require("./Model");
const errors_1 = require("./errors");
// CLASS DEFINITION
// ================================================================================================
class DaoSession {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(db, options, source, logger) {
        this.db = db;
        this.source = source;
        this.readonly = options.readonly;
        this.logQueryText = options.logQueryText;
        this.verifyImmutability = options.verifyImmutability;
        this.logger = logger;
        this.store = new Store_1.Store(options);
        this.state = 1 /* pending */;
        this.client = undefined;
        this.requests = [];
    }
    // PUBLIC ACCESSORS
    // --------------------------------------------------------------------------------------------
    get isReadOnly() {
        return this.readonly;
    }
    get inTransaction() {
        return (this.state === 3 /* active */);
    }
    get isActive() {
        return (this.state <= 3 /* active */);
    }
    // MODEL METHODS
    // --------------------------------------------------------------------------------------------
    getOne(type, id) {
        return this.store.getOne(type, id);
    }
    getAll(type) {
        return this.store.getAll(type);
    }
    async fetchOne(type, selector, forUpdate) {
        if (!Model_1.isModelClass(type)) {
            throw new TypeError('Cannot fetch model: model type is invalid');
        }
        else if (!selector || (typeof selector !== 'object' && typeof selector !== 'string')) {
            throw new TypeError('Cannot fetch model: selector is invalid');
        }
        else if (forUpdate !== undefined && typeof forUpdate !== 'boolean') {
            throw new TypeError('Cannot fetch model: forUpdate flag is invalid');
        }
        else if (forUpdate && this.isReadOnly) {
            throw new errors_1.SessionError('Cannot fetch mutable model: session is read-only');
        }
        const qSelectModel = type.SelectQuery('single');
        const query = new qSelectModel(forUpdate || false, selector);
        return this.execute(query);
    }
    async fetchAll(type, selector, forUpdate) {
        if (!Model_1.isModelClass(type)) {
            throw new TypeError('Cannot fetch models: model type is invalid');
        }
        else if (!selector || (typeof selector !== 'object' && typeof selector !== 'string')) {
            throw new TypeError('Cannot fetch models: selector is invalid');
        }
        else if (forUpdate !== undefined && typeof forUpdate !== 'boolean') {
            throw new TypeError('Cannot fetch models: forUpdate flag is invalid');
        }
        else if (forUpdate && this.isReadOnly) {
            throw new errors_1.SessionError('Cannot fetch mutable models: session is read-only');
        }
        const qSelectModels = type.SelectQuery('list');
        const query = new qSelectModels(forUpdate || false, selector);
        return this.execute(query);
    }
    load(type, seed) {
        if (!Model_1.isModelClass(type))
            throw new TypeError('Cannot load model: model type is invalid');
        if (!this.isActive) {
            throw new errors_1.SessionError('Cannot load model: session has already been closed');
        }
        const model = new type(seed, false);
        this.store.insert(model, false);
        return model;
    }
    async create(type, seed) {
        if (!Model_1.isModelClass(type))
            throw new TypeError('Cannot create model: model type is invalid');
        if (!this.isActive) {
            throw new errors_1.SessionError('Cannot create model: session has already been closed');
        }
        else if (this.isReadOnly) {
            throw new errors_1.SessionError('Cannot create model: session is read-only');
        }
        // create new model
        const id = await type.getSchema().idGenerator.getNextId(this.logger, this);
        const createdOn = Date.now();
        const updatedOn = createdOn;
        const model = new type(Object.assign({ id }, seed, { createdOn, updatedOn }), true);
        // add the model to the store and return
        this.store.insert(model, true);
        return model;
    }
    delete(model) {
        if (!this.isActive) {
            throw new errors_1.SessionError('Cannot delete model: session has already been closed');
        }
        else if (this.isReadOnly) {
            throw new errors_1.SessionError('Cannot delete model: session is read-only');
        }
        this.store.delete(model);
        return model;
    }
    // SYNC METHODS
    // --------------------------------------------------------------------------------------------
    async flush() {
        if (!this.isActive) {
            throw new errors_1.SessionError('Cannot flush session: session has already been closed');
        }
        else if (this.isReadOnly) {
            throw new errors_1.SessionError('Cannot flush session: session is read-only');
        }
        // build a list of sync queries
        const queries = this.store.getSyncQueries();
        if (queries.length === 0)
            return;
        // execute sync queries
        const promises = [];
        for (let query of queries) {
            promises.push(this.execute(query));
        }
        await Promise.all(promises);
        // clean changes from all models
        this.store.applyChanges();
    }
    async close(action) {
        if (!this.isActive) {
            throw new errors_1.SessionError('Cannot close session: session has already been closed');
        }
        else if (action !== 'commit' && action !== 'rollback') {
            throw new TypeError(`Cannot close session: '${action}' action is invalid`);
        }
        if (!this.inTransaction) {
            this.state = 5 /* closed */;
            return;
        }
        let closeError;
        try {
            let closePromise;
            if (action === 'commit') {
                this.logger && this.logger.debug('Committing and closing session');
                // flush changes, if needed
                const flushPromises = [];
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
                    if (this.store.hasChanges()) {
                        throw new errors_1.SessionError('Dirty models detected in read-only session');
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
            this.state = 4 /* closing */;
            await closePromise;
            this.store.applyChanges();
        }
        catch (error) {
            closeError = new errors_1.SessionError(`Error while closing session`, error);
        }
        this.releaseClient(closeError);
        if (closeError)
            throw closeError;
    }
    async execute(query) {
        if (!this.isActive) {
            throw new errors_1.SessionError('Cannot execute a query: session is closed');
        }
        let firstRequest;
        // make sure sessions starts out with BEGIN statement
        if (this.state === 1 /* pending */) {
            firstRequest = this.queueFirstRequest();
            this.state = 2 /* connecting */;
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
            catch (error) {
                this.logger && this.logger.trace(this.source, 'connect', Date.now() - start, false);
                error = new errors_1.ConnectionError('Cannot execute a query: database connection failed', error);
                // make all queued requests resolve to an error
                process.nextTick(() => {
                    for (let request of this.requests) {
                        request.abort(error);
                    }
                });
                // result will resolve to an error on next tick
                return result;
            }
            this.state = 3 /* active */;
        }
        // execute the entire request queue on next tick
        if (this.state === 3 /* active */) {
            process.nextTick(() => {
                const requests = this.requests;
                this.requests = [];
                for (let request of requests) {
                    this.client.query(request);
                }
            });
        }
        // return the result
        return result;
    }
    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    queueFirstRequest() {
        // create a request and add it to the request queue
        const request = new Request_1.Request(this.store, this.logger, this.source, this.logQueryText);
        this.requests.push(request);
        // add begin transaction query to the request
        const txStartQuery = this.readonly ? BEGIN_RO_TRANSACTION : BEGIN_RW_TRANSACTION;
        request.add(txStartQuery).catch((error) => {
            // TODO: log error?
        });
        return request;
    }
    appendToRequestQueue(query, firstRequest) {
        let result;
        if (query.values) {
            // if parameterized query, it must start a new request
            const request = new Request_1.Request(this.store, this.logger, this.source, this.logQueryText);
            this.requests.push(request);
            result = request.add(query);
            ;
        }
        else if (firstRequest) {
            result = firstRequest.add(query);
        }
        else {
            // try to append the query to the last request in the queue
            let request = this.requests[this.requests.length - 1];
            if (!request || request.isParameterized) {
                request = new Request_1.Request(this.store, this.logger, this.source, this.logQueryText);
                this.requests.push(request);
            }
            result = request.add(query);
            ;
        }
        return result;
    }
    releaseClient(error) {
        this.state = 5 /* closed */;
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
exports.DaoSession = DaoSession;
// TRANSACTION QUERIES
// ================================================================================================
const BEGIN_RO_TRANSACTION = {
    name: 'qBeginReadOnlyTransaction',
    text: 'BEGIN READ ONLY;'
};
const BEGIN_RW_TRANSACTION = {
    name: 'qBeginReadWriteTransaction',
    text: 'BEGIN READ WRITE;'
};
const COMMIT_TRANSACTION = {
    name: 'qCommitTransaction',
    text: 'COMMIT;'
};
const ROLLBACK_TRANSACTION = {
    name: 'qRollbackTransaction',
    text: 'ROLLBACK;'
};
//# sourceMappingURL=Session.js.map
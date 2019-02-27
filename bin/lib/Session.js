"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Command_1 = require("./Command");
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
        this.checkImmutable = options.checkImmutable;
        this.logger = logger;
        this.store = new Store_1.Store(options);
        this.state = 1 /* pending */;
        this.client = undefined;
        this.commands = [];
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
        return this.store.get(type, id);
    }
    getAll(type) {
        return this.store.getAll(type);
    }
    async fetchOne(type, selector, forUpdate) {
        if (!Model_1.isModelClass(type)) {
            throw new TypeError('Cannot fetch model: model type is invalid');
        }
        else if (typeof selector !== 'object' || selector === null) {
            throw new TypeError('Cannot fetch model: selector is invalid');
        }
        else if (forUpdate !== undefined && typeof forUpdate !== 'boolean') {
            throw new TypeError('Cannot fetch model: forUpdate flag is invalid');
        }
        else if (forUpdate && this.isReadOnly) {
            throw new errors_1.ConnectionError('Cannot fetch mutable model: session is read-only');
        }
        const qSelectModel = type.SelectQuery('single');
        const query = new qSelectModel(forUpdate || false, selector);
        return this.execute(query);
    }
    async fetchAll(type, selector, forUpdate) {
        if (!Model_1.isModelClass(type)) {
            throw new TypeError('Cannot fetch models: model type is invalid');
        }
        else if (typeof selector !== 'object' || selector === null) {
            throw new TypeError('Cannot fetch models: selector is invalid');
        }
        else if (forUpdate !== undefined && typeof forUpdate !== 'boolean') {
            throw new TypeError('Cannot fetch models: forUpdate flag is invalid');
        }
        else if (forUpdate && this.isReadOnly) {
            throw new errors_1.ConnectionError('Cannot fetch mutable models: session is read-only');
        }
        const qSelectModels = type.SelectQuery('list');
        const query = new qSelectModels(forUpdate || false, selector);
        return this.execute(query);
    }
    load(type, seed) {
        if (!Model_1.isModelClass(type))
            throw new TypeError('Cannot load model: model type is invalid');
        if (!this.isActive) {
            throw new errors_1.ConnectionError('Cannot load model: session has already been closed');
        }
        const model = new type(seed, false);
        this.store.insert(model, false);
        return model;
    }
    async create(type, seed) {
        if (!Model_1.isModelClass(type))
            throw new TypeError('Cannot create model: model type is invalid');
        if (!this.isActive) {
            throw new errors_1.ConnectionError('Cannot create model: session has already been closed');
        }
        else if (this.isReadOnly) {
            throw new errors_1.ConnectionError('Cannot create model: session is read-only');
        }
        // create new model
        const id = await type.getSchema().idGenerator.getNextId(this.logger, this); // TODO: get rid of any
        const createdOn = Date.now();
        const updatedOn = createdOn;
        const model = new type(Object.assign({ id }, seed, { createdOn, updatedOn }), true);
        // add the model to the store and return
        this.store.insert(model, true);
        return model;
    }
    delete(model) {
        if (this.isReadOnly) {
            throw new errors_1.ConnectionError('Cannot delete model: session is read-only');
        }
        this.store.delete(model);
        return model;
    }
    // SYNC METHODS
    // --------------------------------------------------------------------------------------------
    async flush() {
        if (!this.isActive) {
            throw new errors_1.ConnectionError('Cannot flush session: session has already been closed');
        }
        else if (this.isReadOnly) {
            throw new errors_1.ConnectionError('Cannot flush session: session is read-only');
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
            throw new errors_1.ConnectionError('Cannot close session: session has already been closed');
        }
        else if (action !== 'commit' && action !== 'rollback') {
            throw new errors_1.ConnectionError(`Cannot close session: '${action}' action is invalid`);
        }
        if (!this.inTransaction) {
            this.state = 5 /* closed */;
            return;
        }
        let closeError;
        try {
            let closePromise;
            if (action === 'commit') {
                this.logger.debug('Committing and closing session');
                // flush changes
                const flushPromises = [];
                if (this.checkImmutable || !this.isReadOnly) {
                    const queries = this.store.getSyncQueries();
                    if (queries.length > 0) {
                        if (this.isReadOnly)
                            throw new errors_1.ConnectionError('Cannot close session: dirty models detected in read-only session');
                        for (let query of queries) {
                            flushPromises.push(this.execute(query));
                        }
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
                this.logger.debug('Committing and closing session');
                closePromise = this.execute(ROLLBACK_TRANSACTION);
            }
            this.state = 4 /* closing */;
            await closePromise;
            this.store.applyChanges();
        }
        catch (error) {
            closeError = new errors_1.ConnectionError(`Cannot close session`, error);
        }
        this.releaseClient(closeError);
        if (closeError)
            throw closeError;
    }
    async execute(query) {
        if (!this.isActive) {
            throw new errors_1.ConnectionError('Cannot execute a query: session is closed');
        }
        let firstCommand;
        // make sure sessions starts out with BEGIN statement
        if (this.state === 1 /* pending */) {
            firstCommand = this.queueFirstCommand();
            this.state = 2 /* connecting */;
        }
        // add query to the command
        const result = this.appendToCommandQueue(query, firstCommand);
        // connect to database, but only if the BEGIN statement was queued in this context
        if (firstCommand) {
            const start = Date.now();
            try {
                this.logger.debug('Connecting to the database');
                this.client = await this.db.connect();
                this.logger.trace(this.source, 'connect', Date.now() - start, true);
            }
            catch (error) {
                this.logger.trace(this.source, 'connect', Date.now() - start, false);
                error = new errors_1.ConnectionError('Cannot execute a query: database connection failed', error);
                // make all queued commands resolve to an error
                process.nextTick(() => {
                    for (let command of this.commands) {
                        command.abort(error);
                    }
                });
                // result will resolve to an error on next tick
                return result;
            }
            this.state = 3 /* active */;
        }
        // execute the entire command queue on next tick
        if (this.state === 3 /* active */) {
            process.nextTick(() => {
                const commands = this.commands;
                this.commands = [];
                for (let command of commands) {
                    this.client.query(command);
                }
            });
        }
        // return the result
        return result;
    }
    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    queueFirstCommand() {
        // create a command and add it to the command queue
        const command = new Command_1.Command(this.store, this.logger, this.source, this.logQueryText);
        this.commands.push(command);
        // add begin transaction query to the command
        const txStartQuery = this.readonly ? BEGIN_RO_TRANSACTION : BEGIN_RW_TRANSACTION;
        command.add(txStartQuery).catch((error) => {
            // TODO: log error?
        });
        return command;
    }
    appendToCommandQueue(query, firstCommand) {
        let result;
        if (query.values) {
            // if parameterized query, it must start a new command
            const command = new Command_1.Command(this.store, this.logger, this.source, this.logQueryText);
            this.commands.push(command);
            result = command.add(query);
            ;
        }
        else if (firstCommand) {
            result = firstCommand.add(query);
        }
        else {
            // try to append the query to the last command in the queue
            let command = this.commands[this.commands.length - 1];
            if (!command || command.isParameterized) {
                command = new Command_1.Command(this.store, this.logger, this.source, this.logQueryText);
                this.commands.push(command);
            }
            result = command.add(query);
            ;
        }
        return result;
    }
    releaseClient(error) {
        this.state = 5 /* closed */;
        if (this.client) {
            this.client.release(error);
            this.client = undefined;
            this.logger.debug('Session closed');
        }
        else {
            this.logger.warn('Overlapping client release detected');
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
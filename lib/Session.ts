// IMPORTS
// ================================================================================================
import { Dao } from '@nova/core';
import { Query, SingleResultQuery, ListResultQuery, SessionOptions, Logger, TraceSource } from '@nova/pg-dao';
import { Client } from 'pg';
import { Command } from './Command';
import { Store } from './Store';
import { Model, isModelClass } from './Model';
import { ConnectionError } from './errors';

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
    private commands                : Command[];

    private readonly store          : Store;
    private readonly logger         : Logger;
    private readonly readonly       : boolean;
    private readonly logQueryText   : boolean;
    private readonly checkImmutable : boolean;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(db: SessionFactory, options: SessionOptions, source: TraceSource, logger: Logger) {

        this.db = db;
        this.source = source;

        this.readonly = options.readonly;
        this.logQueryText = options.logQueryText;
        this.checkImmutable = options.checkImmutable;
        this.logger = logger;
        this.store = new Store(options);

        this.state = DaoState.pending;
        this.client = undefined;
        this.commands = [];
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
        return this.store.get(type, id);
    }

    getAll<T extends typeof Model>(type: T): InstanceType<T>[] {
        return this.store.getAll(type);
    }

    async fetchOne<T extends typeof Model>(type: T, selector: object, forUpdate?: boolean): Promise<InstanceType<T> | undefined> {
        if (!isModelClass(type)) {
            throw new TypeError('Cannot fetch model: model type is invalid');
        }
        else if (typeof selector !== 'object' || selector === null) {
            throw new TypeError('Cannot fetch model: selector is invalid');
        }
        else if (forUpdate !== undefined && typeof forUpdate !== 'boolean') {
            throw new TypeError('Cannot fetch model: forUpdate flag is invalid');
        }

        const qSelectModel = type.SelectQuery('single');
        const query = new qSelectModel(forUpdate || false, selector);
        return this.execute(query);
    }

    async fetchAll<T extends typeof Model>(type: T, selector: object, forUpdate?: boolean): Promise<InstanceType<T>[]> {
        if (!isModelClass(type)) {
            throw new TypeError('Cannot fetch models: model type is invalid');
        }
        else if (typeof selector !== 'object' || selector === null) {
            throw new TypeError('Cannot fetch models: selector is invalid');
        }
        else if (forUpdate !== undefined && typeof forUpdate !== 'boolean') {
            throw new TypeError('Cannot fetch models: forUpdate flag is invalid');
        }

        const qSelectModels = type.SelectQuery('list');
        const query = new qSelectModels(forUpdate || false, selector);
        return this.execute(query);
    }

    load<T extends typeof Model>(type: T, seed: object): InstanceType<T> {
        if (!isModelClass(type)) throw new TypeError('Cannot load model: model type is invalid');
        if (!this.isActive) {
            throw new ConnectionError('Cannot load model: session has already been closed');
        }

        const model = new type(seed, false) as InstanceType<T>;
        this.store.insert(model, false);
        return model;
    }

    async create<T extends typeof Model>(type: T, seed: object): Promise<InstanceType<T>> {
        if (!isModelClass(type)) throw new TypeError('Cannot create model: model type is invalid');
        if (!this.isActive) {
            throw new ConnectionError('Cannot create model: session has already been closed');
        }

        // create new model
        const id = await type.getSchema().idGenerator.getNextId(this.logger, this as any); // TODO: get rid of any
        const createdOn = Date.now();
        const updatedOn = createdOn;
        const model = new type({ id, ...seed, createdOn, updatedOn }, true) as InstanceType<T>;

        // add the model to the store and return
        this.store.insert(model, true);
        return model;
    }

    delete<T extends Model>(model: T): T {
        this.store.delete(model);
        return model;
    }

    // SYNC METHODS
    // --------------------------------------------------------------------------------------------
    async flush(): Promise<void> {
        if (!this.isActive) {
            throw new ConnectionError('Cannot flush session: session has already been closed');
        }
        
        // don't attempt to sync read-only sessions when checkImmutable is not set
        if (this.isReadOnly && !this.checkImmutable) return;

        // build a list of sync queries
        const queries = this.store.getSyncQueries();
        if (queries.length === 0) return;
        if (this.isReadOnly) {
            throw new ConnectionError('Cannot flush session: dirty models detected in a read-only session');
        }

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
            throw new ConnectionError('Cannot close session: session has already been closed');
        }
        else if (action !== 'commit' && action !== 'rollback') {
            throw new ConnectionError(`Cannot close session: '${action}' action is invalid`);
        }

        if (!this.inTransaction) {
            this.state = DaoState.closed;
            return;
        }

        let closeError: Error | undefined;
        try {
            let closePromise: Promise<any>;
            if (action === 'commit') {
                // TODO: flush changes
                this.logger.debug('Committing and closing session');
                closePromise = this.execute(COMMIT_TRANSACTION);
            }
            else if (action === 'rollback') {
                this.logger.debug('Committing and closing session');
                closePromise = this.execute(ROLLBACK_TRANSACTION);
            }
            this.state = DaoState.closing;
            await closePromise!;
        }
        catch (error) {
            closeError = new ConnectionError(`Cannot close session`, error);
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
            throw new ConnectionError('Cannot execute a query: session is closed');
        }

        let firstCommand: Command | undefined;

        // make sure sessions starts out with BEGIN statement
        if (this.state === DaoState.pending) {
            firstCommand = this.queueFirstCommand();
            this.state = DaoState.connecting;
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
            catch(error) {
                this.logger.trace(this.source, 'connect', Date.now() - start, false);
                error = new ConnectionError('Cannot execute a query: database connection failed', error);

                // make all queued commands resolve to an error
                process.nextTick(() => {
                    for (let command of this.commands) {
                        command.abort(error);
                    }
                });

                // result will resolve to an error on next tick
                return result;
            }
            this.state = DaoState.active;
        }

        // execute the entire command queue on next tick
        if (this.state === DaoState.active) {
            process.nextTick(() => {
                const commands = this.commands;
                this.commands = [];
    
                for (let command of commands) {
                    this.client!.query(command as any);
                }
            });
        }
        
        // return the result
        return result;
    }

    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    private queueFirstCommand(): Command {
        // create a command and add it to the command queue
        const command = new Command(this.store, this.logger, this.source, this.logQueryText);
        this.commands.push(command);

        // add begin transaction query to the command
        const txStartQuery = this.readonly ? BEGIN_RO_TRANSACTION : BEGIN_RW_TRANSACTION;
        command.add(txStartQuery).catch((error) => {
            // TODO: log error?
        });
        return command;
    }

    private appendToCommandQueue(query: Query, firstCommand?: Command): Promise<any> {
        let result: any;
        if (query.values) {
            // if parameterized query, it must start a new command
            const command = new Command(this.store, this.logger, this.source, this.logQueryText);
            this.commands.push(command);
            result = command.add(query);;
        }
        else if (firstCommand) {
            result = firstCommand.add(query);
        }
        else {
            // try to append the query to the last command in the queue
            let command = this.commands[this.commands.length - 1];
            if (!command || command.isParameterized) {
                command = new Command(this.store, this.logger, this.source, this.logQueryText);
                this.commands.push(command);
            }
            result = command.add(query);;
        }

        return result;
    }

    private releaseClient(error?: Error) {
        this.state = DaoState.closed;
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
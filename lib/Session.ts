// IMPORTS
// ================================================================================================
import { Dao, Query, SingleResultQuery, ListResultQuery, SessionOptions, Logger, TraceSource } from '@nova/pg-dao';
import { Client } from 'pg';
import { ConnectionError } from './errors';
import { Command } from './Command';

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

    private readonly logger         : Logger;
    private readonly readonly       : boolean;
    private readonly logQueryText   : boolean;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(db: SessionFactory, options: SessionOptions, source: TraceSource, logger: Logger) {

        this.db = db;
        this.source = source;

        this.readonly = options.readonly;
        this.logQueryText = options.logQueryText;
        this.logger = logger;

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

    // CLOSE METHODS
    // --------------------------------------------------------------------------------------------
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
        const command = new Command(this.logger, this.source, this.logQueryText);
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
            const command = new Command(this.logger, this.source, this.logQueryText);
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
                command = new Command(this.logger, this.source, this.logQueryText);
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
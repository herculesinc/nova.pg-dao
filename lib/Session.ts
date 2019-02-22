// IMPORTS
// ================================================================================================
import { Dao, Query, SessionOptions, Logger, TraceSource } from '@nova/pg-dao';
import { Client } from 'pg';
import { ConnectionError } from './errors';
import { Command } from './Command';

// INTERFACES AND ENUMS
// ================================================================================================
const enum DaoState {
    pending = 1, active, closing, closed
};

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
    async execute<T>(query: Query<T>): Promise<any> {
        if (!this.isActive) {
            throw new ConnectionError('Cannot execute a query: session is closed');
        }

        // create a command
        const command = new Command(this.logger, this.source, this.logQueryText);

        // connect to the database and start a transaction
        if (!this.inTransaction) {
            const start = Date.now();
            try {
                this.logger.debug('Connecting to the database');
                this.client = await this.db.connect();
                this.logger.trace(this.source, 'connect', Date.now() - start, true);
            }
            catch(error) {
                this.logger.trace(this.source, 'connect', Date.now() - start, false);
                throw new ConnectionError('Cannot execute a query: database connection failed', error);
            }

            const txStartQuery = this.readonly ? BEGIN_RO_TRANSACTION : BEGIN_RW_TRANSACTION;
            command.add(txStartQuery).catch((error) => {
                // TODO: log error?
            });
            this.state = DaoState.active;
        }

        // execute query
        const result = command.add(query);
        this.client!.query(command as any);
        
        return result;
    }

    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
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
// IMPORTS
// ================================================================================================
import { Dao, Query, SessionOptions, Logger, TraceSource, TraceCommand } from '@nova/pg-dao';
import { Pool, Client, QueryConfig, QueryResult } from 'pg';
import { ConnectionError, QueryError, ParseError } from './errors';

// INTERFACES AND ENUMS
// ================================================================================================
const enum DaoState {
    pending = 1, active, closing, closed
}

// CLASS DEFINITION
// ================================================================================================
export class DaoSession implements Dao {

    private readonly pool       : Pool;
    private readonly source     : TraceSource;

    private state               : DaoState;
    private client?             : Client;

    private readonly logger         : Logger;
    private readonly readonly       : boolean;
    private readonly logQueryText   : boolean;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(pool: Pool, options: SessionOptions, source: TraceSource, logger: Logger) {

        this.pool = pool;
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
        this.state = DaoState.closing;
        try {
            if (action === 'commit') {
                this.logger.debug('Committing and closing session');
                await this.client!.query(COMMIT_TRANSACTION.text);
            }
            else if (action === 'rollback') {
                this.logger.debug('Committing and closing session');
                await this.client!.query(ROLLBACK_TRANSACTION.text);
            }
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

        const start = Date.now();

        // connect to the database and start a transaction
        if (!this.inTransaction) {
            this.logger.debug('Connecting to the database');
            this.client = await this.pool.connect();

            if (this.readonly) {
                this.logger.debug('Starting transaction in read-only mode');
                await this.client.query(BEGIN_RO_TRANSACTION.text);
            }
            else {
                this.logger.debug('Starting transaction in read-write mode');
                await this.client.query(BEGIN_RW_TRANSACTION.text);
            }
            this.state = DaoState.active;
        }

        const command: TraceCommand = {
            name    : query.name || 'unnamed',
            text    : this.logQueryText ? query.text : undefined
        };

        // execute query
        let result: QueryResult;
        try {
            const pgQuery = toPgQuery(query);
            result = await this.client!.query(pgQuery);
        }
        catch (error) {
            this.logger.trace(this.source, command, Date.now() - start, false);
            throw new QueryError(`Failed to execute '${query.name}' query`, error);
        }

        // process result
        let rows: any[] = [];
        if (result && query.handler) {
            try {
                for (let row of result.rows) {
                    rows.push(query.handler.parse(row));
                }
            }
            catch (error) {
                throw new ParseError(`Failed to parse results for '${query.name}' query`, error);
            }
        }
        else {
            rows = result.rows;
        }

        // log query execution
        this.logger.trace(this.source, command, Date.now() - start, true);

        // return the result
        if (query.mask === 'single') {
            return rows[0];
        }
        else if (query.mask === 'list') {
            return rows;
        }
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

// HELPER FUNCTIONS
// ================================================================================================
function toPgQuery(query: Query): QueryConfig {
    return {
        text    : query.text,
        values  : query.values && query.values.length > 0 ? query.values : undefined,
        rowMode : query.mode === 'array' ? 'array' : undefined
    };
}

// TRANSACTION QUERIES
// ================================================================================================
const BEGIN_RO_TRANSACTION: Query = {
    name: 'qBeginTransaction',
    text: 'BEGIN READ ONLY;'
};

const BEGIN_RW_TRANSACTION: Query = {
    name: 'qBeginTransaction',
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
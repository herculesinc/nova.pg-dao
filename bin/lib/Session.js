"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("./errors");
// CLASS DEFINITION
// ================================================================================================
class DaoSession {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(pool, options, source, logger) {
        this.pool = pool;
        this.source = source;
        this.readonly = options.readonly;
        this.logQueryText = options.logQueryText;
        this.logger = logger;
        this.state = 1 /* pending */;
        this.client = undefined;
    }
    // PUBLIC ACCESSORS
    // --------------------------------------------------------------------------------------------
    get isReadOnly() {
        return this.readonly;
    }
    get inTransaction() {
        return (this.state === 2 /* active */);
    }
    get isActive() {
        return (this.state <= 2 /* active */);
    }
    // CLOSE METHODS
    // --------------------------------------------------------------------------------------------
    async close(action) {
        if (!this.isActive) {
            throw new errors_1.ConnectionError('Cannot close session: session has already been closed');
        }
        else if (action !== 'commit' && action !== 'rollback') {
            throw new errors_1.ConnectionError(`Cannot close session: '${action}' action is invalid`);
        }
        if (!this.inTransaction) {
            this.state = 4 /* closed */;
            return;
        }
        let closeError;
        this.state = 3 /* closing */;
        try {
            if (action === 'commit') {
                this.logger.debug('Committing and closing session');
                await this.client.query(COMMIT_TRANSACTION.text);
            }
            else if (action === 'rollback') {
                this.logger.debug('Committing and closing session');
                await this.client.query(ROLLBACK_TRANSACTION.text);
            }
        }
        catch (error) {
            closeError = new errors_1.ConnectionError(`Cannot close session`, error);
        }
        this.releaseClient(closeError);
        if (closeError)
            throw closeError;
    }
    // EXECUTE METHOD
    // --------------------------------------------------------------------------------------------
    async execute(query) {
        if (!this.isActive) {
            throw new errors_1.ConnectionError('Cannot execute a query: session is closed');
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
            this.state = 2 /* active */;
        }
        const command = {
            name: query.name || 'unnamed',
            text: this.logQueryText ? query.text : undefined
        };
        // execute query
        let result;
        try {
            const pgQuery = toPgQuery(query);
            result = await this.client.query(pgQuery);
        }
        catch (error) {
            this.logger.trace(this.source, command, Date.now() - start, false);
            throw new errors_1.QueryError(`Failed to execute '${query.name}' query`, error);
        }
        // process result
        let rows = [];
        if (result && query.handler) {
            try {
                for (let row of result.rows) {
                    rows.push(query.handler.parse(row));
                }
            }
            catch (error) {
                throw new errors_1.ParseError(`Failed to parse results for '${query.name}' query`, error);
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
    releaseClient(error) {
        this.state = 4 /* closed */;
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
// HELPER FUNCTIONS
// ================================================================================================
function toPgQuery(query) {
    return {
        text: query.text,
        values: query.values && query.values.length > 0 ? query.values : undefined,
        rowMode: query.mode === 'array' ? 'array' : undefined
    };
}
// TRANSACTION QUERIES
// ================================================================================================
const BEGIN_RO_TRANSACTION = {
    name: 'qBeginTransaction',
    text: 'BEGIN READ ONLY;'
};
const BEGIN_RW_TRANSACTION = {
    name: 'qBeginTransaction',
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
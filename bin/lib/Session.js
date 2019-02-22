"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("./errors");
const Command_1 = require("./Command");
;
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
        try {
            let closePromise;
            if (action === 'commit') {
                this.logger.debug('Committing and closing session');
                closePromise = this.execute(COMMIT_TRANSACTION);
            }
            else if (action === 'rollback') {
                this.logger.debug('Committing and closing session');
                closePromise = this.execute(ROLLBACK_TRANSACTION);
            }
            this.state = 3 /* closing */;
            await closePromise;
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
        // create a command
        const command = new Command_1.Command(this.logger, this.source, this.logQueryText);
        // connect to the database and start a transaction
        if (!this.inTransaction) {
            const start = Date.now();
            try {
                this.logger.debug('Connecting to the database');
                this.client = await this.db.connect();
                this.logger.trace(this.source, 'connect', Date.now() - start, true);
            }
            catch (error) {
                this.logger.trace(this.source, 'connect', Date.now() - start, false);
                throw new errors_1.ConnectionError('Cannot execute a query: database connection failed', error);
            }
            const txStartQuery = this.readonly ? BEGIN_RO_TRANSACTION : BEGIN_RW_TRANSACTION;
            command.add(txStartQuery).catch((error) => {
                // TODO: log error?
            });
            this.state = 2 /* active */;
        }
        // execute query
        const result = command.add(query);
        this.client.query(command);
        return result;
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
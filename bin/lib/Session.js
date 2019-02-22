"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("./errors");
const Command_1 = require("./Command");
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
            this.state = 5 /* closed */;
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
            this.state = 4 /* closing */;
            await closePromise;
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
        const command = new Command_1.Command(this.logger, this.source, this.logQueryText);
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
            const command = new Command_1.Command(this.logger, this.source, this.logQueryText);
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
                command = new Command_1.Command(this.logger, this.source, this.logQueryText);
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
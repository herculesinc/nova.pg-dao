"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const results_1 = require("./results");
const util_1 = require("./util");
// CLASS DEFINITION
// ================================================================================================
class Command {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(logger, source, logQueryText) {
        this.logger = logger;
        this.source = source;
        this.logQueryText = logQueryText;
        this.text = '';
        this.queries = [];
        this.results = [];
        this.cursor = 0;
    }
    // PUBLIC ACCESSORS
    // --------------------------------------------------------------------------------------------
    get isParameterized() {
        return (this.values !== undefined);
    }
    // PUBLIC METHODS
    // --------------------------------------------------------------------------------------------
    add(query) {
        // TODO: validate query
        this.text = this.text + query.text;
        this.queries.push(query);
        if (query.values) {
            this.values = [];
            for (let value of query.values) {
                this.values.push(util_1.prepareValue(value));
            }
        }
        const result = results_1.createResult(query);
        this.results.push(result);
        return result.promise;
    }
    // QUERY METHODS
    // --------------------------------------------------------------------------------------------
    submit(connection) {
        // TODO: validate text / values
        this.start = Date.now();
        if (this.isParameterized) {
            connection.parse({ text: this.text }, true);
            connection.bind({ values: this.values }, true);
            connection.describe({ type: 'P' }, true);
            connection.execute({ rows: 0 }, true);
            connection.flush();
        }
        else {
            connection.query(this.text);
        }
    }
    handleRowDescription(message) {
        if (this.cursor >= this.results.length) {
            // TODO: throw error
        }
        this.results[this.cursor].addFields(message.fields);
    }
    handleDataRow(message) {
        if (this.canceledDueToError)
            return;
        try {
            this.results[this.cursor].addRow(message.fields);
        }
        catch (err) {
            this.canceledDueToError = err;
        }
    }
    handleCommandComplete(message, connection) {
        this.results[this.cursor].applyCommandComplete(message);
        this.cursor++;
        if (this.isParameterized) {
            connection.sync();
        }
    }
    handleReadyForQuery(connection) {
        if (this.canceledDueToError) {
            return this.handleError(this.canceledDueToError, connection);
        }
        const ts = Date.now();
        for (let i = 0; i < this.results.length; i++) {
            const command = buildTraceCommand(this.queries[i], this.logQueryText);
            this.logger.trace(this.source, command, ts - this.start, true);
            this.results[i].end();
        }
    }
    handleEmptyQuery(connection) {
        if (this.isParameterized) {
            connection.sync();
        }
    }
    handleError(error, connection) {
        if (this.isParameterized) {
            connection.sync();
        }
        if (this.canceledDueToError) {
            error = this.canceledDueToError;
            this.canceledDueToError = undefined;
        }
        const ts = Date.now();
        for (let i = 0; i < this.results.length; i++) {
            const command = buildTraceCommand(this.queries[i], this.logQueryText);
            this.logger.trace(this.source, command, ts - this.start, false);
            this.results[i].end(error);
        }
    }
    handlePortalSuspended(connection) {
    }
    handleCopyInResponse(connection) {
    }
    handleCopyData(message, connection) {
    }
}
exports.Command = Command;
// HELPER FUNCTIONS
// ================================================================================================
function buildTraceCommand(query, logQueryText) {
    return {
        name: query.name || 'unnamed',
        text: logQueryText ? query.text : undefined
    };
}
//# sourceMappingURL=Command.js.map
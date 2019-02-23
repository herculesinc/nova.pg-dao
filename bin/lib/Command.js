"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const results_1 = require("./results");
const errors_1 = require("./errors");
const util = require("./util");
// MODULE VARIABLES
// ================================================================================================
const COMMAND_COMPLETE_REGEX = /^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/;
// CLASS DEFINITION
// ================================================================================================
class Command {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(logger, source, logQueryText) {
        this.id = util.generateTimeId();
        this.source = source;
        this.logger = logger;
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
        if (!query)
            throw new TypeError('Cannot add query to command: query is undefined');
        if (this.values) {
            throw new errors_1.QueryError('Cannot add query to command: command already contains parameterized query');
        }
        this.text = this.text + validateQueryText(query.text);
        this.queries.push(query);
        if (query.values) {
            if (!Array.isArray(query.values)) {
                throw new errors_1.QueryError(`Query values must be an array`);
            }
            this.values = [];
            for (let value of query.values) {
                this.values.push(util.prepareValue(value));
            }
        }
        else if (query.values !== undefined) {
            throw new errors_1.QueryError(`Query values must be an array`);
        }
        const result = results_1.createResult(query);
        this.results.push(result);
        return result.promise;
    }
    submit(connection) {
        if (!this.text) {
            throw new errors_1.QueryError('Cannot submit a command: query text is missing');
        }
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
    abort(error) {
        if (this.start) {
            throw new errors_1.QueryError('Cannot abort a command: execution already started');
        }
        const ts = Date.now();
        for (let i = 0; i < this.results.length; i++) {
            this.logResultTrace(this.queries[i], this.results[i], false, ts);
            this.results[i].end(error);
        }
    }
    // MESSAGE HANDLERS
    // --------------------------------------------------------------------------------------------
    handleRowDescription(message) {
        if (this.canceledDueToError)
            return;
        if (this.cursor >= this.results.length) {
            this.canceledDueToError = new errors_1.QueryError('A query cannot contain multiple statements');
            return;
        }
        this.results[this.cursor].addFields(message.fields);
    }
    handleDataRow(message) {
        if (this.canceledDueToError)
            return;
        try {
            this.results[this.cursor].addRow(message.fields);
        }
        catch (error) {
            const query = this.queries[this.cursor];
            this.canceledDueToError = new errors_1.ParseError(`Failed to parse results for ${query.name} query`, error);
        }
    }
    handleCommandComplete(message, connection) {
        const parsed = parseCommandComplete(message);
        this.results[this.cursor].complete(parsed.command, parsed.rows);
        this.cursor++;
        if (this.isParameterized) {
            connection.sync();
        }
    }
    handleReadyForQuery(connection) {
        if (this.canceledDueToError) {
            this.handleError(this.canceledDueToError, connection);
            return;
        }
        const ts = Date.now();
        for (let i = 0; i < this.results.length; i++) {
            this.logResultTrace(this.queries[i], this.results[i], true, ts);
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
            this.logResultTrace(this.queries[i], this.results[i], false, ts);
            this.results[i].end(error);
        }
    }
    handlePortalSuspended(connection) {
        throw new errors_1.QueryError('Handling of portalSuspended messages is not supported');
    }
    handleCopyInResponse(connection) {
        throw new errors_1.QueryError('Handling of copyInResponse messages is not supported');
    }
    handleCopyData(message, connection) {
        throw new errors_1.QueryError('Handling of copyData messages is not supported');
    }
    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    logResultTrace(query, result, success, endTs) {
        const command = {
            name: query.name || 'unnamed',
            text: this.logQueryText ? query.text : result.command
        };
        const details = {
            commandId: this.id,
            rowCount: result.rowCount + ''
        };
        this.logger.trace(this.source, command, endTs - this.start, success, details);
    }
}
exports.Command = Command;
// HELPER FUNCTIONS
// ================================================================================================
function validateQueryText(text) {
    if (typeof text !== 'string')
        throw new TypeError('Query text must be a string');
    text = text.trim();
    if (text === '')
        throw new TypeError('Query text cannot be an empty string');
    if (text.charAt(text.length - 1) !== ';') {
        text = text + ';';
    }
    return text;
}
function parseCommandComplete(message) {
    let command, rows;
    const match = COMMAND_COMPLETE_REGEX.exec(message.text);
    if (match) {
        command = match[1];
        if (match[3]) {
            rows = Number.parseInt(match[3], 10);
        }
        else if (match[2]) {
            rows = Number.parseInt(match[2], 10);
        }
        else {
            rows = 0;
        }
    }
    else {
        command = 'UNKNOWN';
        rows = 0;
    }
    return { command, rows };
}
//# sourceMappingURL=Command.js.map
// IMPORTS
// ================================================================================================
import { Logger, TraceSource, TraceCommand, Exception } from '@nova/core';
import { Submittable, Connection, RowDescription, DataRow, CommandComplete } from 'pg';
import { Query, QueryTextLogLevel } from '@nova/pg-dao';
import { Result, createResult } from './results';
import { Store } from './Store'
import { QueryError, ParseError, ModelError } from './errors';
import * as util from './util';

// MODULE VARIABLES
// ================================================================================================
const COMMAND_COMPLETE_REGEX = /^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/;

// CLASS DEFINITION
// ================================================================================================
export class Command implements Submittable {

    private readonly id             : string;
    private readonly store          : Store;
    private readonly source         : TraceSource;
    private readonly logger         : Logger;
    private readonly logQueryText   : QueryTextLogLevel;

    private text                    : string;
    private values?                 : any[];

    private readonly queries        : Query[];
    private readonly results        : Result[];

    private cursor                  : number;
    private start?                  : number;
    private canceledDueToError?     : Error;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(store: Store, logger: Logger, source: TraceSource, logQueryText: QueryTextLogLevel) {

        this.id = util.generateTimeId();
        this.store = store;
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
    get isParameterized(): boolean {
        return (this.values !== undefined);
    }

    // PUBLIC METHODS
    // --------------------------------------------------------------------------------------------
    add(query: Query) {
        if (!query) throw new TypeError('Cannot add query to command: query is undefined');
        if (this.values) {
            throw new QueryError('Cannot add query to command: command already contains parameterized query');
        }

        this.text = this.text + validateQueryText(query.text);
        this.queries.push(query);

        if (query.values) {
            if (!Array.isArray(query.values)) {
                throw new QueryError(`Query values must be an array`);
            }

            this.values = [];
            for (let value of query.values) {
                this.values.push(util.prepareValue(value));
            }
        }
        else if (query.values !== undefined) {
            throw new QueryError(`Query values must be an array`);
        }

        const result = createResult(query, this.store);
        this.results.push(result);
        return result.promise;
    }

    submit(connection: Connection) {
        if (!this.text) {
            throw new QueryError('Cannot submit a command: query text is missing');
        }

        this.start = Date.now();
        if (this.isParameterized) {
            connection.parse({ text: this.text! }, true);
            connection.bind({ values: this.values! }, true);
            connection.describe({ type: 'P' }, true);
            connection.execute({ rows: 0 }, true);
            connection.flush();
        } else {
            connection.query(this.text!);
        }
    }

    abort(error: Error) {
        if (this.start) {
            throw new QueryError('Cannot abort a command: execution already started');
        }

        const ts = Date.now();
        for (let i = 0; i < this.results.length; i++) {
            this.logResultTrace(this.queries[i], this.results[i], false, ts);
            this.results[i].end(error);
        }
    }

    // MESSAGE HANDLERS
    // --------------------------------------------------------------------------------------------
    handleRowDescription(message: RowDescription) {
        if (this.canceledDueToError) return;
        if (this.cursor >= this.results.length) {
            this.canceledDueToError = new QueryError('A query cannot contain multiple statements');
            return;
        }
        this.results[this.cursor].addFields(message.fields);
    }

    handleDataRow(message: DataRow) {
        if (this.canceledDueToError) return;

        try {
            this.results[this.cursor].addRow(message.fields);
        } catch (error) {
            if (error instanceof Exception) {
                this.canceledDueToError = error;
            }
            else {
                const query = this.queries[this.cursor];
                this.canceledDueToError = new ParseError(`Failed to parse results for ${query.name} query`, error);
            }
        }
    }

    handleCommandComplete(message: CommandComplete, connection: Connection) {
        const parsed = parseCommandComplete(message);
        this.results[this.cursor].complete(parsed.command, parsed.rows);
        this.cursor++;
        
        if (this.isParameterized) {
            connection.sync();
        }
    }

    handleReadyForQuery(connection: Connection) {
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

    handleEmptyQuery(connection: Connection) {
        if (this.isParameterized) {
            connection.sync();
        }
    }

    handleError(error: Error, connection: Connection) {
        if (this.isParameterized) {
            connection.sync()
        }
        
        if (this.canceledDueToError) {
            error = this.canceledDueToError
            this.canceledDueToError = undefined;
        }

        if (error instanceof Exception === false) {
            error = new QueryError(error);
        }
        
        const ts = Date.now();
        for (let i = 0; i < this.results.length; i++) {
            this.logResultTrace(this.queries[i], this.results[i], false, ts);
            this.results[i].end(error);
        }
    }

    handlePortalSuspended(connection: Connection) {
        throw new QueryError('Handling of portalSuspended messages is not supported');
    }

    handleCopyInResponse(connection: Connection) {
        throw new QueryError('Handling of copyInResponse messages is not supported');
    }

    handleCopyData(message: any, connection: Connection) {
        throw new QueryError('Handling of copyData messages is not supported');
    }

    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    private logResultTrace(query: Query, result: Result, success: boolean, endTs: number) {
        let logQueryText = this.logQueryText > QueryTextLogLevel.never;
        if (this.logQueryText === QueryTextLogLevel.onError && success) {
            logQueryText = false;
        }

        const command: TraceCommand = {
            name    : query.name || 'unnamed',
            text    : logQueryText ? query.text : result.command
        };

        const details = {
            commandId   : this.id,
            rowCount    : result.rowCount + ''
        };

        const duration = (this.start === undefined) ? 0 : endTs - this.start;
        this.logger.trace(this.source, command, duration, success, details);
    }
}

// HELPER FUNCTIONS
// ================================================================================================
function validateQueryText(text: string) {
    if (typeof text !== 'string') throw new QueryError('Query text must be a string');
    text = text.trim();
    if (text === '') throw new QueryError('Query text cannot be an empty string');
    if (text.charAt(text.length - 1) !== ';') {
        text = text + ';';
    }
    return text;
}

function parseCommandComplete(message: CommandComplete) {
    let command: string, rows: number;

    const match = COMMAND_COMPLETE_REGEX.exec(message.text);
    if (match) {
        command = match[1];
        if (match[3]) {
            rows = Number.parseInt(match[3], 10);
        } else if (match[2]) {
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

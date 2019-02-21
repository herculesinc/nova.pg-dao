// IMPORTS
// ================================================================================================
import { Logger, TraceSource, TraceCommand } from '@nova/core';
import { Result, createResult } from './results';
import { Query } from './Query';
import { prepareValue } from './util';

// INTERFACES
// ================================================================================================
interface IQuery {
    submit(connection: Connection): void;
    handleRowDescription(message: RowDescription): void;
    handleDataRow(message: DataRow): void;
    handleCommandComplete(message: CommandComplete, connection: Connection): void;

    handleReadyForQuery(connection: Connection): void;
    handleEmptyQuery(connection: Connection): void;
    handleError(error: Error, connection: Connection): void;

    handlePortalSuspended(connection: Connection): void;
    handleCopyInResponse(connection: Connection): void;
    handleCopyData(message: any, connection: Connection): void;
}

interface Connection {

    query(text: string): void;

    parse(query: { name?: string; text: string; types?: any[]; }, more: boolean): void;
    bind(config: { portal?: string; statement?: string; binary?: boolean; values: any[]; }, more: boolean): void;
    describe(msg: { type: string; name?: string; }, more: boolean): void;
    execute(config: { portal?: string; rows: number; }, more: boolean): void;

    flush(): void;
    sync(): void;
}

interface RowDescription {
    name        : 'rowDescription';
    length      : number;
    fieldCount  : number;
    fields      : FieldDescription[];
}

interface FieldDescription {
    name            : string;
    tableID         : number;
    columnID        : number;
    dataTypeID      : number;
    dataTypeSize    : number;
    dataTypeModifier: number;
    format          : string;
}

interface DataRow {
    name            : 'dataRow';
    length          : number;
    fieldCount      : number;
    fields          : string[];
}

interface CommandComplete {
    name            : 'commandComplete';
    length          : number;
    text            : string;
}

// CLASS DEFINITION
// ================================================================================================
export class Command implements IQuery {

    private readonly source         : TraceSource;
    private readonly logger         : Logger;
    private readonly logQueryText   : boolean;

    private text                : string;
    private values?             : any[];

    private queries             : Query[];
    private results             : Result[];

    private cursor              : number;
    private start?              : number;
    private canceledDueToError? : Error;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(logger: Logger, source: TraceSource, logQueryText: boolean) {

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
    get isParameterized(): boolean {
        return (this.values !== undefined);
    }

    // PUBLIC METHODS
    // --------------------------------------------------------------------------------------------
    add(query: Query) {
        // TODO: validate query
        this.text = this.text + query.text;
        this.queries.push(query);

        if (query.values) {
            this.values = [];
            for (let value of query.values) {
                this.values.push(prepareValue(value));
            }
        }

        const result = createResult(query);
        this.results.push(result);
        return result.promise;
    }

    // QUERY METHODS
    // --------------------------------------------------------------------------------------------
    submit(connection: Connection) {
        // TODO: validate text / values
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

    handleRowDescription(message: RowDescription) {
        if (this.cursor >= this.results.length) {
            // TODO: throw error
        }
        this.results[this.cursor].addFields(message.fields);
    }

    handleDataRow(message: DataRow) {
        if (this.canceledDueToError) return;

        try {
            this.results[this.cursor].addRow(message.fields);
        } catch (err) {
            this.canceledDueToError = err;
        }
    }

    handleCommandComplete(message: CommandComplete, connection: Connection) {
        this.results[this.cursor].complete(message.text);
        this.cursor++;
        
        if (this.isParameterized) {
            connection.sync();
        }
    }

    handleReadyForQuery(connection: any) {
        if (this.canceledDueToError) {
            return this.handleError(this.canceledDueToError, connection)
        }

        const ts = Date.now();
        for (let i = 0; i < this.results.length; i++) {
            const command = buildTraceCommand(this.queries[i], this.logQueryText);
            this.logger.trace(this.source, command, ts - this.start!, true);
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
        
        const ts = Date.now();
        for (let i = 0; i < this.results.length; i++) {
            const command = buildTraceCommand(this.queries[i], this.logQueryText);
            this.logger.trace(this.source, command, ts - this.start!, false);
            this.results[i].end(error);
        }
    }

    handlePortalSuspended(connection: Connection) {

    }

    handleCopyInResponse(connection: Connection) {

    }

    handleCopyData(message: any, connection: Connection) {

    }
}

// HELPER FUNCTIONS
// ================================================================================================
function buildTraceCommand(query: Query, logQueryText: boolean): TraceCommand {
    return {
        name    : query.name || 'unnamed',
        text    : logQueryText ? query.text : undefined
    };
}
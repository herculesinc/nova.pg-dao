// IMPORTS
// ================================================================================================
import { types } from 'pg';
import { QueryMask, FieldParser } from '@nova/pg-dao';
import { Result, FieldDescription, CommandComplete } from './index';

// MODULE VARIABLES
// ================================================================================================
const getTypeParser = types.getTypeParser;

// INTERFACES
// ================================================================================================
const enum RowsToParse {
    zero = 0, one = 1, many = 2
};

// CLASS DEFINITION
// ================================================================================================
export class ObjectResult implements Result {

    readonly rows   : any[];
    
    readonly fields : FieldDescription[];
    readonly parsers: FieldParser[];
    readonly promise: Promise<any>;

    private complete    : boolean;
    private rowsToParse : RowsToParse;
    private resolve?    : (result?: any) => void;
    private reject?     : (error: Error) => void;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(mask: QueryMask) {
        this.rows = [];
        this.fields = [];
        this.parsers = [];
        this.complete = false;
        this.rowsToParse = (mask === 'single') ? RowsToParse.one : RowsToParse.many;
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

    // PUBLIC ACCESSORS
    // --------------------------------------------------------------------------------------------
    get isComplete(): boolean {
        return this.complete;
    }

    // PUBLIC METHODS
    // --------------------------------------------------------------------------------------------
    addFields(fieldDescriptions: FieldDescription[]) {
        for (let i = 0; i < fieldDescriptions.length; i++) {
            let desc = fieldDescriptions[i];
            this.fields.push(desc);
            let parser = getTypeParser(desc.dataTypeID, desc.format || 'text');
            this.parsers.push(parser);
        }
    }

    addRow(rowData: string[])  {
        // no need to parse more than 1 row for 'single' query mask
        if (this.rowsToParse < RowsToParse.many) {
            if (this.rowsToParse === RowsToParse.one) {
                this.rowsToParse = RowsToParse.zero;
            }
            else {
                return;
            }
        }

        const row: any = {};
        for (let i = 0; i < rowData.length; i++) {
            let rawValue = rowData[i];
            let field = this.fields[i].name;
            if (rawValue !== null) {
                row[field] = this.parsers[i](rawValue);
            } else {
                row[field] = null;
            }
        }
        this.rows.push(row);
    }

    applyCommandComplete(command: CommandComplete) {
        this.complete = true;
    }

    end(error?: Error) {
        if (error) this.reject!(error);
        else this.resolve!(this.rowsToParse < RowsToParse.many ? this.rows[0] : this.rows);
    }
}
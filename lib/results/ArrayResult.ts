// IMPORTS
// ================================================================================================
import { types } from 'pg';
import { QueryMask } from '@nova/pg-dao';
import { Result, FieldDescription, CommandComplete } from './index';

// MODULE VARIABLES
// ================================================================================================
const getTypeParser = types.getTypeParser;

// INTERFACES
// ================================================================================================
type FieldParser = (value: string) => any;
const enum RowsToParse {
    zero = 0, one = 1, many = 2
};

// CLASS DEFINITION
// ================================================================================================
export class ArrayResult implements Result {

    readonly rows   : any[];

    readonly promise: Promise<any>;
    readonly fields : FieldDescription[];
    readonly parsers: FieldParser[];

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

    addRow(rowData: any[])  {
        if (this.rowsToParse < RowsToParse.many) {
            if (this.rowsToParse === RowsToParse.one) {
                this.rowsToParse = RowsToParse.zero;
            }
            else {
                return;
            }
        }

        const row = [];
        for (let i = 0; i < rowData.length; i++) {
            let rawValue = rowData[i];
            if (rawValue !== null) {
                row.push(this.parsers[i](rawValue));
            } else {
                row.push(null);
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
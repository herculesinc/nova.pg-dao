// IMPORTS
// ================================================================================================
import { QueryMask, ResultHandler } from '@nova/pg-dao';
import { Result, FieldDescription } from './index';
import { applyCommandComplete } from './util';

// INTERFACES
// ================================================================================================
const enum RowsToParse {
    zero = 0, one = 1, many = 2
};

// CLASS DEFINITION
// ================================================================================================
export class CustomResult implements Result {

    oid?            : number;
    command?        : string;
    rowCount?       : number;

    readonly rows   : any[];
    readonly promise: Promise<any>;
    readonly handler: ResultHandler;

    private rowsToParse : RowsToParse;
    private resolve?    : (result?: any) => void;
    private reject?     : (error: Error) => void;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(mask: QueryMask, handler: ResultHandler) {
        this.rows = [];
        this.handler = handler;
        this.rowsToParse = (mask === 'single') ? RowsToParse.one : RowsToParse.many;
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

    // PUBLIC ACCESSORS
    // --------------------------------------------------------------------------------------------
    get isComplete(): boolean {
        return (this.command !== undefined);
    }

    // PUBLIC METHODS
    // --------------------------------------------------------------------------------------------
    addFields(fieldDescriptions: FieldDescription[]) {
        // do nothing
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
        
        const row = this.handler.parse(rowData);
        this.rows.push(row);
    }

    complete(command: string) {
        applyCommandComplete(this, command);
    }

    end(error?: Error) {
        if (error) this.reject!(error);
        else this.resolve!(this.rowsToParse < RowsToParse.many ? this.rows[0] : this.rows);
    }
}
// IMPORTS
// ================================================================================================
import { types, FieldDescription } from 'pg';
import { QueryMask, ResultHandler, FieldDescriptor } from '@nova/pg-dao';
import { Result } from './index';

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
export class CustomResult implements Result {

    command?            : string;
    readonly rows       : any[];
    readonly fields     : FieldDescriptor[];
    readonly promise    : Promise<any>;
    readonly handler    : ResultHandler;

    private rowsToParse : RowsToParse;
    private resolve?    : (result?: any) => void;
    private reject?     : (error: Error) => void;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(mask: QueryMask, handler: ResultHandler) {
        this.rows = [];
        this.fields = [];
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

    get rowCount(): number {
        return this.rows.length;
    }

    // PUBLIC METHODS
    // --------------------------------------------------------------------------------------------
    addFields(fieldDescriptions: FieldDescription[]) {
        for (let i = 0; i < fieldDescriptions.length; i++) {
            let desc = fieldDescriptions[i];
            this.fields.push({
                name    : desc.name,
                oid     : desc.dataTypeID,
                parser  : getTypeParser(desc.dataTypeID, desc.format || 'text')
            });
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
        
        const row = this.handler.parse(rowData, this.fields);
        this.rows.push(row);
    }

    complete(command: string, rows: number) {
        this.command = command;
    }

    end(error?: Error) {
        if (error) this.reject!(error);
        else this.resolve!(this.rowsToParse < RowsToParse.many ? this.rows[0] : this.rows);
    }
}
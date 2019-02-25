// IMPORTS
// ================================================================================================
import { types } from 'pg';
import { QueryMask, FieldDescriptor } from '@nova/pg-dao';
import { Model } from '../Model';
import { Store } from '../Store';
import { Result, FieldDescription } from './index';

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
export class ModelResult implements Result {

    command?            : string;
    readonly rows       : string[][];
    readonly fields     : FieldDescriptor[];
    private models      : Model[];
    readonly modelClass : typeof Model;
    readonly store      : Store;
    readonly mutable    : boolean;
    readonly promise    : Promise<any>;

    private rowsToParse : RowsToParse;
    private resolve?    : (result?: any) => void;
    private reject?     : (error: Error) => void;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(mask: QueryMask, mutable: boolean, modelClass: typeof Model, store: Store) {
        this.rows = [];
        this.fields = [];
        this.models = [];
        this.modelClass = modelClass;
        this.store = store;
        this.mutable = mutable;
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
        
        this.rows.push(rowData);
    }

    complete(command: string, rows: number) {
        this.models = this.store.load(this.modelClass, this.rows, this.fields, this.mutable);
        this.command = command;
    }

    end(error?: Error) {
        if (error) this.reject!(error);
        else this.resolve!(this.rowsToParse < RowsToParse.many ? this.models[0] : this.models);
    }
}
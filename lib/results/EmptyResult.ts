// IMPORTS
// ================================================================================================
import { Result, FieldDescription } from './index';
import { applyCommandComplete } from './util';

// CLASS DEFINITION
// ================================================================================================
export class EmptyResult implements Result {

    oid?            : number;
    command?        : string;
    rowCount?       : number;

    readonly rows   : any[];
    readonly promise: Promise<any>;

    private resolve?: (result?: any) => void;
    private reject? : (error: Error) => void;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor() {
        this.rows = [];
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

    addRow(rowData: any[]): void {
        // do nothing
    }

    complete(command: string) {
        applyCommandComplete(this, command);
    }

    end(error?: Error) {
        if (error) this.reject!(error);
        else this.resolve!();
    }
}
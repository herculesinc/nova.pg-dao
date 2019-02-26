// IMPORTS
// ================================================================================================
import { Result, FieldDescription } from './index';

// CLASS DEFINITION
// ================================================================================================
export class EmptyResult implements Result {

    command?            : string;
    rowCount            : number;
    readonly promise    : Promise<any>;

    private resolve?    : (result?: any) => void;
    private reject?     : (error: Error) => void;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor() {
        this.rowCount = 0;
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

    addRow(rowData: string[]): void {
        // do nothing
    }

    complete(command: string, rows: number) {
        this.command = command;
        this.rowCount = rows;
    }

    end(error?: Error) {
        if (error) this.reject!(error);
        else this.resolve!();
    }
}
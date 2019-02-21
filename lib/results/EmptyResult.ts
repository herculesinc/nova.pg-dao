// IMPORTS
// ================================================================================================
import { Result, FieldDescription, CommandComplete } from './index';

// MODULE VARIABLES
// ================================================================================================
const matchRegexp = /^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/

// CLASS DEFINITION
// ================================================================================================
export class EmptyResult implements Result {

    oid?            : number;
    command?        : string;
    rowCount?       : number;

    readonly promise: Promise<any>;

    private resolve?: (result?: any) => void;
    private reject? : (error: Error) => void;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor() {
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

    applyCommandComplete(command: CommandComplete) {
        const match = matchRegexp.exec(command.text);
        if (match) {
            this.command = match[1];
            if (match[3]) {
                this.oid = Number.parseInt(match[2], 10);
                this.rowCount = Number.parseInt(match[3], 10);
            } else if (match[2]) {
                this.rowCount = Number.parseInt(match[2], 10);
            }
        }
    }

    end(error?: Error) {
        if (error) this.reject!(error);
        else this.resolve!();
    }
}
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// MODULE VARIABLES
// ================================================================================================
const matchRegexp = /^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/;
// CLASS DEFINITION
// ================================================================================================
class EmptyResult {
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
    get isComplete() {
        return (this.command !== undefined);
    }
    // PUBLIC METHODS
    // --------------------------------------------------------------------------------------------
    addFields(fieldDescriptions) {
        // do nothing
    }
    addRow(rowData) {
        // do nothing
    }
    applyCommandComplete(command) {
        const match = matchRegexp.exec(command.text);
        if (match) {
            this.command = match[1];
            if (match[3]) {
                this.oid = Number.parseInt(match[2], 10);
                this.rowCount = Number.parseInt(match[3], 10);
            }
            else if (match[2]) {
                this.rowCount = Number.parseInt(match[2], 10);
            }
        }
    }
    end(error) {
        if (error)
            this.reject(error);
        else
            this.resolve();
    }
}
exports.EmptyResult = EmptyResult;
//# sourceMappingURL=EmptyResult.js.map
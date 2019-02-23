"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// CLASS DEFINITION
// ================================================================================================
class EmptyResult {
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
    complete(command, rows) {
        this.command = command;
        this.rowCount = rows;
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
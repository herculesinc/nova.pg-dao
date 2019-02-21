"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
// CLASS DEFINITION
// ================================================================================================
class EmptyResult {
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
    complete(command) {
        util_1.applyCommandComplete(this, command);
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
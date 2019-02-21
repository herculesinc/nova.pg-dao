"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
;
// CLASS DEFINITION
// ================================================================================================
class CustomResult {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(mask, handler) {
        this.rows = [];
        this.handler = handler;
        this.complete = false;
        this.rowsToParse = (mask === 'single') ? 1 /* one */ : 2 /* many */;
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
    // PUBLIC ACCESSORS
    // --------------------------------------------------------------------------------------------
    get isComplete() {
        return this.complete;
    }
    // PUBLIC METHODS
    // --------------------------------------------------------------------------------------------
    addFields(fieldDescriptions) {
        // do nothing
    }
    addRow(rowData) {
        if (this.rowsToParse < 2 /* many */) {
            if (this.rowsToParse === 1 /* one */) {
                this.rowsToParse = 0 /* zero */;
            }
            else {
                return;
            }
        }
        const row = this.handler.parse(rowData);
        this.rows.push(row);
    }
    applyCommandComplete(command) {
        this.complete = true;
    }
    end(error) {
        if (error)
            this.reject(error);
        else
            this.resolve(this.rowsToParse < 2 /* many */ ? this.rows[0] : this.rows);
    }
}
exports.CustomResult = CustomResult;
//# sourceMappingURL=CustomResult.js.map
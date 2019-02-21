"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTS
// ================================================================================================
const pg_1 = require("pg");
// MODULE VARIABLES
// ================================================================================================
const getTypeParser = pg_1.types.getTypeParser;
;
// CLASS DEFINITION
// ================================================================================================
class ArrayResult {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(mask) {
        this.rows = [];
        this.fields = [];
        this.parsers = [];
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
        for (let i = 0; i < fieldDescriptions.length; i++) {
            let desc = fieldDescriptions[i];
            this.fields.push(desc);
            let parser = getTypeParser(desc.dataTypeID, desc.format || 'text');
            this.parsers.push(parser);
        }
    }
    addRow(rowData) {
        // no need to parse more than 1 row for 'single' query mask
        if (this.rowsToParse < 2 /* many */) {
            if (this.rowsToParse === 1 /* one */) {
                this.rowsToParse = 0 /* zero */;
            }
            else {
                return;
            }
        }
        const row = [];
        for (let i = 0; i < rowData.length; i++) {
            let rawValue = rowData[i];
            if (rawValue !== null) {
                row.push(this.parsers[i](rawValue));
            }
            else {
                row.push(null);
            }
        }
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
exports.ArrayResult = ArrayResult;
//# sourceMappingURL=ArrayResult.js.map
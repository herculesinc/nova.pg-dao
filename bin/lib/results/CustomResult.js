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
class CustomResult {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(mask, handler) {
        this.rows = [];
        this.fields = [];
        this.handler = handler;
        this.rowsToParse = (mask === 'single') ? 1 /* one */ : 2 /* many */;
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
    get rowCount() {
        return this.rows.length;
    }
    // PUBLIC METHODS
    // --------------------------------------------------------------------------------------------
    addFields(fieldDescriptions) {
        for (let i = 0; i < fieldDescriptions.length; i++) {
            let desc = fieldDescriptions[i];
            this.fields.push({
                name: desc.name,
                oid: desc.dataTypeID,
                parser: getTypeParser(desc.dataTypeID, desc.format || 'text')
            });
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
        const row = this.handler.parse(rowData, this.fields);
        this.rows.push(row);
    }
    complete(command, rows) {
        this.command = command;
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
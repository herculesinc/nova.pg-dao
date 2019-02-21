"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTS
// ================================================================================================
const pg_1 = require("pg");
const util_1 = require("./util");
// MODULE VARIABLES
// ================================================================================================
const getTypeParser = pg_1.types.getTypeParser;
;
// CLASS DEFINITION
// ================================================================================================
class ObjectResult {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(mask) {
        this.rows = [];
        this.fields = [];
        this.parsers = [];
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
        if (this.rowsToParse < 2 /* many */) {
            if (this.rowsToParse === 1 /* one */) {
                this.rowsToParse = 0 /* zero */;
            }
            else {
                return;
            }
        }
        const row = {};
        for (let i = 0; i < rowData.length; i++) {
            let rawValue = rowData[i];
            let field = this.fields[i].name;
            if (rawValue !== null) {
                row[field] = this.parsers[i](rawValue);
            }
            else {
                row[field] = null;
            }
        }
        this.rows.push(row);
    }
    complete(command) {
        util_1.applyCommandComplete(this, command);
    }
    end(error) {
        if (error)
            this.reject(error);
        else
            this.resolve(this.rowsToParse < 2 /* many */ ? this.rows[0] : this.rows);
    }
}
exports.ObjectResult = ObjectResult;
//# sourceMappingURL=ObjectResult.js.map
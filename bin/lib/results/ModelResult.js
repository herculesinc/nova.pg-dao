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
class ModelResult {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(mask, mutable, modelType, store) {
        this.fields = [];
        this.models = [];
        this.modelType = modelType;
        this.store = store;
        this.mutable = mutable;
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
        return this.models.length;
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
        const model = this.store.load(this.modelType, rowData, this.fields, this.mutable);
        if (model) {
            this.models.push(model);
        }
    }
    complete(command, rows) {
        this.command = command;
    }
    end(error) {
        if (error)
            this.reject(error);
        else
            this.resolve(this.rowsToParse < 2 /* many */ ? this.models[0] : this.models);
    }
}
exports.ModelResult = ModelResult;
//# sourceMappingURL=ModelResult.js.map
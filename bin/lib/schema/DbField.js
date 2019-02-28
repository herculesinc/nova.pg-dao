"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("../errors");
const types_1 = require("./types");
const util = require("./util");
// CLASS DEFINITION
// ================================================================================================
class DbField {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(name, type, readonly, handler) {
        // validate and set name
        if (typeof name !== 'string')
            throw new TypeError('Database field name must be a string');
        this.name = name.trim();
        if (name === '')
            throw new TypeError('Database field name cannot be an empty string');
        this.snakeName = util.camelToSnake(this.name);
        // set the type
        if (type === undefined)
            throw new TypeError('Database field type is undefined');
        this.type = type;
        // validate and set readonly
        if (readonly !== undefined) {
            if (typeof readonly !== 'boolean')
                throw new TypeError('Database field readonly attribute must be a boolean');
            this.readonly = readonly;
        }
        else {
            this.readonly = false;
        }
        // validate type and set parser, cloner, comparator, and serializer
        switch (this.type) {
            case Number:
            case String:
            case Boolean: {
                if (handler)
                    throw new errors_1.ModelError('Cannot specify custom handler for Number, String, or Boolean fields');
                break;
            }
            case types_1.Timestamp: {
                if (handler)
                    throw new errors_1.ModelError('Cannot specify custom handler for Timestamp fields');
                this.parse = types_1.Timestamp.parse;
                break;
            }
            case Date: {
                if (handler)
                    throw new errors_1.ModelError('Cannot specify custom handler for Date field');
                this.clone = util.cloneDate;
                this.areEqual = util.areDatesEqual;
                break;
            }
            case Object: {
                const { cloner, comparator, parser, serializer } = validateFieldHandler(handler);
                this.clone = cloner || util.cloneObject;
                this.areEqual = comparator || util.areObjectsEqual;
                this.parse = parser;
                this.serialize = serializer;
                break;
            }
            case Array: {
                const { cloner, comparator, parser, serializer } = validateFieldHandler(handler);
                this.clone = cloner || util.cloneArray;
                this.areEqual = comparator || util.areArraysEqual;
                this.parse = parser;
                this.serialize = serializer;
                break;
            }
            default: {
                throw new TypeError(`Invalid field type in model schema`);
            }
        }
    }
}
exports.DbField = DbField;
// HELPER FUNCTIONS
// ================================================================================================
function validateFieldHandler(handler) {
    if (!handler)
        return {};
    const cloner = handler.clone;
    if (!cloner)
        throw new TypeError('Undefined cloner in field handler');
    if (typeof cloner !== 'function')
        throw new TypeError('Invalid cloner in field handler');
    const comparator = handler.areEqual;
    if (!comparator)
        throw new TypeError('Undefined comparator in field handler');
    if (typeof comparator !== 'function')
        throw new TypeError('Invalid comparator in field handler');
    const parser = handler.parse;
    if (parser !== undefined) {
        if (typeof parser !== 'function')
            throw new TypeError('Invalid parser in field handler');
    }
    const serializer = handler.serialize;
    if (serializer !== undefined) {
        if (typeof serializer !== 'function')
            throw new TypeError('Invalid serializer in field handler');
    }
    return { cloner, comparator, parser, serializer };
}
//# sourceMappingURL=DbField.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("../errors");
const DbField_1 = require("./DbField");
// MODULE VARIABLES
// ================================================================================================
const symFields = Symbol();
// DECORATOR DEFINITIONS
// ================================================================================================
function dbModel(table, idGenerator) {
    // validate table name
    if (!table)
        throw new errors_1.ModelError('Cannot build model schema: table name is undefined');
    if (table.trim() === '')
        throw new errors_1.ModelError('Cannot build model schema: table name is invalid');
    // validate ID Generator
    if (!idGenerator)
        throw new errors_1.ModelError('Cannot build model schema: ID Generator is undefined');
    if (typeof idGenerator.getNextId !== 'function')
        throw new errors_1.ModelError('Cannot build model schema: ID Generator is invalid');
    return function (classConstructor) {
        const schemaMap = classConstructor.prototype[symFields];
        const fields = schemaMap.get(classConstructor.name);
        classConstructor.setSchema(table, idGenerator, fields);
    };
}
exports.dbModel = dbModel;
function dbField(fieldType, options) {
    // make sure options are set
    options = Object.assign({ readonly: false }, options);
    return function (classPrototype, property) {
        if (typeof property === 'symbol')
            throw new errors_1.ModelError('A symbol property cannot be a part of model schema');
        const field = new DbField_1.DbField(property, fieldType, options.readonly, options.handler);
        let schemaMap = classPrototype[symFields];
        if (!schemaMap) {
            schemaMap = new Map();
            classPrototype[symFields] = schemaMap;
        }
        let schema = schemaMap.get(classPrototype.constructor.name);
        if (!schema) {
            schema = {};
            schemaMap.set(classPrototype.constructor.name, schema);
        }
        schema[property] = field;
    };
}
exports.dbField = dbField;
//# sourceMappingURL=decorators.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var DbSchema_1 = require("./DbSchema");
exports.DbSchema = DbSchema_1.DbSchema;
var DbField_1 = require("./DbField");
exports.DbField = DbField_1.DbField;
var types_1 = require("./types");
exports.Timestamp = types_1.Timestamp;
const queries_1 = require("./queries");
exports.queries = {
    buildSelectQueryClass: queries_1.buildSelectQueryClass,
    buildInsertQueryClass: queries_1.buildInsertQueryClass,
    buildUpdateQueryClass: queries_1.buildUpdateQueryClass,
    buildDeleteQueryClass: queries_1.buildDeleteQueryClass
};
//# sourceMappingURL=index.js.map
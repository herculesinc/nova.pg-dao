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
    buildSelectQueryTemplate: queries_1.buildSelectQueryTemplate,
    buildInsertQueryTemplate: queries_1.buildInsertQueryTemplate,
    buildUpdateQueryTemplate: queries_1.buildUpdateQueryTemplate,
    buildDeleteQueryTemplate: queries_1.buildDeleteQueryTemplate
};
//# sourceMappingURL=index.js.map
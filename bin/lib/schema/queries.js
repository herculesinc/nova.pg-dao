"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Query_1 = require("../Query");
const errors_1 = require("../errors");
// FETCH QUERY
// ================================================================================================
function buildSelectQueryTemplate(schema, mask, handler) {
    if (!schema)
        throw new errors_1.ModelError('Cannot build a fetch query: model schema is undefined');
    const queryName = `qSelect${schema.name}Model${(mask === 'list' ? 's' : '')}`;
    const queryBase = schema.selectSql;
    return class {
        constructor(selector, forUpdate) {
            const values = [];
            const criteria = [];
            for (let filter in selector) {
                let field = schema.getField(filter);
                if (!field) {
                    throw new errors_1.QueryError('Cannot build a fetch query: model selector and schema are incompatible');
                }
                // TODO: check for custom serialization?
                let paramValue = selector[filter];
                if (paramValue && Array.isArray(paramValue)) {
                    criteria.push(`${field.snakeName} IN (${Query_1.stringifyArrayParam(paramValue, values)})`);
                }
                else {
                    criteria.push(`${field.snakeName}=${Query_1.stringifySingleParam(paramValue, values)}`);
                }
            }
            this.name = queryName;
            this.text = queryBase + ` WHERE ${criteria.join(' AND ')} ${forUpdate ? 'FOR UPDATE' : ''};`;
            this.values = values.length ? values : undefined;
            this.handler = handler;
            this.mask = mask;
        }
    };
}
exports.buildSelectQueryTemplate = buildSelectQueryTemplate;
// INSERT QUERY
// ================================================================================================
function buildInsertQueryTemplate(schema) {
    if (!schema)
        throw new errors_1.ModelError('Cannot build INSERT query template: model schema is undefined');
    const fields = [];
    const params = [];
    for (let field of schema.fields) {
        fields.push(field.snakeName);
        params.push(`{{${field.name}}}`);
    }
    const name = `qInsert${schema.name}Model`;
    const text = `INSERT INTO ${schema.table} (${fields.join(',')}) VALUES (${params.join(',')});`;
    return Query_1.Query.template(text, name);
}
exports.buildInsertQueryTemplate = buildInsertQueryTemplate;
// UPDATE QUERY
// ================================================================================================
function buildUpdateQueryTemplate(schema) {
    if (!schema)
        throw new errors_1.ModelError('Cannot build UPDATE query: model schema is undefined');
    const queryName = `qUpdate${schema.name}Model`;
    const queryBase = `UPDATE ${schema.table} SET`;
    return class {
        constructor(model, changes) {
            const values = [];
            const setters = [];
            for (let field of changes) {
                let paramValue = model[field.name];
                if (field.serialize) {
                    // make sure custom serialization is respected
                    paramValue = field.serialize(paramValue);
                }
                setters.push(`${field.snakeName}=${Query_1.stringifySingleParam(paramValue, values)}`);
            }
            this.name = queryName;
            this.text = queryBase + ` ${setters.join(', ')} WHERE id = '${model.id}';`;
            this.values = values.length ? values : undefined;
        }
    };
}
exports.buildUpdateQueryTemplate = buildUpdateQueryTemplate;
// DELETE QUERY
// ================================================================================================
function buildDeleteQueryTemplate(schema) {
    if (!schema)
        throw new errors_1.ModelError('Cannot build DELETE query template: model schema is undefined');
    const name = `qDelete${schema.name}Model`;
    const text = `DELETE FROM ${schema.table} WHERE id = {{id}};`;
    return Query_1.Query.template(text, name);
}
exports.buildDeleteQueryTemplate = buildDeleteQueryTemplate;
//# sourceMappingURL=queries.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Query_1 = require("../Query");
const errors_1 = require("../errors");
const operators_1 = require("./operators");
// SELECT QUERY
// ================================================================================================
function buildSelectQueryClass(schema, mask, modelType) {
    const queryName = `qSelect${schema.name}Model${(mask === 'list' ? 's' : '')}`;
    const selectText = buildSelectText(schema);
    const fromText = schema.table;
    return class {
        constructor(mutable, selector) {
            this.name = this.constructor.name || queryName;
            this.mask = mask;
            this.handler = modelType;
            this.mutable = mutable || false;
            this.select = selectText;
            this.from = fromText;
            this.paramValues = [];
            if (selector) {
                this.where = buildWhereText(schema, selector, this.paramValues);
            }
        }
        get text() {
            if (this.where === undefined) {
                throw new errors_1.ModelError(`Invalid SELECT query for ${this.name} model: WHERE condition is undefined`);
            }
            return `SELECT ${this.select} FROM ${this.from} WHERE ${this.where}${this.mutable ? ' FOR UPDATE' : ''};`;
        }
        get values() {
            return (this.paramValues.length > 0) ? this.paramValues : undefined;
        }
    };
}
exports.buildSelectQueryClass = buildSelectQueryClass;
// INSERT QUERY
// ================================================================================================
function buildInsertQueryClass(schema) {
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
exports.buildInsertQueryClass = buildInsertQueryClass;
// UPDATE QUERY
// ================================================================================================
function buildUpdateQueryClass(schema) {
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
exports.buildUpdateQueryClass = buildUpdateQueryClass;
// DELETE QUERY
// ================================================================================================
function buildDeleteQueryClass(schema) {
    if (!schema)
        throw new errors_1.ModelError('Cannot build DELETE query template: model schema is undefined');
    const name = `qDelete${schema.name}Model`;
    const text = `DELETE FROM ${schema.table} WHERE id = {{id}};`;
    return Query_1.Query.template(text, name);
}
exports.buildDeleteQueryClass = buildDeleteQueryClass;
// HELPER FUNCTIONS
// ================================================================================================
function buildSelectText(schema) {
    const fieldGetters = [];
    for (let field of schema.fields) {
        if (field.name === field.snakeName) {
            fieldGetters.push(`${schema.table}.${field.name}`);
        }
        else {
            fieldGetters.push(`${schema.table}.${field.snakeName} AS "${field.name}"`);
        }
    }
    return fieldGetters.join(', ');
}
function buildWhereText(schema, selector, values) {
    let where;
    if (typeof selector === 'string') {
        where = selector;
    }
    else if (typeof selector === 'object') {
        if (Array.isArray(selector)) {
            const filters = [];
            for (let i = 0; i < selector.length; i++) {
                filters.push('(' + buildFilter(schema, selector[i], values) + ')');
            }
            where = filters.join(' OR ');
        }
        else {
            where = buildFilter(schema, selector, values);
        }
    }
    else {
        throw new TypeError('Cannot build a fetch query: model selector is invalid');
    }
    return where;
}
function buildFilter(schema, selector, values) {
    if (!selector)
        throw new TypeError('Cannot build a fetch query: model selector is invalid');
    const criteria = [];
    for (let fieldName in selector) {
        let field = schema.getField(fieldName);
        if (!field) {
            throw new errors_1.ModelError('Cannot build fetch query: model selector and schema are incompatible');
        }
        // TODO: check for custom serialization?
        let paramValue = selector[fieldName];
        if (Array.isArray(paramValue)) {
            criteria.push(`${schema.table}.${field.snakeName} IN (${Query_1.stringifyArrayParam(paramValue, values)})`);
        }
        else if (operators_1.Condition.isCondition(paramValue)) {
            criteria.push(operators_1.Condition.stringify(paramValue, schema.table, field, values));
        }
        else {
            criteria.push(`${schema.table}.${field.snakeName}=${Query_1.stringifySingleParam(paramValue, values)}`);
        }
    }
    return criteria.join(' AND ');
}
//# sourceMappingURL=queries.js.map
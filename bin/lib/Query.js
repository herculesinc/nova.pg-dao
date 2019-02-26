"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("./errors");
// MODULE VARIABLES
// ================================================================================================
const SINGLE_PARAM_PATTERN = /{{(~?[a-z0-9_]+)}}/i;
const ARRAY_PARAM_PATTERN = /\[\[(~?[a-z0-9_]+)\]\]/i;
const PARAM_PATTERN = /{{~?[a-z0-9_]+}}|\[\[~?[a-z0-9_]+\]\]/gi;
// QUERY NAMESPACE
// ================================================================================================
var Query;
(function (Query) {
    function from(text, nameOrOptions, maskOrOptions) {
        return validateQueryArguments(text, nameOrOptions, maskOrOptions);
    }
    Query.from = from;
    function template(text, nameOrOptions, maskOrOptions) {
        const validated = validateQueryArguments(text, nameOrOptions, maskOrOptions);
        const textParts = validated.text.split(PARAM_PATTERN);
        if (textParts.length < 2)
            throw new errors_1.QueryError('Query text must contain at least one parameter');
        const paramMatches = text.match(PARAM_PATTERN);
        const paramSpecs = [];
        for (let match of paramMatches) {
            paramSpecs.push(buildParamSpec(match));
        }
        return buildQueryTemplate(validated.name, textParts, paramSpecs, validated.mask, validated.handler);
    }
    Query.template = template;
})(Query = exports.Query || (exports.Query = {}));
// PUBLIC FUNCTIONS
// ================================================================================================
function isResultQuery(query) {
    const queryMask = query.mask;
    if (queryMask === 'single' || queryMask === 'list') {
        return true;
    }
    else if (queryMask) {
        throw new errors_1.QueryError(`Invalid query mask: value '${queryMask}' is not supported`);
    }
    else {
        return false;
    }
}
exports.isResultQuery = isResultQuery;
// QUERY TEMPLATES
// ================================================================================================
function buildQueryTemplate(name, textParts, paramSpecs, mask, handler) {
    return class ParameterizedQuery {
        constructor(params) {
            if (!params)
                throw new TypeError('Query params are undefined');
            if (typeof params !== 'object')
                throw new TypeError('Query params must be an object');
            const values = [];
            let text = textParts[0];
            for (let i = 0; i < paramSpecs.length; i++) {
                let paramSpec = paramSpecs[i];
                let paramValue = params[paramSpec.name];
                text += paramSpec.stringfier(paramValue, values) + textParts[i + 1];
            }
            this.name = name;
            this.text = text;
            this.values = values.length ? values : undefined;
            this.mask = mask;
            this.handler = handler;
        }
    };
}
function buildParamSpec(paramMatch) {
    let spec;
    let info = SINGLE_PARAM_PATTERN.exec(paramMatch);
    if (info) {
        let pname = info[1];
        if (pname.charAt(0) === '~') {
            spec = { name: pname.substr(1), stringfier: stringifyRawSingleParam };
        }
        else {
            spec = { name: pname, stringfier: stringifySingleParam };
        }
    }
    else {
        info = ARRAY_PARAM_PATTERN.exec(paramMatch);
        let pname = info[1];
        if (pname.charAt(0) === '~') {
            spec = { name: pname.substr(1), stringfier: stringifyRawArrayParam };
        }
        else {
            spec = { name: pname, stringfier: stringifyArrayParam };
        }
    }
    return spec;
}
// STRINGIFIERS
// ================================================================================================
function stringifyRawSingleParam(value, values) {
    if (value === undefined || value === null)
        return 'null';
    switch (typeof value) {
        case 'string': {
            return value;
        }
        case 'number':
        case 'bigint': {
            return value.toString(10);
        }
        case 'boolean': {
            return value.toString();
        }
        default: {
            const pvalue = value.valueOf();
            switch (typeof pvalue) {
                case 'string': {
                    return pvalue;
                }
                case 'number':
                case 'bigint': {
                    return pvalue.toString(10);
                }
                case 'boolean': {
                    return pvalue.toString();
                }
                default: {
                    throw new Error(`Raw query parameter cannot be reduced to a primitive value`);
                }
            }
        }
    }
}
function stringifySingleParam(value, values) {
    if (value === undefined || value === null)
        return 'null';
    switch (typeof value) {
        case 'string': {
            return isSafeString(value) ? '\'' + value + '\'' : '$' + values.push(value);
        }
        case 'number':
        case 'bigint': {
            return value.toString(10);
        }
        case 'boolean': {
            return value.toString();
        }
        case 'function': {
            const pvalue = value.valueOf();
            if (typeof pvalue === 'function') {
                throw new Error('Query parameter cannot be a function');
            }
            return stringifySingleParam(pvalue, values);
        }
        default: {
            if (value instanceof Date) {
                return '\'' + value.toISOString() + '\'';
            }
            else if (value instanceof Buffer) {
                return '\'' + value.toString('base64') + '\'';
            }
            else {
                const pvalue = value.valueOf();
                if (typeof pvalue === 'object') {
                    const svalue = JSON.stringify(pvalue);
                    return isSafeString(svalue) ? '\'' + svalue + '\'' : '$' + values.push(svalue);
                }
                else {
                    return stringifySingleParam(pvalue, values);
                }
            }
        }
    }
}
exports.stringifySingleParam = stringifySingleParam;
function stringifyRawArrayParam(array, values) {
    if (array === undefined || array === null)
        return 'null';
    if (!Array.isArray(array))
        throw new Error('Raw query parameter must be an array');
    if (array.length === 0)
        return 'null';
    const paramValues = [];
    const arrayType = typeof array[0];
    for (let value of array) {
        if (value === undefined || value === null)
            continue;
        let valueType = typeof value;
        if (valueType !== arrayType)
            throw new Error('Raw query parameter array cannot contain values of mixed type');
        if (valueType === 'string') {
            paramValues.push(value);
        }
        else if (valueType === 'number' || valueType === 'bigint') {
            paramValues.push(value.toString(10));
        }
        else {
            throw new Error(`Raw query parameter array cannot contain ${valueType} values`);
        }
    }
    return paramValues.join(',');
}
function stringifyArrayParam(array, values) {
    if (array === undefined || array === null)
        return 'null';
    if (!Array.isArray(array))
        throw new Error('Query parameter must be an array');
    if (array.length === 0)
        return 'null';
    const paramValues = [];
    const arrayType = typeof array[0];
    for (let value of array) {
        if (value === undefined || value === null)
            continue;
        let valueType = typeof value;
        if (valueType !== arrayType)
            throw new Error('Query parameter array cannot contain values of mixed type');
        if (valueType === 'string') {
            if (isSafeString(value)) {
                paramValues.push('\'' + value + '\'');
            }
            else {
                paramValues.push('$' + values.push(value));
            }
        }
        else if (valueType === 'number' || valueType === 'bigint') {
            paramValues.push(value.toString());
        }
        else {
            throw new Error(`Query parameter array cannot contain ${valueType} values`);
        }
    }
    return paramValues.join(',');
}
exports.stringifyArrayParam = stringifyArrayParam;
// VALIDATORS
// ================================================================================================
function validateQueryArguments(text, nameOrOptions, maskOrOptions) {
    let qText, qName, qMask, qHandler;
    // validate text
    if (typeof text !== 'string')
        throw new TypeError('Query text must be a string');
    qText = text.trim();
    if (qText === '')
        throw new TypeError('Query text cannot be an empty string');
    qText += (qText.charAt(qText.length - 1) !== ';') ? ';\n' : '\n';
    if (typeof nameOrOptions === 'string') {
        qName = nameOrOptions.trim();
        if (qName === '')
            throw new TypeError('Query name must be a non-empty string');
        if (typeof maskOrOptions === 'string') {
            qMask = validateQueryMask(maskOrOptions);
        }
        else if (typeof maskOrOptions === 'object') {
            const validated = validateQueryOptions(maskOrOptions, false);
            qMask = validated.mask;
            qHandler = validated.handler;
        }
        else if (maskOrOptions !== undefined) {
            throw new TypeError(`Query mask is invalid`);
        }
    }
    else if (typeof nameOrOptions === 'object') {
        if (Array.isArray(nameOrOptions))
            throw new TypeError('Query name must be a string');
        if (maskOrOptions !== undefined)
            throw new TypeError('Too many arguments provided');
        const validated = validateQueryOptions(nameOrOptions, true);
        qName = validated.name;
        qMask = validated.mask;
        qHandler = validated.handler;
    }
    else if (nameOrOptions === undefined) {
        qName = 'unnamed query';
    }
    else {
        throw new TypeError('Query name must be a string');
    }
    return { text: qText, name: qName, mask: qMask, handler: qHandler };
}
function validateQueryOptions(options, checkName) {
    const mask = validateQueryMask(options.mask) || 'list';
    let handler;
    if (options.handler) {
        handler = options.handler;
        if (handler !== Object && handler !== Array) {
            if (typeof handler !== 'object')
                throw new TypeError('Query handler is invalid');
            if (typeof handler.parse !== 'function')
                throw new TypeError('Query handler is invalid');
        }
    }
    else {
        handler = Object;
    }
    let name;
    if (checkName) {
        if (typeof options.name === 'string') {
            name = options.name.trim();
            if (name === '')
                throw new TypeError('Query name must be a non-empty string');
        }
        else if (options.name === undefined) {
            name = 'unnamed query';
        }
        else {
            throw new TypeError('Query name must be a string');
        }
    }
    return { name, mask, handler };
}
function validateQueryMask(mask) {
    if (mask !== 'list' && mask !== 'single') {
        const ms = (typeof mask === 'object') ? JSON.stringify(mask) : mask;
        throw new TypeError(`Query mask '${ms}' is invalid`);
    }
    return mask;
}
// UTILITY FUNCTIONS
// ================================================================================================
function isSafeString(value) {
    return (!value.includes('\'') && !value.includes(`\\`));
}
//# sourceMappingURL=Query.js.map
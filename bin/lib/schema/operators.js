"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTS
// ================================================================================================
const Query_1 = require("../Query");
// MODULE VARIABLES
// ================================================================================================
exports.symbols = {
    eq: Symbol('='),
    ne: Symbol('!='),
    gt: Symbol('>'),
    gte: Symbol('>='),
    lt: Symbol('<'),
    lte: Symbol('<='),
    not: Symbol('IS NOT'),
    like: Symbol('LIKE'),
    contains: Symbol('@>'),
    in: Symbol('IN')
};
const descriptions = {
    [exports.symbols.eq]: '=',
    [exports.symbols.ne]: '!=',
    [exports.symbols.gt]: '>',
    [exports.symbols.gte]: '>=',
    [exports.symbols.lt]: '<',
    [exports.symbols.lte]: '<=',
    [exports.symbols.not]: 'IS NOT',
    [exports.symbols.like]: 'LIKE',
    [exports.symbols.contains]: '@>',
    [exports.symbols.in]: 'IN'
};
var Condition;
(function (Condition) {
    function isCondition(condition) {
        if (!condition)
            return false;
        return (typeof condition.operator === 'symbol');
    }
    Condition.isCondition = isCondition;
    function stringify(condition, table, field, values) {
        const operator = descriptions[condition.operator];
        switch (condition.operator) {
            case exports.symbols.in: {
                const inValues = Query_1.stringifyArrayParam(condition.operands, values);
                return `${table}.${field.snakeName} IN (${inValues})`;
            }
            default: {
                const value = Query_1.stringifySingleParam(condition.operands[0], values);
                return `${table}.${field.snakeName} ${operator} ${value}`;
            }
        }
    }
    Condition.stringify = stringify;
})(Condition = exports.Condition || (exports.Condition = {}));
exports.Operators = {
    eq(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply equals operator: value is undefined`);
        return { operator: exports.symbols.eq, operands: [value] };
    },
    ne(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply not equal operator: value is undefined`);
        return { operator: exports.symbols.ne, operands: [value] };
    },
    gt(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply greater than operator: value is undefined`);
        if (value === null)
            throw new TypeError(`Cannot apply greater than operator: value is invalid`);
        return { operator: exports.symbols.gt, operands: [value] };
    },
    gte(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply greater than or equals operator: value is undefined`);
        if (value === null)
            throw new TypeError(`Cannot apply greater than or equals operator: value is invalid`);
        return { operator: exports.symbols.gte, operands: [value] };
    },
    lt(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply less than operator: value is undefined`);
        if (value === null)
            throw new TypeError(`Cannot apply less than operator: value is invalid`);
        return { operator: exports.symbols.lt, operands: [value] };
    },
    lte(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply less than or equals operator: value is undefined`);
        if (value === undefined)
            throw new TypeError(`Cannot apply less than or equals operator: value is invalid`);
        return { operator: exports.symbols.lte, operands: [value] };
    },
    not(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply NOT operator: value is undefined`);
        return { operator: exports.symbols.not, operands: [value] };
    },
    like(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply LIKE operator: value is undefined`);
        if (typeof value !== 'string')
            throw new TypeError(`Cannot apply LIKE operator: value is invalid`);
        return { operator: exports.symbols.like, operands: [value] };
    },
    contains(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply contains operator: value is undefined`);
        if (value === null)
            throw new TypeError(`Cannot apply contains operator: value is invalid`);
        if (typeof value !== 'object')
            throw new TypeError(`Cannot apply contains operator: value is invalid`);
        return { operator: exports.symbols.contains, operands: [value] };
    },
    in(values) {
        if (values === undefined)
            throw new TypeError(`Cannot apply IN operator: values is undefined`);
        if (values === null)
            throw new TypeError(`Cannot apply IN operator: value is invalid`);
        if (!Array.isArray(values))
            throw new TypeError(`Cannot apply IN operator: value is invalid`);
        return { operator: exports.symbols.in, operands: values };
    }
};
//# sourceMappingURL=operators.js.map
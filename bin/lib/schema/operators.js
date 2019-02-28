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
    contains: Symbol('@>')
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
    [exports.symbols.contains]: '@>'
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
        return `${table}.${field.snakeName} ${operator} ${Query_1.stringifySingleParam(condition.operands[0], values)}`;
    }
    Condition.stringify = stringify;
})(Condition = exports.Condition || (exports.Condition = {}));
var Operators;
(function (Operators) {
    function eq(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply equals operator: value is undefined`);
        return { operator: exports.symbols.eq, operands: [value] };
    }
    Operators.eq = eq;
    function ne(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply not equal operator: value is undefined`);
        return { operator: exports.symbols.ne, operands: [value] };
    }
    Operators.ne = ne;
    function gt(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply greater than operator: value is undefined`);
        if (value === null)
            throw new TypeError(`Cannot apply greater than operator: value is invalid`);
        return { operator: exports.symbols.gt, operands: [value] };
    }
    Operators.gt = gt;
    function gte(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply greater than or equals operator: value is undefined`);
        if (value === null)
            throw new TypeError(`Cannot apply greater than or equals operator: value is invalid`);
        return { operator: exports.symbols.gte, operands: [value] };
    }
    Operators.gte = gte;
    function lt(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply less than operator: value is undefined`);
        if (value === null)
            throw new TypeError(`Cannot apply less than operator: value is invalid`);
        return { operator: exports.symbols.lt, operands: [value] };
    }
    Operators.lt = lt;
    function lte(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply less than or equals operator: value is undefined`);
        if (value === undefined)
            throw new TypeError(`Cannot apply less than or equals operator: value is invalid`);
        return { operator: exports.symbols.lte, operands: [value] };
    }
    Operators.lte = lte;
    function not(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply NOT operator: value is undefined`);
        return { operator: exports.symbols.not, operands: [value] };
    }
    Operators.not = not;
    function like(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply LIKE operator: value is undefined`);
        if (typeof value !== 'string')
            throw new TypeError(`Cannot apply LIKE operator: value is invalid`);
        return { operator: exports.symbols.like, operands: [value] };
    }
    Operators.like = like;
    function contains(value) {
        if (value === undefined)
            throw new TypeError(`Cannot apply contains operator: value is undefined`);
        if (value === null)
            throw new TypeError(`Cannot apply contains operator: value is invalid`);
        if (typeof value !== 'object')
            throw new TypeError(`Cannot apply contains operator: value is invalid`);
        return { operator: exports.symbols.contains, operands: [value] };
    }
    Operators.contains = contains;
})(Operators = exports.Operators || (exports.Operators = {}));
//# sourceMappingURL=operators.js.map
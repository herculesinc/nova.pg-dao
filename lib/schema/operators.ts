// IMPORTS
// ================================================================================================
import { stringifySingleParam, stringifyArrayParam } from '../Query';
import { DbField } from './DbField';

// MODULE VARIABLES
// ================================================================================================
export const symbols = {
    eq      : Symbol('='),
    ne      : Symbol('!='),
    gt      : Symbol('>'),
    gte     : Symbol('>='),
    lt      : Symbol('<'),
    lte     : Symbol('<='),
    not     : Symbol('IS NOT'),
    like    : Symbol('LIKE'),
    contains: Symbol('@>'),
    in      : Symbol('IN')
};

const descriptions: any = {
    [symbols.eq]        : '=',
    [symbols.ne]        : '!=',
    [symbols.gt]        : '>',
    [symbols.gte]       : '>=',
    [symbols.lt]        : '<',
    [symbols.lte]       : '<=',
    [symbols.not]       : 'IS NOT',
    [symbols.like]      : 'LIKE',
    [symbols.contains]  : '@>',
    [symbols.in]        : 'IN'
};

// CONDITION
// ================================================================================================
export interface Condition {
    operator: symbol;
    operands: any[];
}

export namespace Condition {

    export function isCondition(condition: any): condition is Condition {
        if (!condition) return false;
        return (typeof condition.operator === 'symbol');
    }

    export function stringify(condition: Condition, table: string, field: DbField, values: any[]): string {
        const operator = descriptions[condition.operator];
        switch(condition.operator) {
            case symbols.in: {
                const inValues = stringifyArrayParam(condition.operands, values);
                return `${table}.${field.snakeName} IN (${inValues})`;
            }
            default: {
                const value = stringifySingleParam(condition.operands[0], values);
                return `${table}.${field.snakeName} ${operator} ${value}`;
            }
        }
        
    }
}

// OPERATORS
// ================================================================================================
export interface Operators {
    eq(value: any)      : Condition;
    ne(value: any)      : Condition;
    gt(value: any)      : Condition;
    gte(value: any)     : Condition;
    lt(value: any)      : Condition;
    lte(value: any)     : Condition;
    not(value: any)     : Condition;
    like(value: any)    : Condition;
    contains(value: any): Condition;
    in(values: any[])   : Condition;
}

export const Operators: Operators = {

    eq(value: any): Condition {
        if (value === undefined) throw new TypeError(`Cannot apply equals operator: value is undefined`);
        return { operator: symbols.eq, operands: [value] };
    },

    ne(value: any): Condition {
        if (value === undefined) throw new TypeError(`Cannot apply not equal operator: value is undefined`);
        return { operator: symbols.ne, operands: [value] };
    },

    gt(value: any): Condition {
        if (value === undefined) throw new TypeError(`Cannot apply greater than operator: value is undefined`);
        if (value === null) throw new TypeError(`Cannot apply greater than operator: value is invalid`);
        return { operator: symbols.gt, operands: [value] };
    },

    gte(value: any): Condition {
        if (value === undefined) throw new TypeError(`Cannot apply greater than or equals operator: value is undefined`);
        if (value === null) throw new TypeError(`Cannot apply greater than or equals operator: value is invalid`);
        return { operator: symbols.gte, operands: [value] };
    },

    lt(value: any): Condition {
        if (value === undefined) throw new TypeError(`Cannot apply less than operator: value is undefined`);
        if (value === null) throw new TypeError(`Cannot apply less than operator: value is invalid`);
        return { operator: symbols.lt, operands: [value] };
    },

    lte(value: any): Condition {
        if (value === undefined) throw new TypeError(`Cannot apply less than or equals operator: value is undefined`);
        if (value === undefined) throw new TypeError(`Cannot apply less than or equals operator: value is invalid`);
        return { operator: symbols.lte, operands: [value] };
    },

    not(value: any): Condition {
        if (value === undefined) throw new TypeError(`Cannot apply NOT operator: value is undefined`);
        return { operator: symbols.not, operands: [value] };
    },

    like(value: any): Condition {
        if (value === undefined) throw new TypeError(`Cannot apply LIKE operator: value is undefined`);
        if (typeof value !== 'string') throw new TypeError(`Cannot apply LIKE operator: value is invalid`);
        return { operator: symbols.like, operands: [value] };
    },

    contains(value: any): Condition {
        if (value === undefined) throw new TypeError(`Cannot apply contains operator: value is undefined`);
        if (value === null) throw new TypeError(`Cannot apply contains operator: value is invalid`);
        if (typeof value !== 'object') throw new TypeError(`Cannot apply contains operator: value is invalid`);
        return { operator: symbols.contains, operands: [value] };
    },

    in(values: any[]): Condition {
        if (values === undefined) throw new TypeError(`Cannot apply IN operator: values is undefined`);
        if (values === null) throw new TypeError(`Cannot apply IN operator: value is invalid`);
        if (!Array.isArray(values)) throw new TypeError(`Cannot apply IN operator: value is invalid`);
        return { operator: symbols.in, operands: values };
    }
}
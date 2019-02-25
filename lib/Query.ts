// IMPORTS
// ================================================================================================
import {
    QueryHandler, QueryMask, QueryTemplate, ResultQuery, ResultQueryOptions,
    ListResultQuery, ListResultQueryOptions, SingleResultQuery, SingleResultQueryOptions
} from '@nova/pg-dao';
import { QueryError } from './errors';

// MODULE VARIABLES
// ================================================================================================
const SINGLE_PARAM_PATTERN = /{{(~?[a-z0-9_]+)}}/i;
const ARRAY_PARAM_PATTERN = /\[\[(~?[a-z0-9_]+)\]\]/i;
const PARAM_PATTERN = /{{~?[a-z0-9_]+}}|\[\[~?[a-z0-9_]+\]\]/gi;

// INTERFACES
// ================================================================================================
export interface Query<T=any> {
    readonly text       : string;
    readonly name?      : string;
    readonly mask?      : QueryMask;
    readonly values?    : any[];
    readonly handler?   : QueryHandler<T>;
}

interface ParamSpec {
    name                : string;
    stringfier          : (value: any, values: string[]) => string;
}

// QUERY NAMESPACE
// ================================================================================================
export namespace Query {

    export function from(text: string): Query<void>
    export function from(text: string, name: string): Query<void>
    export function from<T=any>(text: string, name: string, mask: 'list'): ListResultQuery<T>
    export function from<T=any>(text: string, name: string, options: ListResultQueryOptions<T>): ListResultQuery<T>
    export function from<T=any>(text: string, options: ListResultQueryOptions<T>): ListResultQuery<T>
    export function from<T=any>(text: string, name: string, mask: 'single'): SingleResultQuery<T>
    export function from<T=any>(text: string, name: string, options: SingleResultQueryOptions<T>): SingleResultQuery<T>
    export function from<T=any>(text: string, options: SingleResultQueryOptions<T>): SingleResultQuery<T>
    export function from<T=any>(text: string, nameOrOptions?: string | ResultQueryOptions<T>, maskOrOptions?: QueryMask | ResultQueryOptions<T>): Query {
        return validateQueryArguments(text, nameOrOptions, maskOrOptions);
    }

    export function template(text: string): QueryTemplate<Query<void>>
    export function template(text: string, name: string): QueryTemplate<Query<void>>
    export function template<T=any>(text: string, name: string, mask: 'list'): QueryTemplate<ListResultQuery<T>>
    export function template<T=any>(text: string, name: string, options: ListResultQueryOptions<T>): QueryTemplate<ListResultQuery<T>>
    export function template<T=any>(text: string, options: ListResultQueryOptions<T>): QueryTemplate<ListResultQuery<T>>
    export function template<T=any>(text: string, name: string, mask: 'single'): QueryTemplate<SingleResultQuery<T>>
    export function template<T=any>(text: string, name: string, options: SingleResultQueryOptions<T>): QueryTemplate<SingleResultQuery<T>>
    export function template<T=any>(text: string, options: SingleResultQueryOptions<T>): QueryTemplate<SingleResultQuery<T>>
    export function template<T=any>(text: string, nameOrOptions?: string | ResultQueryOptions<T>): QueryTemplate<any> {

        const validated = validateQueryArguments(text, nameOrOptions);
        const textParts = validated.text.split(PARAM_PATTERN);
        if (textParts.length < 2) throw new QueryError('Query text must contain at least one parameter');

        const paramMatches = text.match(PARAM_PATTERN) as RegExpMatchArray;
        const paramSpecs: ParamSpec[] = [];
        for (let match of paramMatches) {
            paramSpecs.push(buildParamSpec(match));
        }

        return buildQueryTemplate(validated.name, textParts, paramSpecs, validated.mask, validated.handler);
    }
}

// PUBLIC FUNCTIONS
// ================================================================================================
export function isResultQuery(query: Query): query is ResultQuery {
    const queryMask = query.mask;
    if (queryMask === 'single' || queryMask === 'list') {
        return true;
    }
    else if (queryMask) {
        throw new QueryError(`Invalid query mask: value '${queryMask}' is not supported`);
    }
    else {
        return false;
    }
}

// QUERY TEMPLATES
// ================================================================================================
function buildQueryTemplate<T>(name: string, textParts: string[], paramSpecs: ParamSpec[], mask?: QueryMask, handler?: QueryHandler): QueryTemplate<any> {

    return class ParameterizedQuery implements Query<T> {

        readonly name       : string;
        readonly mask?      : QueryMask;
        readonly text       : string;
        readonly values?    : any[];
        readonly handler?   : QueryHandler<T>;

        constructor(params: any) {
            if (!params) throw new TypeError('Query params are undefined');
            if (typeof params !== 'object') throw new TypeError('Query params must be an object');

            const values: any[] = [];
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

function buildParamSpec(paramMatch: string): ParamSpec {
    let spec: ParamSpec;

    let info = SINGLE_PARAM_PATTERN.exec(paramMatch) as RegExpExecArray;
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
        info = ARRAY_PARAM_PATTERN.exec(paramMatch) as RegExpExecArray;
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
function stringifyRawSingleParam(value: any, values: string[]) {
    if (value === undefined || value === null) return 'null';

    switch (typeof value) {
        case 'string': {
        return value;
    }
        case 'number': case 'bigint': {
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
                case 'number': case 'bigint': {
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

export function stringifySingleParam(value: any, values: string[]): string {
    if (value === undefined || value === null) return 'null';

    switch (typeof value) {
        case 'string':{
            return isSafeString(value) ? '\'' + value + '\'' : '$' + values.push(value);
        }
        case 'number': case 'bigint': {
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

function stringifyRawArrayParam(array: any[], values: string[]): string {
    if (array === undefined || array === null) return 'null';
    if (!Array.isArray(array)) throw new Error('Raw query parameter must be an array');
    if (array.length === 0) return 'null';

    const paramValues: string[] = [];
    const arrayType = typeof array[0];
    for (let value of array) {
        if (value === undefined || value === null) continue;

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

export function stringifyArrayParam(array: any[], values: string[]): string {
    if (array === undefined || array === null) return 'null';
    if (!Array.isArray(array)) throw new Error('Query parameter must be an array');
    if (array.length === 0) return 'null';

    const paramValues: string[] = [];
    const arrayType = typeof array[0];
    for (let value of array) {
        if (value === undefined || value === null) continue;

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

// VALIDATORS
// ================================================================================================
function validateQueryArguments(text: string, nameOrOptions?: string | ResultQueryOptions, maskOrOptions?: QueryMask | ResultQueryOptions) {
    let qText: string, qName: string, qMask: QueryMask | undefined, qHandler: QueryHandler | undefined;

    // validate text
    if (typeof text !== 'string') throw new TypeError('Query text must be a string');
    qText = text.trim();
    if (qText === '') throw new TypeError('Query text cannot be an empty string');
    qText += (qText.charAt(qText.length - 1) !== ';') ? ';\n' : '\n';

    if (typeof nameOrOptions === 'string') {
        qName = nameOrOptions.trim();
        if (qName === '') throw new TypeError('Query name must be a non-empty string');
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
        if (Array.isArray(nameOrOptions)) throw new TypeError('Query name must be a string');
        if (maskOrOptions !== undefined) throw new TypeError('Too many arguments provided');
        const validated = validateQueryOptions(nameOrOptions, true);
        qName = validated.name!;
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

function validateQueryOptions(options: ResultQueryOptions, checkName: boolean) {

    const mask = validateQueryMask(options.mask) || 'list';

    let handler: QueryHandler;
    if (options.handler) {
        handler = options.handler;
        if (handler !== Object && handler !== Array) {
            if (typeof handler !== 'object') throw new TypeError('Query handler is invalid');
            if (typeof handler.parse !== 'function') throw new TypeError('Query handler is invalid');
        }
    }
    else {
        handler = Object;
    }

    let name: string | undefined;
    if (checkName) {
        if (typeof options.name === 'string') {
            name = options.name.trim();
            if (name === '') throw new TypeError('Query name must be a non-empty string');
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

function validateQueryMask(mask: QueryMask) {
    if (mask !== 'list' && mask !== 'single') {
        const ms = (typeof mask === 'object') ? JSON.stringify(mask) : mask;
        throw new TypeError(`Query mask '${ms}' is invalid`);
    }
    return mask;
}

// UTILITY FUNCTIONS
// ================================================================================================
function isSafeString(value: string): boolean {
    return (!value.includes('\'') && !value.includes(`\\`));
}

// IMPORTS
// ================================================================================================
import {
    QueryMode, QueryMask, QueryTemplate, ResultQuery, ResultQueryOptions, ResultHandler,
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
    readonly mode?      : QueryMode;
    readonly mask?      : QueryMask;
    readonly values?    : any[];
    readonly handler?   : ResultHandler<T>;
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
    export function from<T>(text: string, options: ListResultQueryOptions<T>): ListResultQuery<T>
    export function from<T>(text: string, name: string, options: ListResultQueryOptions<T>): ListResultQuery<T>
    export function from<T>(text: string, options: SingleResultQueryOptions<T>): SingleResultQuery<T>
    export function from<T>(text: string, name: string, options: SingleResultQueryOptions<T>): SingleResultQuery<T>
    export function from<T>(text: string, nameOrOptions?: string | ResultQueryOptions<T>, options?: ResultQueryOptions<T>): Query {
        const validated = validateQueryArguments(text, nameOrOptions, options);
        if (validated.options) {
            return {
                text    : validated.text,
                name    : validated.name,
                mask    : validated.options.mask,
                mode    : validated.options.mode,
                handler : validated.options.handler
            };
        }
        else {
            return {
                text    : validated.text,
                name    : validated.name
            };
        }
    }

    export function template(text: string): QueryTemplate<Query<void>>
    export function template(text: string, name: string): QueryTemplate<Query<void>>
    export function template<T>(text: string, options?: ListResultQueryOptions<T>): QueryTemplate<ListResultQuery<T>>
    export function template<T>(text: string, name: string, options?: ListResultQueryOptions<T>): QueryTemplate<ListResultQuery<T>>
    export function template<T>(text: string, options?: SingleResultQueryOptions<T>): QueryTemplate<SingleResultQuery<T>>
    export function template<T>(text: string, name: string, options?: SingleResultQueryOptions<T>): QueryTemplate<SingleResultQuery<T>>
    export function template<T>(text: string, nameOrOptions?: string | ResultQueryOptions<T>, options?: ResultQueryOptions<T>): QueryTemplate<any> {

        const validated = validateQueryArguments(text, nameOrOptions, options);
        const textParts = validated.text.split(PARAM_PATTERN);
        if (textParts.length < 2) throw new QueryError('Query text must contain at least one parameter');

        const paramMatches = text.match(PARAM_PATTERN) as RegExpMatchArray;
        const paramSpecs: ParamSpec[] = [];
        for (let match of paramMatches) {
            paramSpecs.push(buildParamSpec(match));
        }

        return buildQueryTemplate(validated.name, textParts, paramSpecs, validated.options);
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
function buildQueryTemplate<T>(name: string, textParts: string[], paramSpecs: ParamSpec[], options?: ResultQueryOptions<T>): QueryTemplate<any> {

    return class ParameterizedQuery implements Query<T> {

        readonly name       : string;
        readonly mode?      : QueryMode;
        readonly mask?      : QueryMask;
        readonly text       : string;
        readonly values?    : any[];
        readonly handler?   : ResultHandler<T>;

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
            if (options) {
                this.mask = options.mask;
                this.mode = options.mode;
                this.handler = options.handler;
            }
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

    const valueType = typeof value;
    if (valueType === 'string') {
        return value;
    }
    else if (valueType === 'number') {
        return value.toString();
    }
    else {
        throw new Error(`Raw query parameter cannot be ${valueType} value`);
    }
}

function stringifySingleParam(value: any, values: string[]): string {
    if (value === undefined || value === null) return 'null';

    switch (typeof value) {
        case 'number': case 'boolean': {
            return value.toString();
        }
        case 'string':{
            return isSafeString(value) ? '\'' + value + '\'' : '$' + values.push(value);
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
    if (array === undefined || array === null || array.length === 0) return 'null';

    const paramValues: string[] = [];
    const arrayType = typeof array[0];
    for (let value of array) {
        if (value === undefined || value === null) continue;

        let valueType = typeof value;
        if (valueType !== arrayType)
            throw new Error('Query parameter cannot be an array of mixed values');

        if (valueType === 'string') {
            paramValues.push(value);
        }
        else if (valueType === 'number') {
            paramValues.push(value.toString());
        }
        else {
            throw new Error(`Query parameter array cannot contain ${valueType} values`);
        }
    }

    return paramValues.join(',');
}

function stringifyArrayParam(array: any[], values: string[]): string {
    if (array === undefined || array === null || array.length === 0) return 'null';
    if (!Array.isArray(array)) throw new Error('Query parameter must be an array');

    const paramValues: string[] = [];
    const arrayType = typeof array[0];
    for (let value of array) {
        if (value === undefined || value === null) continue;

        let valueType = typeof value;
        if (valueType !== arrayType)
            throw new Error('Query parameter cannot be an array of mixed values');

        if (valueType === 'string') {
            if (isSafeString(value)) {
                paramValues.push('\'' + value + '\'');
            }
            else {
                paramValues.push('$' + values.push(value));
            }
        }
        else if (valueType === 'number') {
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
function validateQueryArguments(text: string, nameOrOptions?: string | ResultQueryOptions, options?: ResultQueryOptions) {
    if (typeof text !== 'string') throw new TypeError('Query text must be a string');
    let qText = text.trim();
    if (qText === '') throw new TypeError('Query text cannot be an empty string');
    qText += (qText.charAt(qText.length - 1) !== ';') ? ';\n' : '\n';

    let qName: string;
    let qOptions: ResultQueryOptions | undefined;
    if (typeof nameOrOptions === 'string') {
        qName = nameOrOptions.trim();
        if (typeof qName !== 'string' || !qName) throw new TypeError('Query name must be a non-empty string');
        if (options) {
            qOptions = validateQueryOptions(options);
        }
    }
    else if (typeof nameOrOptions === 'object') {
        if (Array.isArray(nameOrOptions)) {
            throw new TypeError('Query name must be a string');
        }
        qName = 'unnamed query';
        qOptions = validateQueryOptions(nameOrOptions);
    }
    else if (nameOrOptions) {
        throw new TypeError('Query name must be a string');
    }
    else {
        qName = 'unnamed query';
    }

    return { text: qText, name: qName, options: qOptions };
}

function validateQueryOptions({ mask, mode, handler}: ResultQueryOptions) {
    if (mask !== 'list' && mask !== 'single') {
        const ms = (typeof mask === 'object') ? JSON.stringify(mask) : mask;
        throw new TypeError(`Query mask '${ms}' is invalid`);
    }

    if (mode === undefined) {
        mode = 'object';
    }
    else {
        if (mode !== 'object' && mode !== 'array') {
            const ms = (typeof mode === 'object') ? JSON.stringify(mode) : mode;
            throw new TypeError(`Query mode '${ms}' is invalid`);
        }
    }

    if (handler) {
        if (typeof handler !== 'object') throw new TypeError('Query handler is invalid');
        if (typeof handler.parse !== 'function') throw new TypeError('Query handler is invalid');
    }

    return { mask, mode, handler };
}

// UTILITY FUNCTIONS
// ================================================================================================
function isSafeString(value: string): boolean {
    return (!value.includes('\'') && !value.includes(`\\`));
}

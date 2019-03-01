// IMPORTS
// ================================================================================================
import { ParseError } from '../errors';

// TIMESTAMP
// ================================================================================================
export type Timestamp = number;

export namespace Timestamp {

    export function parse(value: any): Timestamp | undefined {
        if (value === null || value === undefined) return undefined;
        const ts = Number.parseInt(value, 10);
        if (!Number.isInteger(ts)) throw new ParseError(`Cannot parse a timestamp: value ${value} is invalid`);
        return ts;
    }
}

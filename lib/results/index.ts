// IMPORTS
// ================================================================================================
import { QueryMask, QueryHandler, ResultHandler } from '@nova/pg-dao';
import { ArrayResult } from './ArrayResult';
import { ObjectResult } from './ObjectResult';
import { CustomResult } from './CustomResult';
import { EmptyResult } from './EmptyResult';

// INTERFACES
// ================================================================================================
export interface Result {

    readonly promise    : Promise<any>;
    readonly isComplete : boolean;

    addFields(fieldDescriptions: FieldDescription[]): void;
    addRow(rowData: string[]): void;
    applyCommandComplete(command: CommandComplete): void;

    end(error?: Error): void;
}

export interface FieldDescription {
    name            : string;
    tableID         : number;
    columnID        : number;
    dataTypeID      : number;
    dataTypeSize    : number;
    dataTypeModifier: number;
    format          : string;
}

export interface CommandComplete {
    name            : 'commandComplete';
    length          : number;
    text            : string;
}

interface ResultOptions {
    mask?           : QueryMask;
    handler?        : QueryHandler;
}

// PUBLIC FUNCTIONS
// ================================================================================================
export function createResult(options: ResultOptions): Result {

    if (options.handler) {
        const handler = options.handler;
        if (handler === Object) {
            return new ObjectResult(options.mask || 'list');
        }
        else if (handler === Array) {
            return new ArrayResult(options.mask || 'list');
        }
        else {
            return new CustomResult(options.mask || 'list', handler as ResultHandler);
        }
    }
    else {
        if (options.mask) {
            return new ObjectResult(options.mask);
        }
        else {
            return new EmptyResult();
        }
    }
}
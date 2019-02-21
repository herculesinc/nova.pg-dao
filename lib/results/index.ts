// IMPORTS
// ================================================================================================
import { QueryMask, QueryMode, ResultHandler } from '@nova/pg-dao';
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
    addRow(rowData: any[]): void;
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
    mode?           : QueryMode;
    handler?        : ResultHandler;
}

// PUBLIC FUNCTIONS
// ================================================================================================
export function createResult(options: ResultOptions): Result {
    if (options.mode === 'array') {
        return new ArrayResult(options.mask || 'list');
    }
    else if (options.mode === 'object') {
        return new ObjectResult(options.mask || 'list');
    }
    else if (options.handler) {
        return new CustomResult(options.mask || 'list', options.handler);
    }
    else {
        return new EmptyResult();
    }
}
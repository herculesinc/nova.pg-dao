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

    oid?                : number;
    rowCount?           : number;
    command?            : string;

    readonly promise    : Promise<any>;
    readonly rows       : any[];
    readonly isComplete : boolean;

    addFields(fieldDescriptions: FieldDescription[]): void;
    addRow(rowData: any[]): void;
    complete(command: string): void;

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
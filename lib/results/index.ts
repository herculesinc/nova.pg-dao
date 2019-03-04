// IMPORTS
// ================================================================================================
import { QueryMask, QueryHandler, ResultHandler } from '@nova/pg-dao';
import { FieldDescription } from 'pg';
import { isModelClass } from '../Model';
import { Store } from '../Store';
import { ArrayResult } from './ArrayResult';
import { ObjectResult } from './ObjectResult';
import { CustomResult } from './CustomResult';
import { ModelResult } from './ModelResult';
import { EmptyResult } from './EmptyResult';

// INTERFACES
// ================================================================================================
export interface Result {

    readonly command?   : string;
    readonly rowCount   : number;
    readonly promise    : Promise<any>;
    readonly isComplete : boolean;

    addFields(fieldDescriptions: FieldDescription[]): void;
    addRow(rowData: string[]): void;
    complete(command: string, rows: number): void;

    end(error?: Error): void;
}

interface ResultOptions {
    mask?           : QueryMask;
    handler?        : QueryHandler;
    mutable?        : boolean;
}

// PUBLIC FUNCTIONS
// ================================================================================================
export function createResult(options: ResultOptions, store: Store): Result {

    if (options.handler) {
        const handler = options.handler;
        const mask = options.mask || 'list';
        if (handler === Object) {
            return new ObjectResult(mask);
        }
        else if (handler === Array) {
            return new ArrayResult(mask);
        }
        else if (isModelClass(handler)) {
            return new ModelResult(mask, options.mutable || false, handler, store);
        }
        else {
            return new CustomResult(mask, handler as ResultHandler);
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
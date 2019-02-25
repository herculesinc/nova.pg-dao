export { DbSchema } from './DbSchema';
export { DbField } from './DbField';
export { Timestamp } from './types';
export { SelectModelQuery, FetchQueryClass, InsertQueryClass, UpdateQueryClass, DeleteQueryClass } from './queries';

import { buildSelectQueryClass, buildFetchQueryClass, buildInsertQueryClass, buildUpdateQueryClass, buildDeleteQueryClass } from './queries';
export const queries = {
    buildSelectQueryClass   : buildSelectQueryClass,
    buildFetchQueryClass    : buildFetchQueryClass,
    buildInsertQueryClass   : buildInsertQueryClass,
    buildUpdateQueryClass   : buildUpdateQueryClass,
    buildDeleteQueryClass   : buildDeleteQueryClass
};
export { DbSchema } from './DbSchema';
export { DbField } from './DbField';
export { Timestamp } from './types';
export { SelectModelQuery, InsertModelQuery, UpdateModelQuery, DeleteModelQuery } from './queries';
export { dbModel, dbField } from './decorators';
export { PgIdGenerator, GuidGenerator } from './idGenerators';

import { buildSelectQueryClass, buildInsertQueryClass, buildUpdateQueryClass, buildDeleteQueryClass } from './queries';
export const queries = {
    buildSelectQueryClass   : buildSelectQueryClass,
    buildInsertQueryClass   : buildInsertQueryClass,
    buildUpdateQueryClass   : buildUpdateQueryClass,
    buildDeleteQueryClass   : buildDeleteQueryClass
};
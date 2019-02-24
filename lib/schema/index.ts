export { DbSchema } from './DbSchema';
export { DbField } from './DbField';
export { Timestamp } from './types';
export { SelectQueryTemplate, UpdateQueryTemplate } from './queries';

import { buildSelectQueryTemplate, buildInsertQueryTemplate, buildUpdateQueryTemplate, buildDeleteQueryTemplate } from './queries';
export const queries = {
    buildSelectQueryTemplate: buildSelectQueryTemplate,
    buildInsertQueryTemplate: buildInsertQueryTemplate,
    buildUpdateQueryTemplate: buildUpdateQueryTemplate,
    buildDeleteQueryTemplate: buildDeleteQueryTemplate
};
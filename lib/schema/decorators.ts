// IMPORTS
// ================================================================================================
import { IdGenerator, FieldHandler, DbFieldType } from '@nova/pg-dao';
import { ModelError } from '../errors';
import { DbField } from './DbField';

// MODULE VARIABLES
// ================================================================================================
const symFields = Symbol();

// INTERFACES
// ================================================================================================
export interface dbFieldOptions {
    readonly?   : boolean;
    handler?    : FieldHandler;
}

// DECORATOR DEFINITIONS
// ================================================================================================
export function dbModel(table: string, idGenerator: IdGenerator): ClassDecorator {
	// validate table name
	if (!table) throw new ModelError('Cannot build model schema: table name is undefined');
	if (table.trim() === '') throw new ModelError('Cannot build model schema: table name is invalid');

	// validate ID Generator
	if (!idGenerator) throw new ModelError('Cannot build model schema: ID Generator is undefined');
	if (typeof idGenerator.getNextId !== 'function')
		throw new ModelError('Cannot build model schema: ID Generator is invalid');

    return function (classConstructor: any) {
        const schemaMap: Map<string, any> = classConstructor.prototype[symFields];
        const fields = schemaMap.get(classConstructor.name);
        classConstructor.setSchema(table, idGenerator, fields);
    };
}

export function dbField(fieldType: DbFieldType, options?: dbFieldOptions): PropertyDecorator {
    // make sure options are set
    options = { readonly: false , ...options };

    return function (classPrototype: any, property: string | symbol) {
        if (typeof property === 'symbol') throw new ModelError('A symbol property cannot be a part of model schema');
        const field = new DbField(property, fieldType, options!.readonly, options!.handler);

        let schemaMap: Map<string, any> = classPrototype[symFields];
        if (!schemaMap) {
            schemaMap = new Map();
            classPrototype[symFields] = schemaMap;
        }

        let schema = schemaMap.get(classPrototype.constructor.name);
        if (!schema) {
            schema = {};
            schemaMap.set(classPrototype.constructor.name, schema);
        }
        schema[property] = field;
    };
}

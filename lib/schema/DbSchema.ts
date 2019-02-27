// IMPORTS
// ================================================================================================
import { FieldMap, IdGenerator, DbSchema as IDbSchema } from '@nova/pg-dao';
import { ModelError } from '../errors';
import { DbField } from './DbField';
import { Timestamp } from './types';

// CLASS DEFINITION
// ================================================================================================
export class DbSchema implements IDbSchema {

    readonly name			: string;
	readonly table          : string;
	readonly idGenerator	: IdGenerator;
	readonly fields		    : DbField[];

	private readonly fieldMap   		: Map<string, DbField>;
	private readonly customSerializers	: Map<string, DbField>;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
	constructor(name: string, table: string, idGenerator: IdGenerator, fields: FieldMap) {

        // validate and set model name
        if (name === undefined) throw new TypeError('Cannot build model schema: model name is undefined');
        if (typeof name !== 'string') throw new TypeError('Cannot build model schema: model name must be a string');
        this.name = name.trim();
        if (this.name === '') throw new TypeError('Cannot build model schema: model name cannot be an empty string');

		// validate and set table name
        if (table === undefined) throw new TypeError('Cannot build model schema: table name is undefined');
        if (typeof table !== 'string') throw new TypeError('Cannot build model schema: table name must be a string');
        this.table = table.trim();
		if (this.table === '') throw new TypeError('Cannot build model schema: table name cannot be an empty string');

		// validate and set ID Generator
		if (idGenerator === undefined) throw new TypeError('Cannot build model schema: ID Generator is undefined');
		if (typeof idGenerator !== 'object' || idGenerator === null || typeof idGenerator.getNextId !== 'function') {
			throw new TypeError('Cannot build model schema: ID Generator is invalid');
		}
		this.idGenerator = idGenerator;

		// validate and set fields
		if (!fields) throw new TypeError('Cannot build model schema: fields are undefined');
		this.fields = [];
		this.fieldMap = new Map();
		this.customSerializers = new Map();

		// set the ID field
		const idField = new DbField('id', String, true);
		this.fields.push(idField);
		this.fieldMap.set(idField.name, idField);

		// set createdOn and updatedOn field
		const createdOnField = new DbField('createdOn', Timestamp, true);
		this.fields.push(createdOnField);
		this.fieldMap.set(createdOnField.name, createdOnField);

		const updatedOnField = new DbField('updatedOn', Timestamp, false);
		this.fields.push(updatedOnField);
		this.fieldMap.set(updatedOnField.name, updatedOnField);

		// set all other model fields
		let fieldCount = 0;
		for (let fieldName in fields) {
			let config = fields[fieldName];
			if (!config) throw new TypeError(`Cannot build model schema: definition for field '${fieldName}' is undefined`);
			let field = (config instanceof DbField)
				? config
				: new DbField(fieldName, config.type, config.readonly, config.handler);

			this.fields.push(field);
			this.fieldMap.set(field.name, field);
			if (field.serialize) {
				this.customSerializers.set(field.name, field);
			}
			fieldCount++;
		}
		
		if (fieldCount === 0) {
			if (!fields) throw new ModelError(`Cannot define a model for ${table} table: schema has no fields`);
		}
    }

    // PUBLIC ACCESSORS
    // --------------------------------------------------------------------------------------------
    get hasCustomSerializers(): boolean {
		return (this.customSerializers.size > 0);
	}

    // PUBLIC METHODS
    // --------------------------------------------------------------------------------------------
    hasField(fieldName: string): boolean {
		return this.fieldMap.has(fieldName);
	}

	getField(fieldName: string): DbField | undefined {
		return this.fieldMap.get(fieldName);
	}
}

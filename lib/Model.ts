// IMPORTS
// ================================================================================================
import { 
    FieldDescriptor, Query, ListResultQuery, SingleResultQuery, QueryTemplate, IdGenerator, FieldMap
} from '@nova/pg-dao';
import { DbSchema, DbField, SelectQueryTemplate, UpdateQueryTemplate, queries } from './schema';
import { ModelError } from './errors';

// MODULE VARIABLES
// ================================================================================================
export const symDeleted = Symbol();
export const symCreated = Symbol();
export const symMutable = Symbol();

const symOriginal = Symbol();

// CLASS DEFINITION
// ================================================================================================
export class Model {

    private static schema   : DbSchema;

    static qFetchOneModel   : SelectQueryTemplate;
    static qFetchAllModels  : SelectQueryTemplate;
    static qInsertModel     : QueryTemplate<any>;
    static qUpdateModel     : UpdateQueryTemplate;
    static qDeleteModel     : QueryTemplate<any>;

    readonly id!            : string;    
    readonly createdOn!     : number;
    updatedOn!              : number;

    [symOriginal]           : any;

    [symMutable]            : boolean;
    [symCreated]            : boolean;
    [symDeleted]            : boolean;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(seed: string[] | object, fields: FieldDescriptor[]) {
        if (!seed) throw new ModelError('Cannot instantiate a model: model seed is undefined');

        if (Array.isArray(seed)) {
            // TODO: this.infuse(seed);
        }
        else {

        }

        // initialize internal state
        this[symMutable] = false;
        this[symCreated] = false;
        this[symDeleted] = false;
    }

    // STATIC METHODS
    // --------------------------------------------------------------------------------------------
    static parse<T extends typeof Model>(this: T, rowData: string[], fields: FieldDescriptor[]): InstanceType<T> {
        return (new this(rowData, fields) as InstanceType<T>);
    }

    static getFetchOneQuery<T extends typeof Model>(this: T, selector: any, forUpdate: boolean): SingleResultQuery<InstanceType<T>> {
        return (new this.qFetchOneModel(selector, forUpdate) as SingleResultQuery<InstanceType<T>>);
    }

    static getFetchAllQuery<T extends typeof Model>(selector: any, forUpdate: boolean): ListResultQuery<InstanceType<T>> {
        return (new this.qFetchAllModels(selector, forUpdate) as ListResultQuery<InstanceType<T>>);
    }

    static setSchema(tableName: string, idGenerator: IdGenerator, fields: FieldMap) {
        // create and set schema
        const modelName = this.name;
        if (this.schema) throw new ModelError(`Cannot set model schema: schema for ${modelName} model has already been set`);
        const schema = new DbSchema(modelName, tableName, idGenerator, fields);
        this.schema = schema;

        // build query templates
        this.qFetchAllModels = queries.buildSelectQueryTemplate(schema, 'list', this);
        this.qFetchOneModel = queries.buildSelectQueryTemplate(schema, 'single', this);
        this.qInsertModel = queries.buildInsertQueryTemplate(schema);
        this.qUpdateModel = queries.buildUpdateQueryTemplate(schema);
        this.qDeleteModel = queries.buildDeleteQueryTemplate(schema);
    }

    static getSchema(): DbSchema {
        return this.schema;
    }

    // STATE ACCESSORS
    // --------------------------------------------------------------------------------------------
    isMutable(): boolean {
        return this[symMutable];
    }

    isCreated(): boolean {
        return this[symCreated];
    }

    isDeleted() {
        return this[symDeleted];
    }

    // MODEL METHODS
    // --------------------------------------------------------------------------------------------
    infuse(rowData: string[], fields: FieldDescriptor[]) {
        const schema = (this.constructor as typeof Model).getSchema();
        const original = [];
        for (let i = 0; i < schema.fields.length; i++) {
            let field = schema.fields[i];
            let fieldValue = field.parse ? field.parse(rowData[i]) : fields[i].parser(rowData[i]);
            this[field.name as keyof this] = fieldValue;

            // don't keep originals of read-only fields
            if (field.readonly) continue;
            original[i] = field.clone ? field.clone(fieldValue) : fieldValue;
        }
        this[symOriginal] = original;
    }

    getSyncQueries(): Query[] {
        const queries: Query[] = [];

        if (this[symCreated]) {
            queries.push(this.buildInsertQuery());
        }
        else if (this[symDeleted]) {
            queries.push(this.buildDeleteQuery());
        }
        else {
            // check if any fields have changed
            const schema = (this.constructor as typeof Model).getSchema();
            const original = this[symOriginal];
            const changes: DbField[] = [];
            for (let field of schema.fields) {
                if (field.readonly) continue;

                let fieldName = field.name as keyof this;
                if (field.areEqual) {
                    if (!field.areEqual(original[fieldName], this[fieldName])) {
                        changes.push(field);
                    }
                }
                else {
                    if (original[fieldName] !== this[fieldName]) {
                        changes.push(field);
                    }
                }
            }

            if (changes.length > 0) {
                queries.push(this.buildUpdateQuery(changes));
            }
        }

        return queries;
    }

    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    private buildInsertQuery() {
        const schema = (this.constructor as typeof Model).getSchema();
        const qInsertModel = (this.constructor as typeof Model).qInsertModel;
        
        // make sure fields with custom serialization are treaded correctly
        if (schema.hasCustomSerializers) {
            const params: any = {};
            for (let field of schema.fields) {
                let fieldName = field.name as keyof this;
                let fieldValue = this[fieldName];
                params[fieldName] = field.serialize ? field.serialize(fieldValue) : fieldValue;
            }
        }
        else {
            return new qInsertModel(this);
        }
    }

    private buildUpdateQuery(changes: DbField[]) {
        const qUpdateModel = (this.constructor as typeof Model).qUpdateModel;
        return new qUpdateModel(this, changes);
    }

    private buildDeleteQuery() {
        const qDeleteModel = (this.constructor as typeof Model).qDeleteModel;
        return new qDeleteModel(this);
    }
}


class Account extends Model {

}

const x = Account.getFetchOneQuery(undefined, true);
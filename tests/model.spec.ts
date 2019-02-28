import { expect } from 'chai';

import { Model } from '../lib/Model';
import { dbModel, dbField, PgIdGenerator, Timestamp } from '../index';
import { ModelError } from '../lib/errors';

const table = 'test_table';
const idGenerator = new PgIdGenerator(`${table}_seq`);

let schema: any;

describe('NOVA.PG-DAO -> Model;', () => {
    it('should create new model without errors', () => {
        expect(() => {
            class TestModel extends Model {
            }
        }).to.not.throw();
    });

    it('should create new model by decorator without errors', () => {
        expect(() => {
            @dbModel(table, idGenerator)
            class TestModel extends Model {
                @dbField(Number)
                num!: number;
            }
        }).to.not.throw();
    });

    it('should be linked to correct db table', () => {
        @dbModel(table, idGenerator)
        class TestModel extends Model {
            @dbField(Number)
            num!: number;
        }

        expect(TestModel.getSchema().table).to.equal(table);
    });

    describe('Default fields', () => {
        beforeEach(() => {
            @dbModel(table, idGenerator)
            class TestModel extends Model {

                @dbField(Number)
                numField!: number;
            }

            schema = TestModel.getSchema();
        });

        describe('id field', () => {
            checkSchemaField('id', String, 'String');
        });

        describe('createdOn field', () => {
            checkSchemaField('createdOn', Timestamp, 'Timestamp');
        });
        describe('updatedOn field', () => {
            checkSchemaField('updatedOn', Timestamp, 'Timestamp');
        });
    });

    describe('Defining fields of different type', () => {
        describe('Number type', () => {
            beforeEach(() => {
                @dbModel(table, idGenerator)
                class TestModel extends Model {

                    @dbField(Number)
                    numField!: number;
                }

                schema = TestModel.getSchema();
            });

            checkSchemaField('numField', Number, 'Number');
        });

        describe('String type', () => {
            beforeEach(() => {
                @dbModel(table, idGenerator)
                class TestModel extends Model {

                    @dbField(String)
                    strField!: string;
                }

                schema = TestModel.getSchema();
            });

            checkSchemaField('strField', String, 'String');
        });

        describe('Boolean type', () => {
            beforeEach(() => {
                @dbModel(table, idGenerator)
                class TestModel extends Model {

                    @dbField(Boolean)
                    boolField!: boolean;
                }

                schema = TestModel.getSchema();
            });

            checkSchemaField('boolField', Boolean, 'Boolean');
        });

        describe('Timestamp type', () => {
            beforeEach(() => {
                @dbModel(table, idGenerator)
                class TestModel extends Model {

                    @dbField(Timestamp)
                    tsField!: number;
                }

                schema = TestModel.getSchema();
            });

            checkSchemaField('tsField', Timestamp, 'Timestamp');
        });

        describe('Date type', () => {
            beforeEach(() => {
                @dbModel(table, idGenerator)
                class TestModel extends Model {

                    @dbField(Date)
                    dateField!: number;
                }

                schema = TestModel.getSchema();
            });

            checkSchemaField('dateField', Date, 'Date');
        });

        describe('Object type', () => {
            beforeEach(() => {
                @dbModel(table, idGenerator)
                class TestModel extends Model {

                    @dbField(Object)
                    objField!: any;
                }

                schema = TestModel.getSchema();
            });

            checkSchemaField('objField', Object, 'Object');
        });

        describe('Array type', () => {
            beforeEach(() => {
                @dbModel(table, idGenerator)
                class TestModel extends Model {

                    @dbField(Array)
                    arrField!: Array<any>;
                }

                schema = TestModel.getSchema();
            });

            checkSchemaField('arrField', Array, 'Array');
        });

    });

    describe('Generation of Select/Insert/Update/Delete SQL statements', () => {
        let TModel: any;

        const selectTests = [
            {mutable: true,  selector: undefined},
            {mutable: false, selector: undefined},
            {mutable: true,  selector: {id: 1}},
            {mutable: false, selector: {id: 1}}
        ];

        beforeEach(() => {
            @dbModel(table, idGenerator)
            class TestModel extends Model {

                @dbField(Number)
                camelCase!: number;

                @dbField(String)
                simple!: string;
            }

            TModel = TestModel;
        });

        describe('qSelectAllModels() method should return correct statements', () => {
            selectTests.forEach((test: any) => {
                const {mutable, selector} = test;

                it(`for mutable='${mutable}' and selector=${JSON.stringify(selector)}`, () => {
                    const query = new TModel.qSelectAllModels(mutable, selector);

                    expect(query.text).to.includes(`SELECT test_table.id, test_table.created_on AS "createdOn", test_table.updated_on AS "updatedOn", test_table.camel_case AS "camelCase", test_table.simple FROM ${table}`);

                    if (mutable) {
                        expect(query.text).to.includes('FOR UPDATE');
                    } else {
                        expect(query.text).to.not.includes('FOR UPDATE');
                    }

                    if (selector) {
                        expect(query.text).to.includes('WHERE');
                    } else {
                        expect(query.text).to.not.includes('WHERE');
                    }
                });
            });
        });

        describe('qSelectOneModel() method should return correct statements', () => {
            selectTests.forEach((test: any) => {
                const {mutable, selector} = test;

                it(`for mutable='${mutable}' and selector=${JSON.stringify(selector)}`, () => {
                    const query = new TModel.qSelectOneModel(mutable, selector);

                    expect(query.text).to.includes(`SELECT test_table.id, test_table.created_on AS "createdOn", test_table.updated_on AS "updatedOn", test_table.camel_case AS "camelCase", test_table.simple FROM ${table}`);

                    if (mutable) {
                        expect(query.text).to.includes('FOR UPDATE');
                    } else {
                        expect(query.text).to.not.includes('FOR UPDATE');
                    }

                    expect(query.text).to.includes('WHERE');
                });
            });
        });

        describe('qInsertModel() method should return correct statements', () => {
            it('with safe text', () => {
                const testModel = new TModel({id: '1', createdOn: 2, updatedOn: 3, camelCase: 4, simple: 'Test_1'});
                const query = new TModel.qInsertModel(testModel);

                expect(query.text).to.includes(`INSERT INTO ${table} (id,created_on,updated_on,camel_case,simple)`);
                expect(query.text).to.includes('VALUES (\'1\',2,3,4,\'Test_1\')');
            });

            it('with unsafe text', () => {
                const testModel = new TModel({id: '1', createdOn: 2, updatedOn: 3, camelCase: 4, simple: 'Test\'1'});
                const query = new TModel.qInsertModel(testModel);

                expect(query.text).to.includes(`INSERT INTO ${table} (id,created_on,updated_on,camel_case,simple)`);
                expect(query.text).to.includes('VALUES (\'1\',2,3,4,$1)');
            });
        });

        describe('qUpdateModel() method should return correct statements', () => {
            it('with safe text', () => {
                const testModel = new TModel({id: '1', createdOn: 2, updatedOn: 3, camelCase: 4, simple: 'Test_1'});
                const field = TModel.getSchema().fieldMap.get('simple');

                const query = new TModel.qUpdateModel(testModel, [field]);

                expect(query.text).to.includes(`UPDATE ${table}`);
                expect(query.text).to.includes('SET simple=\'Test_1\' WHERE id = \'1\'');
            });

            it('with unsafe text', () => {
                const testModel = new TModel({id: '1', createdOn: 2, updatedOn: 3, camelCase: 4, simple: 'Test\'1'});
                const field = TModel.getSchema().fieldMap.get('simple');

                const query = new TModel.qUpdateModel(testModel, [field]);

                expect(query.text).to.includes(`UPDATE ${table}`);
                expect(query.text).to.includes('SET simple=$1 WHERE id = \'1\'');
            });
        });

        describe('qDeleteModel() method should return correct statements', () => {
            it('should return correct statement', () => {
                const testModel = new TModel({id: '1', createdOn: 2, updatedOn: 3, camelCase: 4, simple: 'Test_1'});

                const query = new TModel.qDeleteModel(testModel);

                expect(query.text).to.includes('DELETE FROM test_table WHERE id = \'1\'');
            });
        });
    });

    describe('Error conditions', () => {
        describe('Table name section', () => {
            const invalidTableNameErrorText = 'Cannot build model schema: table name is invalid';

            [
                {tableName: undefined, type: 'undefined',    error: 'Cannot build model schema: table name is undefined'},
                {tableName: null,      type: 'null',         error: invalidTableNameErrorText},
                {tableName: 123,       type: 'number',       error: invalidTableNameErrorText},
                {tableName: '',        type: 'empty string', error: invalidTableNameErrorText}
            ].forEach((test: any) => {
                const {type, tableName, error} = test;

                it(`should throw an error when table name is ${type}`, () => {
                    expect(() => {
                        @dbModel(tableName, idGenerator)
                        class TestModel extends Model {
                            @dbField(Number)
                            num!: number;
                        }
                    }).to.throw(TypeError, error);
                });
            });
        });

        describe('Table id generator section', () => {
            const invalidTableIdGeneratorErrorText = 'Cannot build model schema: ID Generator is invalid';

            [
                {idGen: undefined, type: 'undefined',      error: 'Cannot build model schema: ID Generator is undefined'},
                {idGen: null,      type: 'null',           error: invalidTableIdGeneratorErrorText},
                {idGen: 123,       type: 'number',         error: invalidTableIdGeneratorErrorText},
                {idGen: 'abc',     type: 'string',         error: invalidTableIdGeneratorErrorText},
                {idGen: () => {},  type: 'arrow function', error: invalidTableIdGeneratorErrorText}
            ].forEach((test: any) => {
                const {type, idGen, error} = test;

                it(`should throw an error when id generator is ${type}`, () => {
                    expect(() => {
                        @dbModel(table, idGen)
                        class TestModel extends Model {
                            @dbField(Number)
                            num!: number;
                        }
                    }).to.throw(TypeError, error);
                });
            });
        });

        describe('General model field section', () => {
            it('defining model with no field should throw an error', () => {
                expect(() => {
                    @dbModel(table, idGenerator)
                    class TestModel extends Model {
                    }
                }).to.throw(ModelError, `Cannot define model for ${table} table: schema has no fields`);
            });
        });

        describe('Model field name section', () => {
            const invalidModelFieldNameErrorText = 'Database field name must be a string';

            [
                {fieldName: undefined, type: 'undefined',      error: invalidModelFieldNameErrorText},
                {fieldName: null,      type: 'null',           error: invalidModelFieldNameErrorText},
                {fieldName: 123,       type: 'number',         error: invalidModelFieldNameErrorText},
                {fieldName: '',        type: 'empty string',   error: 'Database field name cannot be an empty string'},
                {fieldName: Symbol(),  type: 'symbol',         error: 'A symbol property cannot be a part of model schema'},
                {fieldName: () => {},  type: 'arrow function', error: invalidModelFieldNameErrorText}
            ].forEach((test: any) => {
                const {fieldName, type, error} = test;

                it(`should throw an error when model field name is ${type}`, () => {
                    expect(() => {
                        @dbModel(table, idGenerator)
                        class TestModel extends Model {
                            @dbField(Number)
                            num!: number;
                        }

                        dbField(Number)(TestModel, fieldName);
                    }).to.throw(TypeError, error);
                });
            });
        });

        describe('Model field type section', () => {
            const invalidModelFieldTypeErrorText = 'Invalid field type in model schema';

            [
                {fieldType: undefined, type: 'undefined',error: 'Database field type is undefined'},
                {fieldType: null,      type: 'null',     error: invalidModelFieldTypeErrorText},
                {fieldType: 123,       type: 'number',   error: invalidModelFieldTypeErrorText},
                {fieldType: '123',     type: 'number',   error: invalidModelFieldTypeErrorText},
                {fieldType: Symbol,    type: 'symbol',   error: invalidModelFieldTypeErrorText},
                {fieldType: Function,  type: 'function', error: invalidModelFieldTypeErrorText},
                {fieldType: Buffer,    type: 'buffer',   error: invalidModelFieldTypeErrorText}
            ].forEach((test: any) => {
                const {fieldType, type, error} = test;

                it(`should throw an error when model field type is ${type}`, () => {
                    expect(() => {
                        @dbModel(table, idGenerator)
                        class TestModel extends Model {
                            @dbField(Number)
                            num!: number;
                        }

                        dbField(fieldType)(TestModel, 'test');
                    }).to.throw(TypeError, error);
                });
            });
        });

        describe('Model field readonly section', () => {
            const invalidModelFieldReadonlyErrorText = 'Database field readonly attribute must be a boolean';

            [
                {readonly: null,  type: 'null',   error: invalidModelFieldReadonlyErrorText},
                {readonly: 123,   type: 'number', error: invalidModelFieldReadonlyErrorText},
                {readonly: '123', type: 'number', error: invalidModelFieldReadonlyErrorText}
            ].forEach((test: any) => {
                const {readonly, type, error} = test;

                it(`should throw an error when model field readonly is ${type}`, () => {
                    expect(() => {
                        @dbModel(table, idGenerator)
                        class TestModel extends Model {
                            @dbField(Number)
                            num!: number;
                        }

                        dbField(Number, {readonly})(TestModel, 'test');
                    }).to.throw(TypeError, error);
                });
            });
        });

        describe('Model field handler section', () => {
            const numberTypeHandler = 'Cannot specify custom handler for Number, String, or Timestamp fields';

            const handler: any = {
                parse   : (value: string): string => value,
                clone   : (value: any): any => value,
                areEqual: (value1: any, value2: any): boolean => value1 !== value2
            };

            [Number, String, Timestamp, Boolean, Date].forEach(type => {
                const errorText = type === Date
                    ? 'Cannot specify custom handler for Date field'
                    : 'Cannot specify custom handler for Number, String, or Timestamp fields';

                it(`should throw an error when model field readonly is ${type}`, () => {
                    expect(() => {
                        @dbModel(table, idGenerator)
                        class TestModel extends Model {
                            @dbField(Number)
                            num!: number;
                        }

                        dbField(type, {handler})(TestModel, 'test');
                    }).to.throw(ModelError, errorText);
                });
            });
        });
    });
});

// helpers
function checkSchemaField (field: string, type: any, typeName: string) {
    it(`schema should have '${field}' field`, () => {
        expect(schema.fieldMap.get(field)).to.not.be.undefined;
    });
    it(`'${field}' field should have correct name`, () => {
        expect(schema.fieldMap.get(field).name).to.equal(field);
    });
    it(`'${field}' field should have '${typeName}' type`, () => {
        expect(schema.fieldMap.get(field).type).to.equal(type);
    });
}

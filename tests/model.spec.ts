import { expect } from 'chai';

import { Model } from '../lib/Model';
import { dbModel, dbField, PgIdGenerator, Timestamp } from '../index';
import { ModelError } from '../lib/errors';

const table = 'test_table';
const idGenerator = new PgIdGenerator(`${table}_id_seq`);
const parser = (value: string): any => value;

let schema: any;

describe('NOVA.PG-DAO -> Model;', () => {
    describe('Creating of model', () => {
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
            {mutable: true,  selector: {id: '1'}},
            {mutable: false, selector: {id: '1'}}
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

    describe('Instantiating of model', () => {
        let TModel: any;
        let instanceData: any;

        beforeEach(() => {
            @dbModel(table, idGenerator)
            class TestModel extends Model {
                @dbField(Number)
                num!: number;

                @dbField(Object)
                obj!: any;
            }

            TModel = TestModel;

            instanceData = {id: '1', createdOn: Date.now(), updatedOn: Date.now(), num: 123, obj: {a: '345'}};
        });

        describe('with object seed', () => {
            it('should instantiate model without errors', () => {
                expect(() => {
                    new TModel(instanceData);
                }).to.not.throw();
            });

            it('should contain correct field data without clone key', () => {
                const instance = new TModel(instanceData);

                Object.keys(instanceData).forEach(key => {
                    expect((instanceData as any)[key]).to.equal(instance[key]);
                    expect(typeof (instanceData as any)[key]).to.equal(typeof instance[key]);
                });

                expect(instance.isMutable).to.to.be.false;
                expect(instance.isCreated).to.to.be.false;
                expect(instance.isDeleted).to.to.be.false;
            });

            it('should contain correct field data with clone key', () => {
                const instance = new TModel(instanceData, true);

                Object.keys(instanceData).forEach(key => {
                    const value = (instanceData as any)[key];

                    if (typeof value === 'object') {
                        expect((instanceData as any)[key]).to.not.equal(instance[key]);
                        expect((instanceData as any)[key]).to.deep.equal(instance[key]);
                    } else {
                        expect((instanceData as any)[key]).to.equal(instance[key]);
                    }

                    expect(typeof (instanceData as any)[key]).to.equal(typeof instance[key]);
                });

                expect(instance.isMutable).to.to.be.false;
                expect(instance.isCreated).to.to.be.false;
                expect(instance.isDeleted).to.to.be.false;
            });

            it('when clone set to false, updating of instance data should affect of model', () => {
                const instance = new TModel(instanceData, false);

                expect(instanceData.obj.b).to.be.undefined;
                expect(instanceData.obj).to.equal(instance.obj);

                instanceData.obj.b = 125;

                expect(instanceData.obj.b).to.not.be.undefined;
                expect(instance.obj.b).to.not.be.undefined;
                expect(instanceData.obj).to.equal(instance.obj);

                delete instance.obj.b;

                expect(instanceData.obj.b).to.be.undefined;
                expect(instance.obj.b).to.be.undefined;
                expect(instanceData.obj).to.equal(instance.obj);
            });

            it('when clone set to false, updating of instance data should not affect of model', () => {
                const instance = new TModel(instanceData, true);

                expect(instanceData.obj.b).to.be.undefined;
                expect(instanceData.obj).to.not.equal(instance.obj);
                expect(instanceData.obj).to.deep.equal(instance.obj);

                instanceData.obj.b = 125;

                expect(instanceData.obj.b).to.not.be.undefined;
                expect(instance.obj.b).to.be.undefined;
                expect(instanceData.obj).to.not.equal(instance.obj);
                expect(instanceData.obj).to.not.deep.equal(instance.obj);

                instance.obj.b = 245;

                expect(instanceData.obj.b).to.not.be.undefined;
                expect(instance.obj.b).to.not.be.undefined;
                expect(instanceData.obj).to.not.equal(instance.obj);
                expect(instanceData.obj).to.not.deep.equal(instance.obj);
            });
        });

        describe('with string[] seed', () => {
            let data: Array<string>, fields: Array<any>;

            beforeEach(() => {
                const keys = Object.keys(instanceData);

                data = keys.map(key => (instanceData as any)[key]);

                fields = keys.map((key: string, index: number) => {
                    return {name: key, oid: index, parser: parser};
                });
            });

            it('should instantiate model without errors', () => {
                expect(() => {
                    new TModel(data, fields);
                }).to.not.throw();
            });

            it('should contain correct field data', () => {
                const instance = new TModel(data, fields);

                Object.keys(instanceData).forEach(key => {
                    expect((instanceData as any)[key]).to.equal(instance[key]);
                });

                expect(instance.isMutable).to.to.be.false;
                expect(instance.isCreated).to.to.be.false;
                expect(instance.isDeleted).to.to.be.false;
            });
        });
    });

    describe('Model.infuse() method', () => {
        let instanceData: any;
        let instance: any;
        let rowData: any;
        let fields: any;

        beforeEach(() => {
            @dbModel(table, idGenerator)
            class TestModel extends Model {
                @dbField(Number)
                num!: number;

                @dbField(Object, {readonly: true})
                str!: string;
            }

            instanceData = {id: '1', createdOn: Date.now(), updatedOn: Date.now(), num: 123, str: 'str'};
            instance = new TestModel(instanceData);

            rowData = ['2', 123456, 789021, 345, '123'];

            fields = [
                {name: 'id',        oid: 1, parser: parser},
                {name: 'createdOn', oid: 2, parser: parser},
                {name: 'updatedOn', oid: 3, parser: parser},
                {name: 'num',       oid: 4, parser: parser},
                {name: 'str',       oid: 5, parser: parser}
            ];
        });

        it('should infuse model without errors', () => {
            expect(() => {
                instance.infuse(rowData, fields);
            }).to.not.throw();
        });

        it('should update all fields except readonly ones', () => {
            instance.infuse(rowData, fields);

            rowData.forEach((value: any, index: number) => {
                const key = fields[index].name;

                expect(instance[key]).to.equal(value);
            });
        });
    });

    describe('Model.applyChanges() method', () => {
        let instanceData: any, rowData: any, fields: any;
        let instance1: any;
        let instance2: any;

        beforeEach(() => {
            @dbModel(table, idGenerator)
            class TestModel extends Model {
                @dbField(Number)
                num!: number;

                @dbField(Object, {readonly: true})
                str!: string;
            }

            instanceData = {id: '1', createdOn: Date.now(), updatedOn: Date.now(), num: 123, str: 'str'};
            instance1 = new TestModel(instanceData);

            rowData = ['2', 123456, 789021, 345, '123'];

            fields = [
                {name: 'id',        oid: 1, parser: parser},
                {name: 'createdOn', oid: 2, parser: parser},
                {name: 'updatedOn', oid: 3, parser: parser},
                {name: 'num',       oid: 4, parser: parser},
                {name: 'str',       oid: 5, parser: parser}
            ];

            instance2 = new TestModel(rowData, fields);
        });

        it('should apply changes for model without errors', () => {
            expect(() => {
                instance1.applyChanges();
                instance2.applyChanges();
            }).to.not.throw();
        });

        it('should update model for not readonly field', () => { //todo
            expect(instance1.isModified).to.be.false;

            instance1.num = 12;

            expect(instance1.isModified).to.be.true;

            instance1.applyChanges();

            expect(instance1.isModified).to.be.false;
        });

        it('should update model for not readonly field', () => {
            expect(instance2.isModified).to.be.false;

            instance2.num = 12;

            expect(instance2.isModified).to.be.true;

            instance2.applyChanges();

            expect(instance2.isModified).to.be.false;
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

            const handler: any = {
                parse   : (value: string): string => value,
                clone   : (value: any): any => value,
                areEqual: (value1: any, value2: any): boolean => value1 !== value2
            };

            [Number, String, Boolean, Timestamp, Date].forEach(type => {
                let errorText: string;
                if (type === Date) {
                    errorText = 'Cannot specify custom handler for Date field';
                }
                else if (type === Timestamp) {
                    errorText = 'Cannot specify custom handler for Timestamp fields';
                }
                else {
                    errorText = 'Cannot specify custom handler for Number, String, or Boolean fields';
                }

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

        describe('Generation of Select SQL statements', () => {
            let TModel: any;

            const whereUndefinedErrorText = 'WHERE condition is undefined';

            const tests = [
                {selector: undefined, type: 'undefined', ErrorType: ModelError, error: whereUndefinedErrorText},
                {selector: null,      type: 'null',      ErrorType: ModelError, error: whereUndefinedErrorText},
                {selector: 0,         type: 0,           ErrorType: ModelError, error: whereUndefinedErrorText},
                {selector: 123,       type: '123',       ErrorType: TypeError,  error: 'Cannot build a fetch query: model selector is invalid'},
                {selector: ['test'],  type: 'String[]',  ErrorType: ModelError, error: 'Cannot build fetch query: model selector and schema are incompatible'},
            ];

            beforeEach(() => {
                @dbModel(table, idGenerator)
                class TestModel extends Model {
                    @dbField(String)
                    simple!: string;
                }

                TModel = TestModel;
            });

            tests.forEach((test: any) => {
                const {selector, type, error, ErrorType} = test;

                it(`should throw an error for qSelectAllModels() method when selector is ${type}`, () => {
                    expect(() => {
                        const query = new TModel.qSelectAllModels(true, selector);
                        query.text;
                    }).to.throw(ErrorType, error);
                });
            });

            tests.forEach((test: any) => {
                const {selector, type, error, ErrorType} = test;

                it(`should throw an error for qSelectOneModel() method when selector is ${type}`, () => {
                    expect(() => {
                        const query = new TModel.qSelectOneModel(true, selector);
                        query.text;
                    }).to.throw(ErrorType, error);
                });
            });
        });

        describe('Instantiating of model', () => {
            let TModel: any;

            beforeEach(() => {
                @dbModel(table, idGenerator)
                class TestModel extends Model {
                    @dbField(Number)
                    num!: number;
                }

                TModel = TestModel;
            });

            describe('with object seed', () => {
                describe('seed section', () => {
                    const invalidSeedErrorText = 'Model seed is invalid';

                    [
                        {seed: undefined,                                  ErrorType: TypeError,  error: invalidSeedErrorText},
                        {seed: null,                                       ErrorType: TypeError,  error: invalidSeedErrorText},
                        {seed: '',                                         ErrorType: TypeError,  error: invalidSeedErrorText},
                        {seed: 1234,                                       ErrorType: TypeError,  error: invalidSeedErrorText},

                        {seed: {},                                         ErrorType: ModelError, error: 'Model ID is invalid'},
                        {seed: {id: null},                                 ErrorType: ModelError, error: 'Model ID is invalid'},
                        {seed: {id: 0},                                    ErrorType: ModelError, error: 'Model ID is invalid'},
                        {seed: {id: 1},                                    ErrorType: ModelError, error: 'Model ID is invalid'},

                        {seed: {id: '1'},                                  ErrorType: ModelError, error: 'Model createdOn is invalid'},
                        {seed: {id: '1', createdOn: null},                 ErrorType: ModelError, error: 'Model createdOn is invalid'},

                        {seed: {id: '1', createdOn: 123},                  ErrorType: ModelError, error: 'Model updatedOn is invalid'},
                        {seed: {id: '1', createdOn: 123, updatedOn: null}, ErrorType: ModelError, error: 'Model updatedOn is invalid'},

                    ].forEach((test: any) => {
                        const {seed, error, ErrorType} = test;

                        it(`should throw an error for seed=${JSON.stringify(seed)}`, () => {
                            expect(() => {
                                new TModel(seed as any);
                            }).to.throw(ErrorType, error);
                        });
                    });
                });

                describe('clone section', () => {
                    [
                        '', 'test', 'true',
                        0, 123,
                        {}
                    ].forEach((cloneFlag: any) => {
                        it(`should throw an error for cloneFlag=${JSON.stringify(cloneFlag)}`, () => {
                            expect(() => {
                                new TModel({id: '1', createdOn: 1, updatedOn: 1, num: 3}, cloneFlag);
                            }).to.throw(TypeError, 'Clone flag is invalid');
                        });
                    });
                });
            });

            describe('with string[] seed', () => {
                
                describe('rowData section', () => {
                    [
                        {rowData: [],        error: 'Model row data is inconsistent'}
                    ].forEach((test: any) => {
                        const {rowData, error} = test;

                        it(`should throw an error for rowData=${JSON.stringify(rowData)}`, () => {
                            expect(() => {
                                new TModel(rowData, []);
                            }).to.throw(ModelError, error);
                        });
                    });
                });

                describe('fields section', () => {
                    const invalidFieldsErrorText = 'Model fields are invalid';
                    [
                        {fields: undefined, error: invalidFieldsErrorText},
                        {fields: null,      error: invalidFieldsErrorText},
                        {fields: '',        error: invalidFieldsErrorText},
                        {fields: true,      error: invalidFieldsErrorText},
                        {fields: {},        error: invalidFieldsErrorText},
                    ].forEach((test: any) => {
                        const {fields, error} = test;

                        it(`should throw an error for fields=${JSON.stringify(fields)}`, () => {
                            expect(() => {
                                new TModel(['1', Date.now(), Date.now(), 2], fields);
                            }).to.throw(TypeError, error);
                        });
                    });

                    [
                        {fields: [],        error: 'Model fields are inconsistent'},
                    ].forEach((test: any) => {
                        const {fields, error} = test;

                        it(`should throw an error for fields=${JSON.stringify(fields)}`, () => {
                            expect(() => {
                                new TModel(['1', Date.now(), Date.now(), 2], fields);
                            }).to.throw(ModelError, error);
                        });
                    });
                });
            });
        });

        describe('Model.applyChanges() method', () => {
            let instanceData: any, rowData: any, fields: any;
            let instance1: any;
            let instance2: any;

            beforeEach(() => {
                @dbModel(table, idGenerator)
                class TestModel extends Model {
                    @dbField(Object, {readonly: true})
                    str!: string;
                }

                instanceData = {id: '1', createdOn: Date.now(), updatedOn: Date.now(), str: 'str'};
                instance1 = new TestModel(instanceData);

                rowData = ['2', 123456, 789021, '123'];

                fields = [
                    {name: 'id',        oid: 1, parser: parser},
                    {name: 'createdOn', oid: 2, parser: parser},
                    {name: 'updatedOn', oid: 3, parser: parser},
                    {name: 'str',       oid: 4, parser: parser}
                ];

                instance2 = new TestModel(rowData, fields);
            });

            it('should return error for readonly field', () => {
                instance1.str = '1234';
                expect(() => instance1.applyChanges()).to.throw(Error, 'error text');
            });

            it('should return error for readonly field', () => {
                instance2.str = '1234';
                expect(() => instance2.applyChanges()).to.throw(Error, 'error text');
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

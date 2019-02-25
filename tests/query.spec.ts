import { expect } from 'chai';

import { Query } from '../index';

function extractId(row: any): string {
    return row.id;
}

extractId.toJSON = () => 'extractIdFn';

describe('NOVA.PG-DAO -> Query;', () => {
    describe('\'Query.from()\' method;', () => {
        const queryText1 = 'SELECT * FROM accounts WHERE id = 123';
        const queryText2 = 'SELECT * FROM accounts WHERE id = 321;';

        describe('should return correct query object for:', () => {
            [
                {text: queryText1, name: undefined, options: undefined},
                {text: queryText1, name: 'a',       options: {mask: 'list'}},
                {text: queryText2, name: 'ab',      options: {mask: 'single', mode: 'array'}},
                {text: queryText2, name: 'abc',     options: {mask: 'single', handler: {parse: extractId}}},
                {text: queryText2, name: 'a',       options: {mask: 'single', mode: 'object', handler: {parse: extractId}}},
                {text: queryText2, name: undefined, options: {mask: 'single', mode: 'object', handler: {parse: extractId}}}
            ].forEach(({text, name, options}) => {
                it(`name=${JSON.stringify(name)} and options=${JSON.stringify(options)}`, () => {
                    const query = Query.from(text, (name || options) as any, (name ? options : undefined) as any);

                    expect(query).to.not.be.undefined;

                    // text
                    expect(query.text).to.equal(text + (text === queryText1 ? ';\n' : '\n'));

                    // name
                    expect(query.name).to.equal(name ? name : 'unnamed query');

                    // mask
                    if (options) {
                        expect(query.mask).to.equal(options.mask);
                    } else {
                        expect(query.mask).to.be.undefined;
                    }

                    // mode
                    if (options) {
                        expect(query.mode).to.equal(options.mode || 'object');
                    } else {
                        expect(query.mode).to.be.undefined;
                    }

                    // handler
                    if (options && options.handler) {
                        expect(query.handler).to.equal(options.handler);
                    } else {
                        expect(query.handler).to.be.undefined;
                    }

                    // values
                    expect(query.values).to.be.undefined;
                });
            });
        });

        describe('should throw an error for:', () => {
            const queryText = 'SELECT * FROM accounts WHERE id = 123';

            const notStringQueryTextError = 'Query text must be a string';
            const queryMaskInvalid = (mask: any): string => `Query mask '${mask}' is invalid`;
            const queryModeInvalid = (mode: any): string => `Query mode '${mode}' is invalid`;
            const notValidHandlerError= 'Query handler is invalid';

            [
                // query text
                {query: undefined, name: 'a',  options: undefined, error: notStringQueryTextError},
                {query: null,      name: 'a',  options: undefined, error: notStringQueryTextError},
                {query: 153,       name: 'a',  options: undefined, error: notStringQueryTextError},
                {query: [],        name: 'a',  options: undefined, error: notStringQueryTextError},
                {query: {},        name: 'a',  options: undefined, error: notStringQueryTextError},
                {query: '',        name: 'a',  options: undefined, error: 'Query text cannot be an empty string'},

                // query name
                {query: queryText, name: '',  options: undefined, error: 'Query name must be a non-empty string'},
                {query: queryText, name: 125, options: undefined, error: 'Query name must be a string'},
                {query: queryText, name: [],  options: undefined, error: 'Query name must be a string'},

                // query mask
                {query: queryText, name: 'a', options: {},             error: queryMaskInvalid(undefined)},
                {query: queryText, name: 'a', options: {mask: 'test'}, error: queryMaskInvalid('test')},
                {query: queryText, name: 'a', options: {mask: null},   error: queryMaskInvalid(null)},
                {query: queryText, name: 'a', options: {mask: 123},    error: queryMaskInvalid(123)},
                {query: queryText, name: 'a', options: {mask: {}},     error: queryMaskInvalid('{}')},
                {query: queryText, name: 'a', options: {mask: []},     error: queryMaskInvalid('[]')},

                // query mode
                {query: queryText, name: 'a', options: {mask: 'list', mode: null},   error: queryModeInvalid(null)},
                {query: queryText, name: 'a', options: {mask: 'list', mode: 123},    error: queryModeInvalid(123)},
                {query: queryText, name: 'a', options: {mask: 'list', mode: {}},     error: queryModeInvalid('{}')},
                {query: queryText, name: 'a', options: {mask: 'list', mode: []},     error: queryModeInvalid('[]')},
                {query: queryText, name: 'a', options: {mask: 'list', mode: 'test'}, error: queryModeInvalid('test')},
                {query: queryText, name: 'a', options: {mask: 'list', mode: 'arr'},  error: queryModeInvalid('arr')},

                // query handler
                {query: queryText, name: 'a', options: {mask: 'list', mode: 'array', handler: true},          error: notValidHandlerError},
                {query: queryText, name: 'a', options: {mask: 'list', mode: 'array', handler: 123},           error: notValidHandlerError},
                {query: queryText, name: 'a', options: {mask: 'list', mode: 'array', handler: []},            error: notValidHandlerError},
                {query: queryText, name: 'a', options: {mask: 'list', mode: 'array', handler: {}},            error: notValidHandlerError},
                {query: queryText, name: 'a', options: {mask: 'list', mode: 'array', handler: {parse: true}}, error: notValidHandlerError},
                {query: queryText, name: 'a', options: {mask: 'list', mode: 'array', handler: {parse: null}}, error: notValidHandlerError},
                {query: queryText, name: 'a', options: {mask: 'list', mode: 'array', handler: {parse: []}},   error: notValidHandlerError},
            ].forEach(({query, name, options, error}) => {
                let title: string;

                if (!query || typeof query !== 'string') {
                    title = `query='${query}'`;
                } else if (!name || typeof name !== 'string') {
                    title = `name=${name}`
                } else {
                    title = `options='${JSON.stringify(options)}'`
                }

                it(title, () => {
                    expect(() => Query.from(query as string, name as any, options as any)).to.throw(TypeError, error);
                });
        });
        });
    });

    describe('\'Query.template\' method;', () => {
        describe('should return correct query object for:', () => {
            const queryTemplate = 'SELECT * FROM accounts WHERE id = {{id}}';
            const queryText     = 'SELECT * FROM accounts WHERE id = 1;\n';

            [
                {name: undefined, options: undefined},
                {name: 'a',       options: {mask: 'list'}},
                {name: 'ab',      options: {mask: 'single', mode: 'array'}},
                {name: 'abc',     options: {mask: 'single', handler: {parse: extractId}}},
                {name: 'a',       options: {mask: 'single', mode: 'object', handler: {parse: extractId}}},
                {name: undefined, options: {mask: 'single', mode: 'object', handler: {parse: extractId}}}
            ].forEach(({name, options}) => {
                it(`name=${JSON.stringify(name)} and options=${JSON.stringify(options)}`, () => {
                    const Template = Query.template(queryTemplate, (name || options) as any, (name ? options : undefined) as any);
                    const query = new Template({id: 1});

                    expect(query).to.not.be.undefined;

                    // text
                    expect(query.text).to.equal(queryText);

                    // name
                    expect(query.name).to.equal(name ? name : 'unnamed query');

                    // mask
                    if (options) {
                        expect(query.mask).to.equal(options.mask);
                    } else {
                        expect(query.mask).to.be.undefined;
                    }

                    // mode
                    if (options) {
                        expect(query.mode).to.equal(options.mode || 'object');
                    } else {
                        expect(query.mode).to.be.undefined;
                    }

                    // handler
                    if (options && options.handler) {
                        expect(query.handler).to.equal(options.handler);
                    } else {
                        expect(query.handler).to.be.undefined;
                    }

                    // values
                    expect(query.values).to.be.undefined;
                });
            });
        });

        describe('should return correct results for template:', () => {
            const date = new Date('2019-01-15');
            const buffer = Buffer.from('buffer', 'utf8');
            const arrFunc = () => 100;
            const vFunc = () => 100;

            function func () {return 100}

            vFunc.valueOf = () => 100;

            arrFunc.toJSON = () => '() => {}';
            vFunc.toJSON = () => 'func.valueOf()';
            func.toJSON = () => 'function() {}';

            const errorTextSection1 = 'Query parameter cannot be a function';
            const errorTextSection2 = (type: string): string => `Raw query parameter cannot be ${type} value`;
            const errorTextSection3 = 'Query parameter must be an array';
            const errorTextSection4 = 'Query parameter must be an array';

            [
                {
                    template: 'SELECT * FROM accounts WHERE id = {{id}}',
                    tests: [
                        {id: undefined,     result: 'SELECT * FROM accounts WHERE id = null;\n'},
                        {id: null,          result: 'SELECT * FROM accounts WHERE id = null;\n'},
                        {id: 0,             result: 'SELECT * FROM accounts WHERE id = 0;\n'},
                        {id: 124,           result: 'SELECT * FROM accounts WHERE id = 124;\n'},
                        {id: true,          result: 'SELECT * FROM accounts WHERE id = true;\n'},
                        {id: false,         result: 'SELECT * FROM accounts WHERE id = false;\n'},
                        {id: '124',         result: 'SELECT * FROM accounts WHERE id = \'124\';\n'},
                        {id: date,          result: `SELECT * FROM accounts WHERE id = '${date.toISOString()}';\n`},
                        {id: buffer,        result: `SELECT * FROM accounts WHERE id = '${buffer.toString('base64')}';\n`},
                        {id: [1,2,3,4],     result: 'SELECT * FROM accounts WHERE id = \'[1,2,3,4]\';\n'},
                        {id: {a: 1},        result: 'SELECT * FROM accounts WHERE id = \'{"a":1}\';\n'},
                        {id: vFunc,         result: `SELECT * FROM accounts WHERE id = ${vFunc.valueOf()};\n`},

                        {id: '12\'4',       result: 'SELECT * FROM accounts WHERE id = $1;\n', values: ['12\'4']},
                        {id: '12\\4',       result: 'SELECT * FROM accounts WHERE id = $1;\n', values: ['12\\4']},
                        {id: [12, '12\'4'], result: 'SELECT * FROM accounts WHERE id = $1;\n', values: [JSON.stringify([12, '12\'4'])]},
                        {id: {a: '12\'3'},  result: 'SELECT * FROM accounts WHERE id = $1;\n', values: [JSON.stringify({a: '12\'3'})]},

                        {id: arrFunc,       error: errorTextSection1},
                        {id: func,          error: errorTextSection1}
                    ]
                },
                {
                    template: 'SELECT * FROM accounts WHERE id = {{~id}}',
                    tests: [
                        {id: undefined,     result: 'SELECT * FROM accounts WHERE id = null;\n'},
                        {id: null,          result: 'SELECT * FROM accounts WHERE id = null;\n'},
                        {id: 0,             result: 'SELECT * FROM accounts WHERE id = 0;\n'},
                        {id: 124,           result: 'SELECT * FROM accounts WHERE id = 124;\n'},
                        {id: true,          result: 'SELECT * FROM accounts WHERE id = true;\n'},
                        {id: false,         result: 'SELECT * FROM accounts WHERE id = false;\n'},
                        {id: '124',         result: 'SELECT * FROM accounts WHERE id = 124;\n'},
                        {id: date,          result: `SELECT * FROM accounts WHERE id = ${date.valueOf()};\n`},
                        {id: vFunc,         result: `SELECT * FROM accounts WHERE id = ${vFunc.valueOf()};\n`},
                        {id: '12\'4',       result: 'SELECT * FROM accounts WHERE id = 12\'4;\n'},
                        {id: '12\\4',       result: 'SELECT * FROM accounts WHERE id = 12\\4;\n'},

                        {id: buffer,        error: errorTextSection2('buffer')},
                        {id: [1,2,3,4],     error: errorTextSection2('array')},
                        {id: {a: 1},        error: errorTextSection2('object')},
                        {id: arrFunc,       error: errorTextSection2('function')},
                        {id: func,          error: errorTextSection2('function')}
                    ]
                },
                {
                    template: 'SELECT * FROM accounts WHERE id IN ([[id]])',
                    tests: [
                        {id: undefined,     result: 'SELECT * FROM accounts WHERE id IN (null);\n'},
                        {id: null,          result: 'SELECT * FROM accounts WHERE id IN (null);\n'},
                        {id: [1,2,3,4],     result: 'SELECT * FROM accounts WHERE id IN (1,2,3,4);\n'},

                        {id: ['1','2\'4'],  result: 'SELECT * FROM accounts WHERE id IN (\'1\',$1);\n', values: ['2\'4']},
                        {id: ['1','2\\4'],  result: 'SELECT * FROM accounts WHERE id IN (\'1\',$1);\n', values: ['2\\4']},

                        {id: 0,             error: errorTextSection3},
                        {id: 124,           error: errorTextSection3},
                        {id: true,          error: errorTextSection3},
                        {id: false,         error: errorTextSection3},
                        {id: '124',         error: errorTextSection3},
                        {id: date,          error: errorTextSection3},
                        {id: buffer,        error: errorTextSection3},
                        {id: {a: 1},        error: errorTextSection3},
                        {id: vFunc,         error: errorTextSection3},
                        {id: '12\'4',       error: errorTextSection3},
                        {id: '12\\4',       error: errorTextSection3},
                        {id: [12, '12\'4'], error: 'Query parameter cannot be an array of mixed values'},
                        {id: {a: '12\'3'},  error: errorTextSection3},
                        {id: [{id: 1}],     error: 'Query parameter array cannot contain object values'},
                        {id: arrFunc,       error: errorTextSection3},
                        {id: func,          error: errorTextSection3}
                    ]
                },
                {
                    template: 'SELECT * FROM accounts WHERE id IN ([[~id]])',
                    tests: [
                        {id: undefined,     result: 'SELECT * FROM accounts WHERE id IN (null);\n'},
                        {id: null,          result: 'SELECT * FROM accounts WHERE id IN (null);\n'},
                        {id: [1,2,3,4],     result: 'SELECT * FROM accounts WHERE id IN (1,2,3,4);\n'},

                        {id: ['1','2\'4'],  result: 'SELECT * FROM accounts WHERE id IN (1,2\'4);\n'},
                        {id: ['1','2\\4'],  result: 'SELECT * FROM accounts WHERE id IN (1,2\\4);\n'},

                        {id: 0,             error: errorTextSection4},
                        {id: 124,           error: errorTextSection4},
                        {id: true,          error: errorTextSection4},
                        {id: false,         error: errorTextSection4},
                        {id: '124',         error: errorTextSection4},
                        {id: date,          error: errorTextSection4},
                        {id: buffer,        error: errorTextSection4},
                        {id: {a: 1},        error: errorTextSection4},
                        {id: vFunc,         error: errorTextSection4},
                        {id: '12\'4',       error: errorTextSection4},
                        {id: '12\\4',       error: errorTextSection4},
                        {id: [12, '12\'4'], error: 'Query parameter cannot be an array of mixed values'},
                        {id: {a: '12\'3'},  error: errorTextSection4},
                        {id: [{id: 1}],     error: 'Query parameter array cannot contain object values'},
                        {id: arrFunc,       error: errorTextSection4},
                        {id: func,          error: errorTextSection4}
                    ]
                }
            ].forEach(({template, tests}, index) => {
                describe(template, () => {
                    tests.forEach((test: any): void => {
                        const {id, result, values, error} = test;
                        const title = error
                            ? `should return error for params=${JSON.stringify({id})}`
                            : `should create template for params=${JSON.stringify({id})}`;

                        it(title, () => {
                            const Template = Query.template(template, 'test');

                            if (error) {
                                expect(() => new Template({id})).to.throw(Error, error);
                            } else {
                                const query = new Template({id});

                                expect(query.text).to.equal(result);

                                if (values) {
                                    expect(query.values).to.deep.equal(values);
                                } else {
                                    expect(query.values).to.be.undefined;
                                }
                            }
                        });
                    });
                });
            });
        });
    });
});

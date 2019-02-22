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
                {query: queryText, name: 'a', options: {mask: 'list', mode: 'array', handler: true}, error: notValidHandlerError},
                {query: queryText, name: 'a', options: {mask: 'list', mode: 'array', handler: 123},  error: notValidHandlerError},
                {query: queryText, name: 'a', options: {mask: 'list', mode: 'array', handler: []},   error: notValidHandlerError},

                {query: queryText, name: 'a', options: {mask: 'list', mode: 'array', handler: {}},            error: notValidHandlerError},
                {query: queryText, name: 'a', options: {mask: 'list', mode: 'array', handler: {parse: true}}, error: notValidHandlerError},
                {query: queryText, name: 'a', options: {mask: 'list', mode: 'array', handler: {parse: null}}, error: notValidHandlerError},
                {query: queryText, name: 'a', options: {mask: 'list', mode: 'array', handler: {parse: []}},   error: notValidHandlerError},
            ].forEach(({query, name, options, error}) => {
                it(`name=${JSON.stringify(name)} and options=${JSON.stringify(options)}`, () => {
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

        describe('should return correct query text  and values for:', () => {
            [
                {
                    template: 'SELECT * FROM accounts WHERE id = {{id}}',
                    tests: [
                        {
                            params: {id: 124},
                            result: 'SELECT * FROM accounts WHERE id = 124;\n'
                        },
                        {
                            params: {id: '124'},
                            result: 'SELECT * FROM accounts WHERE id = \'124\';\n'
                        },
                        {
                            params: {id: true},
                            result: 'SELECT * FROM accounts WHERE id = true;\n'
                        }
                    ]
                },
                // 'SELECT * FROM accounts WHERE id = {{~id}}',
                // 'SELECT * FROM accounts WHERE id IN ([[id]])',
                // 'SELECT * FROM accounts WHERE id IN ([[~id]])',
                // 'SELECT * FROM accounts WHERE id = {{id}} AND name = {{~id}} AND ids IN ([[id]]) AND names IN ([[~id]])'
            ].forEach(({template, tests}, index) => {
                describe(`template='${template}' and params`, () => {
                    tests.forEach(({params, result}) => {
                        it(JSON.stringify(params), () => {
                            const Template = Query.template(template, 'test');
                            const query = new Template(params);

                            expect(query.text).to.equal(result);
                            expect(query.values).to.be.undefined;
                        });
                    });
                });
            });
        });
    });
});

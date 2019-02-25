// IMPORTS
// ================================================================================================
import { expect } from 'chai';
import { Database } from './../index';
import { ListResultQuery, SingleResultQuery, SessionOptions } from '@nova/pg-dao';
import { Query } from '../index';
import { DaoSession } from '../lib/Session';
import { User, prepareDatabase } from './setup';
import { settings } from './settings';
import { MockLogger } from './mocks/Logger';

let db: Database;
let session: DaoSession;

const options: SessionOptions = {
    readonly: false,
    logQueryText: false
};

const logger = new MockLogger();

describe.only('NOVA.PG-DAO -> Session;', () => {
    describe('Query tests;', () => {

        beforeEach(async () => {
            db = new Database(settings);
            session = db.getSession(options, logger);

            await prepareDatabase(session);
        });

        afterEach(async () => {
            await session.close('commit');
        });

        describe('Object query tests;', () => {
            it('Object query should return a single object', async () => {
                const query: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'single',
                    name: 'getUserById'
                };

                const user = await session.execute(query);

                expect(user.id).to.equal(1);
                expect(user.username).to.equal('Irakliy');
                expect(user.tags[0]).to.equal('test');
                expect(user.tags[1]).to.equal('testing');
            });

            it('Object query should return undefined on no rows', async () => {
                const query: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 0;',
                    mask: 'single',
                    name: 'getUserById'
                };

                const user = await session.execute(query);

                expect(user).to.be.undefined;
            });

            it('Multiple object queries should produce a Map of objects', async () => { //todo rename
                const query1: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'single',
                    name: 'query1'
                };

                const query2: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 2;',
                    mask: 'single',
                    name: 'query2'
                };

                const [result1, result2] = await Promise.all([session.execute(query1), session.execute(query2)]);

                expect(result1.id).to.equal(1);
                expect(result1.username).to.equal('Irakliy');

                expect(result2.id).to.equal(2);
                expect(result2.username).to.equal('Yason');
            });

            it('Multiple object queries with the same name should produce a Map with a single key', async () => { //todo rename
                const query1: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'single',
                    name: 'getUserById'
                };

                const query2: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 2;',
                    mask: 'single',
                    name: 'getUserById'
                };

                const query3: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 3;',
                    mask: 'single',
                    name: 'getUserById'
                };

                const [result1, result2, result3] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3)]);

                expect(result1.id).to.equal(1);
                expect(result1.username).to.equal('Irakliy');

                expect(result2.id).to.equal(2);
                expect(result2.username).to.equal('Yason');

                expect(result3.id).to.equal(3);
                expect(result3.username).to.equal('George');
            });

            it('Unnamed object queries should aggregate into undefined key', async () => { //todo rename
                const query1: SingleResultQuery<User> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 1;',
                    mask: 'single'
                };

                const query2: SingleResultQuery<User> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 3;',
                    mask: 'single'
                };

                const query3: SingleResultQuery<User> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 3;',
                    mask: 'single',
                    name: 'test'
                };

                const [result1, result2, result3] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3)]);

                expect(result1.id).to.equal(1);
                expect(result1.username).to.equal('Irakliy');

                expect(result2.id).to.equal(3);
                expect(result2.username).to.equal('George');

                expect(result3.id).to.equal(3);
                expect(result3.username).to.equal('George');
            });

            it('Multiple object queries should not produce an array with holes', async () => { //todo rename
                const query1: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 1;',
                    mask: 'single',
                    name: 'getUserById'
                };

                const query2: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 0;',
                    mask: 'single',
                    name: 'getUserById'
                };

                const query3: SingleResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id = 3;',
                    mask: 'single',
                    name: 'getUserById'
                };

                const [result1, result2, result3] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3)]);

                expect(result1.id).to.equal(1);
                expect(result1.username).to.equal('Irakliy');

                expect(result2).to.be.undefined;

                expect(result3.id).to.equal(3);
                expect(result3.username).to.equal('George');
            });

            it('Object query with a handler should be parsed using custom parsing method', async () => {
                const query: SingleResultQuery<number> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 1;',
                    mask: 'single',
                    handler: {
                        parse: (row: any) => row.id
                    }
                };

                const userId = await session.execute(query);

                expect(userId).to.equal(1);
            });

            it('Multiple object queries with a handler should be parsed using custom parsing method', async () => {
                const query1: SingleResultQuery<number> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 1;',
                    mask: 'single',
                    handler: {
                        parse: (row: any) => row.id
                    }
                };

                const query2: SingleResultQuery<number> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id = 2;',
                    mask: 'single',
                    handler: {
                        parse: (row: any) => row.id
                    }
                };

                const [result1, result2] = await Promise.all([session.execute(query1), session.execute(query2)]);

                expect(result1).to.equal(1);
                expect(result2).to.equal(2);
            });
        });

        describe('List query tests;', () => {
            it('List query should return an array of objects', async () => {
                const query: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 3);',
                    mask: 'list'
                };

                const users = await session.execute(query);

                expect(users).to.have.length(2);

                expect(users[0].id).to.equal(1);
                expect(users[0].username).to.equal('Irakliy');

                expect(users[1].id).to.equal(3);
                expect(users[1].username).to.equal('George');
            });

            it('List query should return an empty array on no rows', async () => {
                const query: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (0);',
                    mask: 'list'
                };

                const users = await session.execute(query);

                expect(users).to.have.length(0);
            });

            it('Multiple list queries should produce a Map of arrays', async () => { //todo rename
                const query1: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 2);',
                    mask: 'list',
                    name: 'query1'
                };

                const query2: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (3);',
                    mask: 'list',
                    name: 'query2'
                };

                const [result1, result2] = await Promise.all([session.execute(query1), session.execute(query2)]);

                expect(result1).to.have.length(2);
                expect(result1[0].id).to.equal(1);
                expect(result1[1].id).to.equal(2);

                expect(result2).to.have.length(1);
                expect(result2[0].id).to.equal(3);
            });

            it('Multiple list queries with the same name should produce a Map with a single key', async () => { //todo rename
                const query1: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 2);',
                    mask: 'list',
                    name: 'query'
                };

                const query2: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (3);',
                    mask: 'list',
                    name: 'query'
                };

                const [result1, result2] = await Promise.all([session.execute(query1), session.execute(query2)]);

                expect(result1).to.have.length(2);
                expect(result1[0].id).to.equal(1);
                expect(result1[1].id).to.equal(2);

                expect(result2).to.have.length(1);
                expect(result2[0].id).to.equal(3);
            });

            it('Multiple list queries with the same name should produce an array for every query', async () => { //todo rename
                const query1: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 2);',
                    mask: 'list',
                    name: 'query'
                };

                const query2: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (0);',
                    mask: 'list',
                    name: 'query'
                };

                const query3: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (3);',
                    mask: 'list',
                    name: 'query'
                };

                const [result1, result2, result3] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3)]);

                expect(result1).to.have.length(2);
                expect(result2).to.have.length(0);
                expect(result3).to.have.length(1);
            });

            it('Unnamed list queries should aggregate into undefined key', async () => { //todo rename
                const query1: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (1, 2);',
                    mask: 'list'
                };

                const query2: ListResultQuery<User> = {
                    text: 'SELECT * FROM tmp_users WHERE id IN (3);',
                    mask: 'list'
                };

                const [result1, result2] = await Promise.all([session.execute(query1), session.execute(query2)]);

                expect(result1).to.have.length(2);
                expect(result2).to.have.length(1);
            });

            it('List query with a handler should be parsed using custom parsing method', async () => {
                const query: ListResultQuery<number> = {
                    text: 'SELECT id, username FROM tmp_users WHERE id IN (1,2);',
                    mask: 'list',
                    handler: {
                        parse: (row: any) => row.id
                    }
                };

                const userIds = await session.execute(query);

                expect(userIds).to.have.length(2);

                expect(userIds[0]).to.equal(1);
                expect(userIds[1]).to.equal(2);
            });
        });

        describe('Non-result query tests;', () => {
            it('A non-result query should produce no results', async () => {
                const query: Query = {
                    text: `UPDATE tmp_users SET username = 'irakliy' WHERE username = 'irakliy';`
                };

                const result = await session.execute(query);

                expect(result).to.be.undefined;
            });

            it('Multiple non-result queries should produce no results', async () => {
                const query: Query = {
                    text: `UPDATE tmp_users SET username = 'irakliy' WHERE username = 'irakliy';`
                };

                const [result1, result2] = await Promise.all([session.execute(query), session.execute(query)]);

                expect(result1).to.be.undefined;
                expect(result2).to.be.undefined;
            });
        });

        // describe('Mixed query tests;', function () {
        //
        //     it('Multiple mixed queries should produce a Map of results', () => {
        //         return new Database(settings).connect().then((session) => {
        //             return prepareDatabase(session).then(() => {
        //                 const query1: SingleResultQuery<User> = {
        //                     text: 'SELECT * FROM tmp_users WHERE id = 2;',
        //                     mask: 'single',
        //                     name: 'query1'
        //                 };
        //
        //                 const query2: ListResultQuery<User> = {
        //                     text: 'SELECT * FROM tmp_users WHERE id IN (1, 3);',
        //                     mask: 'list',
        //                     name: 'query2'
        //                 };
        //                 return session.execute([query1, query2]).then((results) => {
        //                     assert.strictEqual(results.size, 2);
        //
        //                     const user = results.get(query1.name);
        //                     assert.strictEqual(user.id, 2);
        //                     assert.strictEqual(user.username, 'Yason');
        //
        //                     const users = results.get(query2.name);
        //                     assert.strictEqual(users.length, 2);
        //                     assert.strictEqual(users[0].id, 1);
        //                     assert.strictEqual(users[0].username, 'Irakliy');
        //                     assert.strictEqual(users[1].id, 3);
        //                     assert.strictEqual(users[1].username, 'George');
        //                 });
        //             }).then(() => session.close());
        //         });
        //     });
        //
        //     it('Unnamed mixed queries should aggregate into undefined key', () => {
        //         return new Database(settings).connect().then((session) => {
        //             return prepareDatabase(session).then(() => {
        //                 const query1: SingleResultQuery<{ id: number, username: string }> = {
        //                     text: 'SELECT id, username FROM tmp_users WHERE id = 1;',
        //                     mask: 'single'
        //                 };
        //
        //                 const query2: ListResultQuery<{ id: number, username: string }> = {
        //                     text: 'SELECT id, username FROM tmp_users WHERE id IN (2, 3);',
        //                     mask: 'list'
        //                 };
        //
        //                 const query3: ListResultQuery<{ id: number, username: string }> = {
        //                     text: 'SELECT id, username FROM tmp_users WHERE id IN (2, 3);',
        //                     mask: 'list',
        //                     name: 'test'
        //                 };
        //
        //                 return session.execute([query1, query2, query3]).then((results) => {
        //                     assert.strictEqual(results.size, 2);
        //                     const result = results.get(undefined);
        //                     const user = result[0];
        //                     assert.strictEqual(user.id, 1);
        //                     assert.strictEqual(user.username, 'Irakliy');
        //
        //                     const users = result[1];
        //                     assert.strictEqual(users.length, 2);
        //                     assert.strictEqual(users[0].id, 2);
        //                     assert.strictEqual(users[0].username, 'Yason');
        //                     assert.strictEqual(users[1].id, 3);
        //                     assert.strictEqual(users[1].username, 'George');
        //                 });
        //             }).then(() => session.close());
        //         });
        //     });
        //
        //     it('Unnamed non-result queries should not produce holes in result array', () => {
        //         return new Database(settings).connect().then((session) => {
        //             return prepareDatabase(session).then(() => {
        //                 const query1: SingleResultQuery<{ id: number, username: string }> = {
        //                     text: 'SELECT id, username FROM tmp_users WHERE id = 1;',
        //                     mask: 'single'
        //                 };
        //
        //                 const query2: Query = {
        //                     text: `UPDATE tmp_users SET username = 'irakliy' WHERE username = 'irakliy';`
        //                 };
        //
        //                 const query3: ListResultQuery<{ id: number, username: string }> = {
        //                     text: 'SELECT id, username FROM tmp_users WHERE id IN (2, 3);',
        //                     mask: 'list'
        //                 };
        //
        //                 const query4: ListResultQuery<{ id: number, username: string }> = {
        //                     text: 'SELECT id, username FROM tmp_users WHERE id IN (2, 3);',
        //                     mask: 'list',
        //                     name: 'test'
        //                 };
        //
        //                 return session.execute([query1, query2, query3, query4]).then((results) => {
        //                     assert.strictEqual(results.size, 2);
        //                     const result = results.get(undefined);
        //                     const user = result[0];
        //                     assert.strictEqual(user.id, 1);
        //                     assert.strictEqual(user.username, 'Irakliy');
        //
        //                     const users = result[1];
        //                     assert.strictEqual(users.length, 2);
        //                     assert.strictEqual(users[0].id, 2);
        //                     assert.strictEqual(users[0].username, 'Yason');
        //                     assert.strictEqual(users[1].id, 3);
        //                     assert.strictEqual(users[1].username, 'George');
        //                 });
        //             }).then(() => session.close());
        //         });
        //     });
        // });
        //
        describe('Parametrized query tests;', () => {
            it('Object query parametrized with number should retrieve correct row', async () => {
                const Template = Query.template('SELECT * FROM tmp_users WHERE id = {{id}};', {mask: 'single'});
                const query = new Template({id: 2});

                const user = await session.execute(query);

                expect(user.id).to.equal(2);
                expect(user.username).to.equal('Yason');
            });

            it('Object query parametrized with string should retrieve correct row', async () => {
                const Template = Query.template('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query = new Template({username: 'Yason'});

                const user = await session.execute(query);

                expect(user.id).to.equal(2);
                expect(user.username).to.equal('Yason');
            });

            it('Object query parametrized with unsafe string should retrieve correct row', async () => {
                const Template = Query.template('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query = new Template({username: 'T\'est'});

                const user = await session.execute(query);

                expect(user.id).to.equal(4);
                expect(user.username).to.equal('T\'est');
            });

            //     it('Mix of parametrized and non-parametrized queries should return correct result map', () => {
            //         return new Database(settings).connect().then((session) => {
            //             return prepareDatabase(session).then(() => {
            //                 const query1: SingleResultQuery<User> = {
            //                     text: 'SELECT * FROM tmp_users WHERE id = 1;',
            //                     mask: 'single',
            //                     name: 'query1'
            //                 };
            //
            //                 const query2: SingleResultQuery<User> = {
            //                     text: 'SELECT * FROM tmp_users WHERE id = 2;',
            //                     mask: 'single',
            //                     name: 'query2'
            //                 };
            //
            //                 const query3: SingleResultQuery<User> = {
            //                     text: 'SELECT * FROM tmp_users WHERE username = {{username}};',
            //                     mask: 'single',
            //                     name: 'query3',
            //                     params: {
            //                         username: `T'est`
            //                     }
            //                 };
            //
            //                 const query4: SingleResultQuery<User> = {
            //                     text: 'SELECT * FROM tmp_users WHERE id = 3;',
            //                     mask: 'single',
            //                     name: 'query4'
            //                 };
            //
            //                 return session.execute([query1, query2, query3, query4]).then((results) => {
            //                     assert.strictEqual(results.size, 4);
            //
            //                     const user1 = results.get(query1.name);
            //                     assert.strictEqual(user1.id, 1);
            //                     assert.strictEqual(user1.username, 'Irakliy');
            //
            //                     const user2 = results.get(query2.name);
            //                     assert.strictEqual(user2.id, 2);
            //                     assert.strictEqual(user2.username, 'Yason');
            //
            //                     const user3 = results.get(query3.name);
            //                     assert.strictEqual(user3.id, 4);
            //                     assert.strictEqual(user3.username, `T'est`);
            //
            //                     const user4 = results.get(query4.name);
            //                     assert.strictEqual(user4.id, 3);
            //                     assert.strictEqual(user4.username, `George`);
            //                 });
            //             }).then(() => session.close());
            //         });
            //     });
            //
            //     it('Two parametrized queries in a row should produce correct result', () => {
            //         return new Database(settings).connect().then((session) => {
            //             return prepareDatabase(session).then(() => {
            //                 const query1: SingleResultQuery<User> = {
            //                     text: 'SELECT * FROM tmp_users WHERE id = 1;',
            //                     mask: 'single',
            //                     name: 'query1'
            //                 };
            //
            //                 const query2: SingleResultQuery<User> = {
            //                     text: 'SELECT * FROM tmp_users WHERE username = {{username}};',
            //                     mask: 'single',
            //                     name: 'query2',
            //                     params: {
            //                         username: `T'est`
            //                     }
            //                 };
            //
            //                 const query3: SingleResultQuery<User> = {
            //                     text: 'SELECT * FROM tmp_users WHERE id = {{id}};',
            //                     mask: 'single',
            //                     name: 'query3',
            //                     params: {
            //                         id: 2
            //                     }
            //                 };
            //
            //                 const query4: SingleResultQuery<User> = {
            //                     text: 'SELECT * FROM tmp_users WHERE id = 3;',
            //                     mask: 'single',
            //                     name: 'query4'
            //                 };
            //
            //                 return session.execute([query1, query2, query3, query4]).then((results) => {
            //                     assert.strictEqual(results.size, 4);
            //
            //                     const user1 = results.get(query1.name);
            //                     assert.strictEqual(user1.id, 1);
            //                     assert.strictEqual(user1.username, 'Irakliy');
            //
            //                     const user2 = results.get(query2.name);
            //                     assert.strictEqual(user2.id, 4);
            //                     assert.strictEqual(user2.username, `T'est`);
            //
            //                     const user3 = results.get(query3.name);
            //                     assert.strictEqual(user3.id, 2);
            //                     assert.strictEqual(user3.username, 'Yason');
            //
            //                     const user4 = results.get(query4.name);
            //                     assert.strictEqual(user4.id, 3);
            //                     assert.strictEqual(user4.username, `George`);
            //                 });
            //             }).then(() => session.close());
            //         });
            //     });
        });

        describe('Session lifecycle tests;', () => {
            it('Closing a session should return a connection back to the pool', () => {
                const database = new Database(settings);
                const poolState = database.getPoolState();

                expect(poolState.size).to.equal(0);
                expect(poolState.idle).to.equal(0);

                // return database.connect().then((session) => {
                //     return prepareDatabase(session).then(() => {
                //         assert.strictEqual(session.isActive, true);
                //         const poolState = database.getPoolState();
                //         assert.strictEqual(poolState.size, 1);
                //         assert.strictEqual(poolState.idle, 0);
                //
                //         return session.close().then(() => {
                //             assert.strictEqual(session.isActive, false);
                //             const poolState = database.getPoolState();
                //             assert.strictEqual(poolState.size, 1);
                //             assert.strictEqual(poolState.idle, 1);
                //         });
                //     });
                // });
            });

        //     it('Committing a transaction should update the data in the database', () => {
        //         const database = new Database(settings);
        //         return database.connect().then((session) => {
        //             return prepareDatabase(session).then(() => {
        //                 return session.startTransaction().then(() => {
        //                     const query: Query = {
        //                         text: 'UPDATE tmp_users SET username = $1 WHERE id = 1;',
        //                         values: ['Test']
        //                     };
        //
        //                     return session.execute(query).then(() => {
        //                         return session.close('commit').then(() => {
        //                             assert.strictEqual(session.isActive, false);
        //                             assert.strictEqual(session.inTransaction, false);
        //                         });
        //                     });
        //                 });
        //             });
        //         })
        //             .then(() => {
        //                 return database.connect().then((session) => {
        //                     const query: SingleResultQuery<User> = {
        //                         text: 'SELECT * FROM tmp_users WHERE id = 1;',
        //                         mask: 'single'
        //                     };
        //                     return session.execute(query).then((user) => {
        //                         assert.strictEqual(user.id, 1);
        //                         assert.strictEqual(user.username, 'Test');
        //                     }).then(() => session.close());
        //                 })
        //             });
        //     });
        //
        //     it('Rolling back a transaction should not change the data in the database', () => {
        //         const database = new Database(settings);
        //         return database.connect().then((session) => {
        //             return prepareDatabase(session).then(() => {
        //                 return session.startTransaction().then(() => {
        //                     const query: Query = {
        //                         text: 'UPDATE tmp_users SET username = {{un}} WHERE id = 1;',
        //                         params: {
        //                             un: 'Test'
        //                         }
        //                     };
        //
        //                     return session.execute(query).then(() => {
        //                         return session.close('rollback').then(() => {
        //                             assert.strictEqual(session.isActive, false);
        //                             assert.strictEqual(session.inTransaction, false);
        //                         });
        //                     });
        //                 });
        //             });
        //         })
        //             .then(() => {
        //                 return database.connect().then((session) => {
        //                     const query: SingleResultQuery<User> = {
        //                         text: 'SELECT * FROM tmp_users WHERE id = 1;',
        //                         mask: 'single'
        //                     };
        //
        //                     return session.execute(query).then((user) => {
        //                         assert.strictEqual(user.id, 1);
        //                         assert.strictEqual(user.username, 'Irakliy');
        //                     }).then(() => session.close());
        //                 })
        //             });
        //     });
        });
    });

    describe('Error condition tests;', () => {
        // it('Query execution error should close the session and release the connection back to the pool', async () => {
        //     const query = {
        //         text: undefined
        //     };
        //
        //
        //     const database = new Database(settings);
        //     return database.connect().then((session) => {
        //         return prepareDatabase(session).then(() => {
        //             const query = {
        //                 text: undefined
        //             };
        //
        //             return session.execute(query)
        //                 .then(() => {
        //                     assert.fail();
        //                 })
        //                 .catch((reason) => {
        //                     assert.ok(reason instanceof Error);
        //                     assert.ok(reason instanceof QueryError);
        //                     assert.strictEqual(session.isActive, false);
        //                     assert.strictEqual(database.getPoolState().size, 1);
        //                     assert.strictEqual(database.getPoolState().idle, 1);
        //                 });
        //         });
        //     });
        // });

    //     it('Query execution error should roll back an active transaction', () => {
    //         const database = new Database(settings);
    //         return database.connect().then((session) => {
    //             return prepareDatabase(session).then(() => {
    //                 return session.startTransaction().then(() => {
    //                     const query: Query = {
    //                         text: `UPDATE tmp_users SET username = 'Test' WHERE id = 1;`
    //                     };
    //
    //                     return session.execute(query).then(() => {
    //                         const errorQuery = {
    //                             text: undefined
    //                         };
    //
    //                         return session.execute(errorQuery).then(() => {
    //                             assert.fail();
    //                         }).catch((reason) => {
    //                             assert.ok(reason instanceof Error);
    //                             assert.ok(reason instanceof QueryError);
    //                             assert.strictEqual(session.isActive, false);
    //                             assert.strictEqual(database.getPoolState().size, 1);
    //                             assert.strictEqual(database.getPoolState().idle, 1);
    //                         });
    //                     });
    //                 });
    //             });
    //         })
    //             .then(() => {
    //                 return database.connect().then((session) => {
    //                     const query: SingleResultQuery<User> = {
    //                         text: 'SELECT * FROM tmp_users WHERE id = 1;',
    //                         mask: 'single'
    //                     };
    //
    //                     return session.execute(query).then((user) => {
    //                         assert.strictEqual(user.id, 1);
    //                         assert.strictEqual(user.username, 'Irakliy');
    //                     }).then(() => session.close());
    //                 })
    //             });
    //     });
    //
    //     it('Starting a transaction on a closed session should throw an error', () => {
    //         const database = new Database(settings);
    //         return database.connect().then((session) => {
    //             return session.close().then(() => {
    //                 return session.startTransaction()
    //                     .then(() => {
    //                         assert.fail();
    //                     })
    //                     .catch((reason) => {
    //                         assert.ok(reason instanceof Error);
    //                         assert.ok(reason instanceof ConnectionError);
    //                         assert.strictEqual(session.isActive, false);
    //                         assert.strictEqual(database.getPoolState().size, 1);
    //                         assert.strictEqual(database.getPoolState().idle, 1);
    //                     });
    //             });
    //         });
    //     });
    //
    //     it('Starting a transaction when a session is in transaction should throw an error', () => {
    //         const database = new Database(settings);
    //         return database.connect().then((session) => {
    //             return session.startTransaction().then(() => {
    //                 return session.startTransaction()
    //                     .then(() => {
    //                         assert.fail();
    //                     })
    //                     .catch((reason) => {
    //                         assert.ok(reason instanceof Error);
    //                         assert.ok(reason instanceof TransactionError);
    //                         assert.strictEqual(session.isActive, true);
    //                     });
    //             }).then(() => session.close('rollback'));
    //         });
    //     });
    //
    //     it('Closing an already closed session should throw an error', () => {
    //         const database = new Database(settings);
    //         return database.connect().then((session) => {
    //             return session.close().then(() => {
    //                 return session.close()
    //                     .then(() => {
    //                         assert.fail();
    //                     })
    //                     .catch((reason) => {
    //                         assert.ok(reason instanceof Error);
    //                         assert.ok(reason instanceof ConnectionError);
    //                         assert.strictEqual(session.isActive, false);
    //                     });
    //             });
    //         });
    //     });
    //
    //     it('Closing a session with an uncommitted transaction should throw an error', () => {
    //         const database = new Database(settings);
    //         return database.connect().then((session) => {
    //             return session.startTransaction().then(() => {
    //                 return session.close()
    //                     .then(() => {
    //                         assert.fail();
    //                     })
    //                     .catch((reason) => {
    //                         assert.ok(reason instanceof Error);
    //                         assert.ok(reason instanceof TransactionError);
    //                         assert.strictEqual(session.isActive, false);
    //                     });
    //             });
    //         });
    //     });
    //
    //     it('Executing a query on a closed session should throw an error', () => {
    //         const database = new Database(settings);
    //         return database.connect().then((session) => {
    //             return prepareDatabase(session).then(() => {
    //                 return session.close().then(() => {
    //                     const query: Query = {
    //                         text: undefined
    //                     };
    //
    //                     return session.execute(query)
    //                         .then(() => {
    //                             assert.fail();
    //                         })
    //                         .catch((reason) => {
    //                             assert.ok(reason instanceof Error);
    //                             assert.ok(reason instanceof ConnectionError);
    //                             assert.strictEqual(session.isActive, false);
    //                             assert.strictEqual(database.getPoolState().size, 1);
    //                             assert.strictEqual(database.getPoolState().idle, 1);
    //                         });
    //                 });
    //             });
    //         });
    //     });
    //
    //     it('Executing a query with no text should throw an error and close the session', () => {
    //         const database = new Database(settings);
    //         return database.connect().then((session) => {
    //             return prepareDatabase(session).then(() => {
    //                 const query: Query = {
    //                     text: undefined
    //                 };
    //
    //                 return session.execute(query)
    //                     .then(() => {
    //                         assert.fail();
    //                     })
    //                     .catch((reason) => {
    //                         assert.ok(reason instanceof Error);
    //                         assert.ok(reason instanceof QueryError);
    //                         assert.strictEqual(session.isActive, false);
    //                         assert.strictEqual(database.getPoolState().size, 1);
    //                         assert.strictEqual(database.getPoolState().idle, 1);
    //                     });
    //             });
    //         });
    //     });
    //
    //     it('Executing a query with invalid SQL should throw an error and close the session', () => {
    //         const database = new Database(settings);
    //         return database.connect().then((session) => {
    //             return prepareDatabase(session).then(() => {
    //                 const query: Query = {
    //                     text: 'SELLECT * FROM tmp_users;'
    //                 };
    //
    //                 return session.execute(query)
    //                     .then(() => {
    //                         assert.fail();
    //                     })
    //                     .catch((reason) => {
    //                         assert.ok(reason instanceof Error);
    //                         assert.ok(reason instanceof QueryError);
    //                         assert.strictEqual(session.isActive, false);
    //                         assert.strictEqual(database.getPoolState().size, 1);
    //                         assert.strictEqual(database.getPoolState().idle, 1);
    //                     });
    //             });
    //         });
    //     });
    //
    //     it('Executing a query with invalid result parser should throw an error and close the session', () => {
    //         const database = new Database(settings);
    //         return database.connect().then((session) => {
    //             return prepareDatabase(session).then(() => {
    //                 const query: ListResultQuery<User> = {
    //                     text: 'SELECT * FROM tmp_users WHERE id = 1;',
    //                     mask: 'list',
    //                     handler: {
    //                         parse: () => {
    //                             throw new Error('Parsing error')
    //                         }
    //                     }
    //                 };
    //
    //                 return session.execute(query)
    //                     .then(() => {
    //                         assert.fail();
    //                     })
    //                     .catch((reason) => {
    //                         assert.ok(reason instanceof Error);
    //                         assert.ok(reason instanceof ParseError);
    //                         assert.strictEqual(session.isActive, false);
    //                         assert.strictEqual(database.getPoolState().size, 1);
    //                         assert.strictEqual(database.getPoolState().idle, 1);
    //                     });
    //             });
    //         });
    //     });
    //
    //     it('Attempt to connect to a non-existing database should throw an error', () => {
    //         const settings1 = JSON.parse(JSON.stringify(settings));
    //         settings1.connection.database = 'invalid';
    //         const database = new Database(settings1);
    //         return database.connect()
    //             .catch((reason) => {
    //                 assert.ok(reason instanceof ConnectionError);
    //                 assert.ok(reason instanceof Error);
    //             });
    //     });
    //
    //     it('Executing two queries with errors should not crush the system', () => {
    //         const database = new Database(settings);
    //
    //         return database.connect({startTransaction: true}).then((session) => {
    //             return prepareDatabase(session).then(() => {
    //                 const query: ListResultQuery<User> = {
    //                     text: 'SELECT * FROM tmp_users WHERE id = abc;',
    //                     mask: 'list'
    //                 };
    //
    //                 session.execute(query).catch((error) => {
    //                     assert.strictEqual(error.message, 'column "abc" does not exist');
    //                 });
    //                 return session.execute(query).catch((error) => {
    //                     assert.strictEqual(error.message, 'current transaction is aborted, commands ignored until end of transaction block');
    //                 });
    //             });
    //         });
    //     });
    //
    //     it('Executing a query after committing a transaction should throw an error', () => {
    //         const database = new Database(settings);
    //
    //         return database.connect({startTransaction: true}).then((session) => {
    //             return prepareDatabase(session).then(() => {
    //                 const query: ListResultQuery<User> = {
    //                     text: 'SELECT * FROM tmp_users WHERE id = 1;',
    //                     mask: 'list'
    //                 };
    //
    //                 return session.execute(query).then(() => {
    //
    //                     return session.close('commit')
    //                         .then(() => session.execute(query))
    //                         .then(() => {
    //                             assert.fail('Error was not thrown');
    //                         })
    //                         .catch((error) => {
    //                             assert.strictEqual(error.message, 'Cannot execute queries: the session is closed');
    //                         });
    //                 });
    //             });
    //         });
    //     });
    //
    //     it('Executing a query after rolling back a transaction should throw an error', () => {
    //         const database = new Database(settings);
    //
    //         return database.connect({startTransaction: true}).then((session) => {
    //             return prepareDatabase(session).then(() => {
    //                 const query: ListResultQuery<User> = {
    //                     text: 'SELECT * FROM tmp_users WHERE id = 1;',
    //                     mask: 'list'
    //                 };
    //
    //                 return session.execute(query).then(() => {
    //
    //                     return session.close('rollback')
    //                         .then(() => session.execute(query))
    //                         .then(() => {
    //                             assert.fail('Error was not thrown');
    //                         })
    //                         .catch((error) => {
    //                             assert.strictEqual(error.message, 'Cannot execute queries: the session is closed');
    //                         });
    //                 });
    //             });
    //         });
        });
});

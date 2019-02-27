import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

const expect = chai.expect;

import { Database } from './../index';
import { SessionOptions, PoolState, QueryHandler } from '@nova/pg-dao';
import { Query } from '../index';
import { DaoSession } from '../lib/Session';
import { User, prepareDatabase } from './setup';
import { settings } from './settings';
import { MockLogger } from './mocks/Logger';

let db: Database;
let session: DaoSession;

const options: SessionOptions = {
    checkImmutable  : true,
    readonly        : false,
    logQueryText    : false
};

const logger = new MockLogger();

const idHandler: QueryHandler = {
    parse: (row: any) => Number(row[0])
};

describe('NOVA.PG-DAO -> Session;', () => {
    describe('Query tests;', () => {
        beforeEach(async () => {
            db = new Database(settings);
            session = db.getSession(options, logger);

            await prepareDatabase(session);
        });

        afterEach(async () => {
            await session.close('commit');
        });

        describe('Single query tests;', () => {
            it('Single query should return undefined on no rows', async () => {
                const query = Query.from('SELECT * FROM tmp_users WHERE id = 0;', 'getUserById', 'single');

                const user = await session.execute(query);

                expect(user).to.be.undefined;
            });

            it('Single object query should return a single object', async () => {
                const query = Query.from('SELECT * FROM tmp_users WHERE id = 1;', 'getUserById', 'single');

                const user = await session.execute(query);

                expect(user!.id).to.equal(1);
                expect(user!.username).to.equal('Irakliy');
                expect(user!.tags[0]).to.equal('test');
                expect(user!.tags[1]).to.equal('testing');
            });

            it('Single array query should return a single array', async () => {
                const query = Query.from('SELECT * FROM tmp_users WHERE id = 1;', { name: 'getUserById', mask: 'single', handler: Array });

                const user = await session.execute(query);

                expect(user![0]).to.equal(1);
                expect(user![1]).to.equal('Irakliy');
                expect(user![2][0]).to.equal('test');
                expect(user![2][1]).to.equal('testing');
            });

            it('Single query with a custom handler should be parsed using custom parsing method', async () => {
                const query = Query.from('SELECT id, username FROM tmp_users WHERE id = 1;', {mask: 'single', handler: idHandler});

                const userId = await session.execute(query);

                expect(userId).to.equal(1);
            });
        });

        describe('List query tests;', () => {
            it('List query should return an empty array on no rows', async () => {
                const query = Query.from('SELECT * FROM tmp_users WHERE id IN (0);','query', 'list');

                const users = await session.execute(query);

                expect(users).to.have.length(0);
            });

            it('List object query should return a list of objects', async () => {
                const query = Query.from('SELECT * FROM tmp_users WHERE id IN (1, 3);','query', 'list');

                const users = await session.execute(query);

                expect(users).to.have.length(2);

                expect(users[0].id).to.equal(1);
                expect(users[0].username).to.equal('Irakliy');

                expect(users[1].id).to.equal(3);
                expect(users[1].username).to.equal('George');
            });

            it('List array query should return a list of arrays', async () => {
                const query = Query.from('SELECT * FROM tmp_users WHERE id IN (1, 3);', { name: 'query', mask: 'list', handler: Array });

                const users = await session.execute(query);

                expect(users).to.have.length(2);

                expect(users[0][0]).to.equal(1);
                expect(users[0][1]).to.equal('Irakliy');

                expect(users[1][0]).to.equal(3);
                expect(users[1][1]).to.equal('George');
            });

            it('List query with a handler should be parsed using custom parsing method', async () => {
                const query = Query.from('SELECT * FROM tmp_users WHERE id IN (1,2);', {mask: 'list', handler: idHandler});

                const userIds = await session.execute(query);

                expect(userIds).to.have.length(2);

                expect(userIds[0]).to.equal(1);
                expect(userIds[1]).to.equal(2);
            });
        });

        describe('Non-result query tests;', () => {
            it('A non-result query should produce no results', async () => {
                const query = Query.from('UPDATE tmp_users SET username = \'irakliy\' WHERE username = \'irakliy\';');

                const result = await session.execute(query);

                expect(result).to.be.undefined;
            });

            it('Multiple non-result queries should produce no results', async () => {
                const query = Query.from('UPDATE tmp_users SET username = \'irakliy\' WHERE username = \'irakliy\';');

                const [result1, result2] = await Promise.all([session.execute(query), session.execute(query)]);

                expect(result1).to.be.undefined;
                expect(result2).to.be.undefined;
            });
        });

        describe('Parameterized query tests;', () => {
            it('Object query parameterized with number should retrieve correct row', async () => {
                const Template = Query.template('SELECT * FROM tmp_users WHERE id = {{id}};', {mask: 'single'});
                const query = new Template({id: 2});

                const user = await session.execute(query);

                expect(user.id).to.equal(2);
                expect(user.username).to.equal('Yason');
            });

            it('Single query parameterized with string should retrieve correct row', async () => {
                const Template = Query.template('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query = new Template({username: 'Yason'});

                const user = await session.execute(query);

                expect(user.id).to.equal(2);
                expect(user.username).to.equal('Yason');
            });

            it('Single query parameterized with unsafe string should retrieve correct row', async () => {
                const Template = Query.template('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query = new Template({username: 'T\'est'});

                const user = await session.execute(query);

                expect(user.id).to.equal(4);
                expect(user.username).to.equal('T\'est');
            });
        });

        describe('Mixed query tests;', () => {
            it('Three simple queries in a row (N-N-N) should produce correct results', async () => {
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id = 1;', 'getUserById', 'single');
                const query2 = Query.from('SELECT * FROM tmp_users WHERE id = 2;', 'getUserById', 'single');
                const query3 = Query.from('SELECT * FROM tmp_users WHERE id = 3;', 'getUserById', 'single');

                const [result1, result2, result3] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3)]);

                expect(result1!.id).to.equal(1);
                expect(result1!.username).to.equal('Irakliy');

                expect(result2!.id).to.equal(2);
                expect(result2!.username).to.equal('Yason');

                expect(result3!.id).to.equal(3);
                expect(result3!.username).to.equal('George');
            });

            it('Mix of parameterized and non-parameterized queries (N-P-P-N) should produce correct result', async () => {
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id = 1;','query1', 'single');

                const Template = Query.template<User>('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query2 = new Template({username: 'T\'est'});

                const query3 = new Template({username: 'T\'est2'});

                const query4 = Query.from('SELECT * FROM tmp_users WHERE id = 3;','query4', 'single');

                const [result1, result2, result3, result4] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3), session.execute(query4)]);

                expect(result1!.id).to.equal(1);
                expect(result2!.username).to.equal('T\'est');
                expect(result3).to.be.undefined;
                expect(result4!.id).to.equal(3);
            });

            it('Mix of parameterized and non-parameterized queries (N-N-P-N) should produce correct result', async () => {
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id = 1;','query1', 'single');
                const query2 = Query.from('SELECT * FROM tmp_users WHERE id = 2;','query2', 'single');

                const Template = Query.template<User>('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query3 = new Template({username: 'T\'est'});

                const query4 = Query.from('SELECT * FROM tmp_users WHERE id = 3;','query4', 'single');

                const [result1, result2, result3, result4] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3), session.execute(query4)]);

                expect(result1!.id).to.equal(1);
                expect(result2!.id).to.equal(2);
                expect(result3!.username).to.equal('T\'est');
                expect(result4!.id).to.equal(3);
            });

            it('Mix of parameterized and non-parameterized queries (P-N-N-N) should produce correct result', async () => {
                const Template = Query.template<User>('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query1 = new Template({username: 'T\'est'});

                const query2 = Query.from('SELECT * FROM tmp_users WHERE id = 1;','query1', 'single');
                const query3 = Query.from('SELECT * FROM tmp_users WHERE id = 2;','query2', 'single');
                const query4 = Query.from('SELECT * FROM tmp_users WHERE id = 3;','query4', 'single');

                const [result1, result2, result3, result4] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3), session.execute(query4)]);

                expect(result1!.username).to.equal('T\'est');
                expect(result2!.id).to.equal(1);
                expect(result3!.id).to.equal(2);
                expect(result4!.id).to.equal(3);
            });

            it('Mix of parameterized and non-parameterized queries (N-N-N-P) should produce correct result', async () => {
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id = 1;','query1', 'single');
                const query2 = Query.from('SELECT * FROM tmp_users WHERE id = 2;','query2', 'single');
                const query3 = Query.from('SELECT * FROM tmp_users WHERE id = 3;','query4', 'single');

                const Template = Query.template<User>('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query4 = new Template({username: 'T\'est'});

                const [result1, result2, result3, result4] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3), session.execute(query4)]);

                expect(result1!.id).to.equal(1);
                expect(result2!.id).to.equal(2);
                expect(result3!.id).to.equal(3);
                expect(result4!.username).to.equal('T\'est');
            });

            it('Mix of parameterized and non-parameterized queries (P-N-N-P) should produce correct result', async () => {
                const Template = Query.template<User>('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query1 = new Template({username: 'T\'est'});

                const query2 = Query.from('SELECT * FROM tmp_users WHERE id = 1;','query1', 'single');
                const query3 = Query.from('SELECT * FROM tmp_users WHERE id = 2;','query2', 'single');

                const query4 = new Template({username: 'T\'est'});

                const [result1, result2, result3, result4] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3), session.execute(query4)]);

                expect(result1!.username).to.equal('T\'est');
                expect(result2!.id).to.equal(1);
                expect(result3!.id).to.equal(2);
                expect(result4!.username).to.equal('T\'est');
            });
        });
    });

    describe('Session lifecycle tests;', () => {
        let poolState: PoolState;

        beforeEach(async () => {
            db = new Database(settings);
        });

        it('Closing a session should return a connection back to the pool', async () => {
            poolState = db.getPoolState();

            expect(poolState.size).to.equal(0);
            expect(poolState.idle).to.equal(0);

            session = db.getSession(options, logger);
            poolState = db.getPoolState();

            expect(poolState.size).to.equal(0);
            expect(poolState.idle).to.equal(0);

            await prepareDatabase(session);
            poolState = db.getPoolState();

            expect(poolState.size).to.equal(1);
            expect(poolState.idle).to.equal(0);

            await session.close('commit');
            poolState = db.getPoolState();

            expect(poolState.size).to.equal(1);
            expect(poolState.idle).to.equal(1);
        });

        it('Committing a transaction should update the data in the database', async () => {
            session = db.getSession(options, logger);

            await prepareDatabase(session);
            await session.close('commit');

            session = db.getSession(options, logger);

            const query1 = Query.from('UPDATE tmp_users SET username = \'Test\' WHERE id = 1;');

            await session.execute(query1);

            expect(session.isActive).to.be.true;
            expect(session.inTransaction).to.be.true;

            await session.close('commit');

            expect(session.isActive).to.be.false;
            expect(session.inTransaction).to.be.false;

            session = db.getSession(options, logger);

            const query2 = Query.from('SELECT * FROM tmp_users WHERE id = 1;', 'query', 'single');

            const result: any = await session.execute(query2);

            expect(result.id).to.equal(1);
            expect(result.username).to.equal('Test');

            await session.close('commit');
        });

        it('Rolling back a transaction should not change the data in the database', async () => {
            session = db.getSession(options, logger);

            await prepareDatabase(session);
            await session.close('commit');

            session = db.getSession(options, logger);

            const query1 = Query.from('UPDATE tmp_users SET username = \'Test\' WHERE id = 1;');

            await session.execute(query1);

            expect(session.isActive).to.be.true;
            expect(session.inTransaction).to.be.true;

            await session.close('rollback');

            expect(session.isActive).to.be.false;
            expect(session.inTransaction).to.be.false;

            session = db.getSession(options, logger);

            const query2 = Query.from('SELECT * FROM tmp_users WHERE id = 1;', 'query', 'single');

            const result: any = await session.execute(query2);

            expect(result.id).to.equal(1);
            expect(result.username).to.equal('Irakliy');

            await session.close('commit');
        });
    });

    describe('Error condition tests;', () => {
        beforeEach(async () => {
            db = new Database(settings);
            session = db.getSession(options, logger);

            await prepareDatabase(session);
        });

        afterEach(async () => {
            if ( session && session.isActive) {
                await session.close('rollback');
            }
        });

        it('Query execution error should close the session and release the connection back to the pool', async () => {
            const query: any = {
                text: undefined
            };

            await expect(session.execute(query)).to.eventually
                .be.rejectedWith(Error, 'Query text must be a string');

            expect(db.getPoolState().size).to.equal(1);
            expect(db.getPoolState().idle).to.equal(0);

            expect(session.isActive).to.to.be.true;
        });

        it('Closing an already closed session should throw an error', async () => {
            await session.close('commit');

            expect(session.isActive).to.be.false;

            await expect(session.close('commit')).to.eventually.be.rejectedWith(Error, 'Cannot close session: session has already been closed');
        });

        it('Executing a query after committing a transaction should throw an error', async () => {
            await session.close('commit');

            expect(session.isActive).to.be.false;

            const query = Query.from('DROP TABLE IF EXISTS tmp_users;');

            await expect(session.execute(query)).to.eventually.be.rejectedWith(Error, 'Cannot execute a query: session is closed');

            expect(db.getPoolState().size).to.equal(1);
            expect(db.getPoolState().idle).to.equal(1);
        });

        it('Executing a query after rolling back a transaction should throw an error', async () => {
            await session.close('rollback');

            expect(session.isActive).to.be.false;

            const query = Query.from('DROP TABLE IF EXISTS tmp_users;');

            await expect(session.execute(query)).to.eventually.be.rejectedWith(Error, 'Cannot execute a query: session is closed');

            expect(db.getPoolState().size).to.equal(1);
            expect(db.getPoolState().idle).to.equal(1);
        });

        it('Executing a query with invalid SQL should throw an error', async () => {
            const query = Query.from('SELLECT * FROM tmp_users;');

            await expect(session.execute(query)).to.eventually.be.rejectedWith(Error, 'syntax error at');

            expect(db.getPoolState().size).to.equal(1);
            expect(db.getPoolState().idle).to.equal(0);

            expect(session.isActive).to.to.be.true;
        });

        it('Executing a query with invalid result parser should throw an error', async () => {
            const query = Query.from('SELECT * FROM tmp_users WHERE id = 1;', 'error', {
                mask: 'list',
                handler: {
                    parse: () => {
                        throw new Error('Parsing error')
                    }
                }
            });

            await expect(session.execute(query)).to.eventually.be.rejectedWith(Error, 'Failed to parse results');

            expect(db.getPoolState().size).to.equal(1);
            expect(db.getPoolState().idle).to.equal(0);

            expect(session.isActive).to.to.be.true;
        });

        it('Attempt to connect to a non-existing database should throw an error', async () => {
            const settings1 = JSON.parse(JSON.stringify(settings));

            settings1.connection.database = 'invalid';
            settings1.connection.port = 1234;

            const database = new Database(settings1);
            const eSession = database.getSession(options, logger);

            const query = Query.from('DROP TABLE IF EXISTS tmp_users;');

            await expect(eSession.execute(query)).to.eventually.be.rejectedWith(Error, 'connect ECONNREFUSED');

            expect(db.getPoolState().size).to.equal(1);
            expect(db.getPoolState().idle).to.equal(0);

            expect(session.isActive).to.to.be.true;
        });
    });
});

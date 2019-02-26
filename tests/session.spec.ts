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
    readonly: false,
    logQueryText: false
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

        describe('Object query tests;', () => {
            it('Object query should return a single object', async () => {
                const query = Query.from('SELECT * FROM tmp_users WHERE id = 1;', 'getUserById', 'single');

                const user = await session.execute(query);

                expect(user!.id).to.equal(1);
                expect(user!.username).to.equal('Irakliy');
                expect(user!.tags[0]).to.equal('test');
                expect(user!.tags[1]).to.equal('testing');
            });

            it('Object query should return undefined on no rows', async () => {
                const query = Query.from('SELECT * FROM tmp_users WHERE id = 0;', 'getUserById', 'single');

                const user = await session.execute(query);

                expect(user).to.be.undefined;
            });

            it('Multiple object queries should produce a Map of objects', async () => { //todo rename
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id = 1;', 'query1', 'single');
                const query2 = Query.from('SELECT * FROM tmp_users WHERE id = 2;', 'query2', 'single');

                const [result1, result2] = await Promise.all([session.execute(query1), session.execute(query2)]);

                expect(result1!.id).to.equal(1);
                expect(result1!.username).to.equal('Irakliy');

                expect(result2!.id).to.equal(2);
                expect(result2!.username).to.equal('Yason');
            });

            it('Multiple object queries with the same name should produce a Map with a single key', async () => { //todo rename
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

            it('Unnamed object queries should aggregate into undefined key', async () => { //todo rename
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id = 1;', {mask: 'single'});
                const query2 = Query.from('SELECT * FROM tmp_users WHERE id = 3;', {mask: 'single'});
                const query3 = Query.from('SELECT * FROM tmp_users WHERE id = 3;', 'test', 'single');

                const [result1, result2, result3] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3)]);

                expect(result1!.id).to.equal(1);
                expect(result1!.username).to.equal('Irakliy');

                expect(result2!.id).to.equal(3);
                expect(result2!.username).to.equal('George');

                expect(result3!.id).to.equal(3);
                expect(result3!.username).to.equal('George');
            });

            it('Multiple object queries should not produce an array with holes', async () => { //todo rename
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id = 1;', 'getUserById', 'single');
                const query2 = Query.from('SELECT * FROM tmp_users WHERE id = 0;', 'getUserById', 'single');
                const query3 = Query.from('SELECT * FROM tmp_users WHERE id = 3;', 'getUserById', 'single');

                const [result1, result2, result3] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3)]);

                expect(result1!.id).to.equal(1);
                expect(result1!.username).to.equal('Irakliy');

                expect(result2).to.be.undefined;

                expect(result3!.id).to.equal(3);
                expect(result3!.username).to.equal('George');
            });

            it('Object query with a handler should be parsed using custom parsing method', async () => {
                const query = Query.from('SELECT id, username FROM tmp_users WHERE id = 1;', {mask: 'single', handler: idHandler});

                const userId = await session.execute(query);

                expect(userId).to.equal(1);
            });

            it('Multiple object queries with a handler should be parsed using custom parsing method', async () => {
                const query1 = Query.from('SELECT id, username FROM tmp_users WHERE id = 1;', {mask: 'single', handler: idHandler});
                const query2 = Query.from('SELECT id, username FROM tmp_users WHERE id = 2;', {mask: 'single', handler: idHandler});

                const [result1, result2] = await Promise.all([session.execute(query1), session.execute(query2)]);

                expect(result1).to.equal(1);
                expect(result2).to.equal(2);
            });
        });

        describe('List query tests;', () => {
            it('List query should return an array of objects', async () => {
                const query = Query.from('SELECT * FROM tmp_users WHERE id IN (1, 3);','query', 'list');

                const users = await session.execute(query);

                expect(users).to.have.length(2);

                expect(users[0].id).to.equal(1);
                expect(users[0].username).to.equal('Irakliy');

                expect(users[1].id).to.equal(3);
                expect(users[1].username).to.equal('George');
            });

            it('List query should return an empty array on no rows', async () => {
                const query = Query.from('SELECT * FROM tmp_users WHERE id IN (0);','query', 'list');

                const users = await session.execute(query);

                expect(users).to.have.length(0);
            });

            it('Multiple list queries should produce a Map of arrays', async () => { //todo rename
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id IN (1,2);','query1', 'list');
                const query2 = Query.from('SELECT * FROM tmp_users WHERE id IN (3);','query2', 'list');

                const [result1, result2] = await Promise.all([session.execute(query1), session.execute(query2)]);

                expect(result1).to.have.length(2);
                expect(result1[0].id).to.equal(1);
                expect(result1[1].id).to.equal(2);

                expect(result2).to.have.length(1);
                expect(result2[0].id).to.equal(3);
            });

            it('Multiple list queries with the same name should produce a Map with a single key', async () => { //todo rename
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id IN (1,2);','query', 'list');
                const query2 = Query.from('SELECT * FROM tmp_users WHERE id IN (3);','query', 'list');

                const [result1, result2] = await Promise.all([session.execute(query1), session.execute(query2)]);

                expect(result1).to.have.length(2);
                expect(result1[0].id).to.equal(1);
                expect(result1[1].id).to.equal(2);

                expect(result2).to.have.length(1);
                expect(result2[0].id).to.equal(3);
            });

            it('Multiple list queries with the same name should produce an array for every query', async () => { //todo rename
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id IN (1,2);','query', 'list');
                const query2 = Query.from('SELECT * FROM tmp_users WHERE id IN (0);','query', 'list');
                const query3 = Query.from('SELECT * FROM tmp_users WHERE id IN (3);','query', 'list');

                const [result1, result2, result3] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3)]);

                expect(result1).to.have.length(2);
                expect(result2).to.have.length(0);
                expect(result3).to.have.length(1);
            });

            it('Unnamed list queries should aggregate into undefined key', async () => { //todo rename
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id IN (1,2);', {mask: 'list'});
                const query2 = Query.from('SELECT * FROM tmp_users WHERE id IN (3);', {mask: 'list'});

                const [result1, result2] = await Promise.all([session.execute(query1), session.execute(query2)]);

                expect(result1).to.have.length(2);
                expect(result2).to.have.length(1);
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

        describe('Mixed query tests;', () => {
            it('Multiple mixed queries should produce a Map of results', async () => {
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id = 2;','query1', 'single');
                const query2 = Query.from('SELECT * FROM tmp_users WHERE id IN (1,3);','query2', 'list');

                const [result1, result2] = await Promise.all([session.execute(query1), session.execute(query2)]);

                expect(result1!.id).to.equal(2);

                expect(result2).to.have.length(2);
                expect(result2[0].id).to.equal(1);
                expect(result2[1].id).to.equal(3);
            });

            it('Unnamed mixed queries should aggregate into undefined key', async () => { // todo rename
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id = 1;', {mask: 'single'});
                const query2 = Query.from('SELECT * FROM tmp_users WHERE id IN (2,3);', {mask: 'list'});
                const query3 = Query.from('SELECT * FROM tmp_users WHERE id IN (2,3);','test', 'list');

                const [result1, result2, result3] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3)]);

                expect(result1!.id).to.equal(1);

                expect(result2).to.have.length(2);
                expect(result2[0].id).to.equal(2);
                expect(result2[1].id).to.equal(3);

                expect(result3).to.have.length(2);
                expect(result3[0].id).to.equal(2);
                expect(result3[1].id).to.equal(3);
            });

            it('Unnamed non-result queries should not produce holes in result array', async () => {
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id = 1;', {mask: 'single'});
                const query2 = Query.from('UPDATE tmp_users SET username = \'irakliy\' WHERE username = \'irakliy\';');
                const query3 = Query.from('SELECT id, username FROM tmp_users WHERE id IN (2, 3);', 'test', 'list');
                const query4 = Query.from('SELECT id, username FROM tmp_users WHERE id IN (2, 3);', 'test', 'list');

                const [result1, result2, result3, result4] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3), session.execute(query4)]);

                expect(result1!.id).to.equal(1);

                expect(result2).to.be.undefined;

                expect(result3).to.have.length(2);
                expect(result3[0].id).to.equal(2);
                expect(result3[1].id).to.equal(3);

                expect(result4).to.have.length(2);
                expect(result4[0].id).to.equal(2);
                expect(result4[1].id).to.equal(3);
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

            it('Object query parameterized with string should retrieve correct row', async () => {
                const Template = Query.template('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query = new Template({username: 'Yason'});

                const user = await session.execute(query);

                expect(user.id).to.equal(2);
                expect(user.username).to.equal('Yason');
            });

            it('Object query parameterized with unsafe string should retrieve correct row', async () => {
                const Template = Query.template('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query = new Template({username: 'T\'est'});

                const user = await session.execute(query);

                expect(user.id).to.equal(4);
                expect(user.username).to.equal('T\'est');
            });

            it('Mix of parameterized and non-parameterized queries should return correct result map', async () => {

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

            it('Two parametrized queries in a row should produce correct result', async () => {
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id = 1;','query1', 'single');

                const Template2 = Query.template<User>('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query2 = new Template2({username: 'T\'est'});

                const Template3 = Query.template<User>('SELECT * FROM tmp_users WHERE id = {{id}};', {mask: 'single'});
                const query3 = new Template3({id: 2});

                const query4 = Query.from('SELECT * FROM tmp_users WHERE id = 3;','query4', 'single');

                const [result1, result2, result3, result4] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3), session.execute(query4)]);

                expect(result1!.id).to.equal(1);
                expect(result2!.username).to.equal('T\'est');
                expect(result3!.id).to.equal(2);
                expect(result4!.id).to.equal(3);
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

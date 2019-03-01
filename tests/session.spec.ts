import * as chai from 'chai';
import * as sinon from 'sinon';
import * as chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

const expect = chai.expect;

import { Database, Model } from './../index';
import {
    SessionOptions,
    PoolState,
    QueryHandler,
    FieldHandler,
    Serializer,
    Parser,
    Comparator,
    Cloner
} from '@nova/pg-dao';
import { dbField, dbModel, PgIdGenerator, Query, Operators } from '../index';
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
    parse: (row: any[]): any => row[0]
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

                expect(user!.id).to.equal('1');
                expect(user!.username).to.equal('Irakliy');
                expect(user!.tags[0]).to.equal('test');
                expect(user!.tags[1]).to.equal('testing');
            });

            it('Single array query should return a single array', async () => {
                const query = Query.from('SELECT * FROM tmp_users WHERE id = 1;', { name: 'getUserById', mask: 'single', handler: Array });

                const user = await session.execute(query);

                expect(user![0]).to.equal('1');
                expect(user![1]).to.equal('Irakliy');
                expect(user![2][0]).to.equal('test');
                expect(user![2][1]).to.equal('testing');
            });

            it('Single query with a custom handler should be parsed using custom parsing method', async () => {
                const query = Query.from('SELECT id, username FROM tmp_users WHERE id = 1;', {mask: 'single', handler: idHandler});

                const userId = await session.execute(query);

                expect(userId).to.equal('1');
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

                expect(users[0].id).to.equal('1');
                expect(users[0].username).to.equal('Irakliy');

                expect(users[1].id).to.equal('3');
                expect(users[1].username).to.equal('George');
            });

            it('List array query should return a list of arrays', async () => {
                const query = Query.from('SELECT * FROM tmp_users WHERE id IN (1, 3);', { name: 'query', mask: 'list', handler: Array });

                const users = await session.execute(query);

                expect(users).to.have.length(2);

                expect(users[0][0]).to.equal('1');
                expect(users[0][1]).to.equal('Irakliy');

                expect(users[1][0]).to.equal('3');
                expect(users[1][1]).to.equal('George');
            });

            it('List query with a handler should be parsed using custom parsing method', async () => {
                const query = Query.from('SELECT * FROM tmp_users WHERE id IN (1,2);', {mask: 'list', handler: idHandler});

                const userIds = await session.execute(query);

                expect(userIds).to.have.length(2);

                expect(userIds[0]).to.equal('1');
                expect(userIds[1]).to.equal('2');
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

                expect(user.id).to.equal('2');
                expect(user.username).to.equal('Yason');
            });

            it('Single query parameterized with string should retrieve correct row', async () => {
                const Template = Query.template('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query = new Template({username: 'Yason'});

                const user = await session.execute(query);

                expect(user.id).to.equal('2');
                expect(user.username).to.equal('Yason');
            });

            it('Single query parameterized with unsafe string should retrieve correct row', async () => {
                const Template = Query.template('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query = new Template({username: 'T\'est'});

                const user = await session.execute(query);

                expect(user.id).to.equal('4');
                expect(user.username).to.equal('T\'est');
            });
        });

        describe('Mixed query tests;', () => {
            it('Three simple queries in a row (N-N-N) should produce correct results', async () => {
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id = 1;', 'getUserById', 'single');
                const query2 = Query.from('SELECT * FROM tmp_users WHERE id = 2;', 'getUserById', 'single');
                const query3 = Query.from('SELECT * FROM tmp_users WHERE id = 3;', 'getUserById', 'single');

                const [result1, result2, result3] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3)]);

                expect(result1!.id).to.equal('1');
                expect(result1!.username).to.equal('Irakliy');

                expect(result2!.id).to.equal('2');
                expect(result2!.username).to.equal('Yason');

                expect(result3!.id).to.equal('3');
                expect(result3!.username).to.equal('George');
            });

            it('Mix of parameterized and non-parameterized queries (N-P-P-N) should produce correct result', async () => {
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id = 1;','query1', 'single');

                const Template = Query.template<User>('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query2 = new Template({username: 'T\'est'});

                const query3 = new Template({username: 'T\'est2'});

                const query4 = Query.from('SELECT * FROM tmp_users WHERE id = 3;','query4', 'single');

                const [result1, result2, result3, result4] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3), session.execute(query4)]);

                expect(result1!.id).to.equal('1');
                expect(result2!.username).to.equal('T\'est');
                expect(result3).to.be.undefined;
                expect(result4!.id).to.equal('3');
            });

            it('Mix of parameterized and non-parameterized queries (N-N-P-N) should produce correct result', async () => {
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id = 1;','query1', 'single');
                const query2 = Query.from('SELECT * FROM tmp_users WHERE id = 2;','query2', 'single');

                const Template = Query.template<User>('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query3 = new Template({username: 'T\'est'});

                const query4 = Query.from('SELECT * FROM tmp_users WHERE id = 3;','query4', 'single');

                const [result1, result2, result3, result4] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3), session.execute(query4)]);

                expect(result1!.id).to.equal('1');
                expect(result2!.id).to.equal('2');
                expect(result3!.username).to.equal('T\'est');
                expect(result4!.id).to.equal('3');
            });

            it('Mix of parameterized and non-parameterized queries (P-N-N-N) should produce correct result', async () => {
                const Template = Query.template<User>('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query1 = new Template({username: 'T\'est'});

                const query2 = Query.from('SELECT * FROM tmp_users WHERE id = 1;','query1', 'single');
                const query3 = Query.from('SELECT * FROM tmp_users WHERE id = 2;','query2', 'single');
                const query4 = Query.from('SELECT * FROM tmp_users WHERE id = 3;','query4', 'single');

                const [result1, result2, result3, result4] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3), session.execute(query4)]);

                expect(result1!.username).to.equal('T\'est');
                expect(result2!.id).to.equal('1');
                expect(result3!.id).to.equal('2');
                expect(result4!.id).to.equal('3');
            });

            it('Mix of parameterized and non-parameterized queries (N-N-N-P) should produce correct result', async () => {
                const query1 = Query.from('SELECT * FROM tmp_users WHERE id = 1;','query1', 'single');
                const query2 = Query.from('SELECT * FROM tmp_users WHERE id = 2;','query2', 'single');
                const query3 = Query.from('SELECT * FROM tmp_users WHERE id = 3;','query4', 'single');

                const Template = Query.template<User>('SELECT * FROM tmp_users WHERE username = {{username}};', {mask: 'single'});
                const query4 = new Template({username: 'T\'est'});

                const [result1, result2, result3, result4] = await Promise.all([session.execute(query1), session.execute(query2), session.execute(query3), session.execute(query4)]);

                expect(result1!.id).to.equal('1');
                expect(result2!.id).to.equal('2');
                expect(result3!.id).to.equal('3');
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
                expect(result2!.id).to.equal('1');
                expect(result3!.id).to.equal('2');
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

            expect(result.id).to.equal('1');
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

            expect(result.id).to.equal('1');
            expect(result.username).to.equal('Irakliy');

            await session.close('commit');
        });
    });

    describe('fetch/get/create/delete/load methods tests;', () => {
        let UserModel: any;

        const table = 'tmp_users';
        const idGenerator = new PgIdGenerator(`${table}_id_seq`);

        beforeEach(async () => {
            db = new Database(settings);
            session = db.getSession(options, logger);

            await prepareDatabase(session);
            await session.close('commit');

            @dbModel(table, idGenerator)
            class UModel extends Model {
                @dbField(String)
                username!: string;

                @dbField(Array)
                tags!: string[];
            }

            UserModel = UModel;
        });

        afterEach(async () => {
            if (session && session.isActive) {
                await session.close('commit');
            }
        });

        describe('fetchOne() method', () => {
            beforeEach(() => {
                session = db.getSession(options, logger);
            });

            it('should be called without an error', async () => {
                await session.fetchOne(UserModel, {id: Operators.not(null)}, true);
            });

            it('should return all users for read-only session', async () => {
                const user = await session.fetchOne(UserModel, {id: 1}, false);

                expect(user).to.not.be.undefined;
                expect(user.id).to.equal('1');

                expect(user.isMutable()).to.be.false;
                expect(user.isCreated()).to.be.false;
                expect(user.isDeleted()).to.be.false;
                expect(user.isModified()).to.be.false;
            });

            it('should return all users for not read-only session', async () => {
                const user = await session.fetchOne(UserModel, {id: 1}, true);

                expect(user).to.not.be.undefined;
                expect(user.id).to.equal('1');

                expect(user.isMutable()).to.be.true;
                expect(user.isCreated()).to.be.false;
                expect(user.isDeleted()).to.be.false;
                expect(user.isModified()).to.be.false;
            });
        });

        describe('fetchAll() method', () => {
            beforeEach(() => {
                session = db.getSession(options, logger);
            });

            it('should be called without an error', async () => {
                await session.fetchAll(UserModel, {id: Operators.not(null)}, true);
            });

            it('should return all users for read-only session', async () => {
                const users = await session.fetchAll(UserModel, {id: Operators.not(null)}, false);

                expect(users).to.not.be.undefined;
                expect(users).to.have.length(4);

                users.forEach((user: any) => {
                    expect(user.isMutable()).to.be.false;
                    expect(user.isCreated()).to.be.false;
                    expect(user.isDeleted()).to.be.false;
                    expect(user.isModified()).to.be.false;
                });
            });

            it('should return all users for not read-only session', async () => {
                const users = await session.fetchAll(UserModel, {id: Operators.not(null)}, true);

                expect(users).to.not.be.undefined;
                expect(users).to.have.length(4);

                users.forEach((user: any) => {
                    expect(user.isMutable()).to.be.true;
                    expect(user.isCreated()).to.be.false;
                    expect(user.isDeleted()).to.be.false;
                    expect(user.isModified()).to.be.false;
                });
            });
        });

        describe('getOne() method', () => {
            beforeEach(() => {
                session = db.getSession(options, logger);
            });

            it('should be called without an error', async () => {
                session.getOne(UserModel, '1');
            });

            it('should return undefined if users is not loaded', async () => {
                const user = session.getOne(UserModel, '1');

                expect(user).to.be.undefined;
            });

            it('should return user when users is loaded by fetchAll() method', async () => {
                let user = session.getOne(UserModel, '1');

                expect(user).to.be.undefined;

                await session.fetchAll(UserModel, {id: Operators.not(null)});

                user = session.getOne(UserModel, '1');

                expect(user).to.not.be.undefined;
                expect(user.id).to.equal('1');

                expect(user.isMutable()).to.be.false;
                expect(user.isCreated()).to.be.false;
                expect(user.isDeleted()).to.be.false;
                expect(user.isModified()).to.be.false;
            });

            it('should return user when users is loaded by fetchOne() method', async () => {
                let user = session.getOne(UserModel, '1');

                expect(user).to.be.undefined;

                await session.fetchOne(UserModel, {id: 1});

                user = session.getOne(UserModel, '1');

                expect(user).to.not.be.undefined;
                expect(user.id).to.equal('1');

                expect(user.isMutable()).to.be.false;
                expect(user.isCreated()).to.be.false;
                expect(user.isDeleted()).to.be.false;
                expect(user.isModified()).to.be.false;
            });
        });

        describe('getAll() method', () => {
            beforeEach(() => {
                session = db.getSession(options, logger);
            });

            it('should be called without an error', async () => {
                session.getAll(UserModel);
            });

            it('should return undefined if users is not loaded', async () => {
                const users = session.getAll(UserModel);

                expect(users).to.be.empty;
                expect(users.size).to.equal(0);
            });

            it('should return user when users is loaded by fetchAll() method', async () => {
                let users = session.getAll(UserModel);

                expect(users).to.be.empty;
                expect(users.size).to.equal(0);

                await session.fetchAll(UserModel, {id: Operators.not(null)});

                users = session.getAll(UserModel);

                expect(users).to.not.be.empty;
                expect(users.size).to.equal(4);

                users.forEach((user: any) => {
                    expect(user.isMutable()).to.be.false;
                    expect(user.isCreated()).to.be.false;
                    expect(user.isDeleted()).to.be.false;
                    expect(user.isModified()).to.be.false;
                });
            });

            it('should return user when users is loaded by fetchOne() method', async () => {
                let users = session.getAll(UserModel);

                expect(users).to.be.empty;
                expect(users.size).to.equal(0);

                await session.fetchOne(UserModel, {id: '1'});

                users = session.getAll(UserModel);

                expect(users).to.not.be.empty;
                expect(users.size).to.equal(1);

                users.forEach((user: any) => {
                    expect(user.isMutable()).to.be.false;
                    expect(user.isCreated()).to.be.false;
                    expect(user.isDeleted()).to.be.false;
                    expect(user.isModified()).to.be.false;
                });
            });
        });

        describe('create() method', () => {
            beforeEach(() => {
                session = db.getSession(options, logger);
            });

            it('should be called without an error', async () => {
                await session.create(UserModel, {username: 'username', tags: [1,2]});
            });

            it('should return new model with correct fields', async () => {
                const user = await session.create(UserModel, {username: 'username', tags: [1,2]});

                expect(user).to.not.be.undefined;
                expect(user.id).to.equal('5');
                expect(user.username).to.equal('username');
                expect(user.tags).to.deep.equal([1,2]);

                expect(user.isMutable()).to.be.true;
                expect(user.isCreated()).to.be.true;
                expect(user.isDeleted()).to.be.false;
                expect(user.isModified()).to.be.false;
            });

            it('should create new record in db', async () => {
                const user = await session.create(UserModel, {username: 'username', tags: [1,2]});
                await session.close('commit');

                session = db.getSession(options, logger);

                const fetchedUser = await session.fetchOne(UserModel, { id: user.id });
                const fetchedUsers = await session.fetchAll(UserModel, 'id is not null');

                expect(fetchedUser).to.not.be.undefined;
                expect(fetchedUser.id).to.equal(user.id);
                expect(fetchedUser.username).to.equal(user.username);
                expect(fetchedUser.tags).to.deep.equal(user.tags);

                expect(fetchedUsers).have.length(5);
            });
        });

        describe('delete() method', () => {
            let user: any;

            beforeEach(async () => {
                session = db.getSession(options, logger);
                user = await await session.fetchOne(UserModel, {id: '1'}, true);
            });

            it('should be called without an error', async () => {
                session.delete(user);
            });

            it('should return new model with correct fields', async () => {
                const dUser = session.delete(user);

                expect(dUser).to.not.be.undefined;
                expect(dUser.id).to.equal('1');

                expect(dUser.isMutable()).to.be.true;
                expect(dUser.isCreated()).to.be.false;
                expect(dUser.isDeleted()).to.be.true;
                expect(dUser.isModified()).to.be.false;
            });

            it('should delete record from db', async () => {
                session.delete(user);
                await session.close('commit');

                session = db.getSession(options, logger);

                const fetchedUser = await session.fetchOne(UserModel, { id: user.id });
                const fetchedUsers = await session.fetchAll(UserModel, 'id is not null');

                expect(fetchedUser).to.be.undefined;
                expect(fetchedUsers).to.have.length(3);
            });
        });

        describe('load() method', () => {
            const seed = {id: '6', username: 'test', createdOn: Date.now(), updatedOn: Date.now(), tags: [1,2]};

            beforeEach(() => {
                session = db.getSession(options, logger);
            });

            it('should be called without an error', () => {
                session.load(UserModel, seed);
            });

            it('should return all users for read-only session', () => {
                const user = session.load(UserModel, seed);

                expect(user).to.not.be.undefined;
                expect(user.id).to.equal(seed.id);

                expect(user.isMutable()).to.be.false;
                expect(user.isCreated()).to.be.false;
                expect(user.isDeleted()).to.be.false;
                expect(user.isModified()).to.be.false;
            });

            it('should add model to session store', async () => {
                const user = session.load(UserModel, seed);

                const sUser = session.getOne(UserModel, seed.id);

                expect(sUser).to.not.be.undefined;
                expect(sUser).to.equal(user);
            });
        });
    });

    describe('flush/close methods tests;', () => {
        let UserModel: any;
        let created: any;
        let updated: any;
        let deleted: any;

        const table = 'tmp_users';
        const idGenerator = new PgIdGenerator(`${table}_id_seq`);

        beforeEach(async () => {
            db = new Database(settings);
            session = db.getSession(options, logger);

            await prepareDatabase(session);
            await session.close('commit');

            @dbModel(table, idGenerator)
            class UModel extends Model {
                @dbField(String)
                username!: string;

                @dbField(Array)
                tags!: string[];
            }

            UserModel = UModel;

            session = db.getSession(options, logger);

            const dUser = await session.fetchOne(UserModel, {id: '1'}, true);

            created = await session.create(UserModel, {username: 'username', tags: [1,2]});
            updated = await session.fetchOne(UserModel, {id: '2'}, true);
            deleted = session.delete(dUser);

            updated.username = 'updated';
        });

        afterEach(async () => {
            if (session && session.isActive) {
                await session.close('commit');
            }
        });

        describe('flush() method', () => {
            it('should be called without an error', async () => {
                await session.flush();
            });

            it('state of flushed models should be updated correctly', async () => {
                await session.flush();

                [created, updated].forEach((model: any) => {
                    expect(model.isMutable()).to.be.true;
                    expect(model.isCreated()).to.be.false;
                    expect(model.isDeleted()).to.be.false;
                    expect(model.isModified()).to.be.false;
                });

                expect(deleted.isMutable()).to.be.true;
                expect(deleted.isCreated()).to.be.false;
                expect(deleted.isDeleted()).to.be.true;
                expect(deleted.isModified()).to.be.false;
            });

            it('updatedOn field for updated model should be changed', async () => {
                const originUpdateOn = updated.updatedOn;

                await session.flush();

                expect(updated.updatedOn).to.not.equal(originUpdateOn);
            });

            it('db should be updated after flush() method', async () => {
                await session.flush();

                const cUser = await session.fetchOne(UserModel, {id: created.id});
                const uUser = await session.fetchOne(UserModel, {id: updated.id});
                const dUser = await session.fetchOne(UserModel, {id: deleted.id});

                expect(cUser).to.not.be.undefined;
                expect(cUser.id).to.equal(created.id);

                expect(uUser).to.not.be.undefined;
                expect(uUser.id).to.equal(updated.id);
                expect(uUser.username).to.equal('updated');

                expect(dUser).to.be.undefined;
            });
        });
    });

    describe('custom model handlers', () => {
        let UserModel: any;
        let parseSpy: any, serializeSpy: any, cloneSpy: any, equalSpy: any;
        let customHandler: FieldHandler;

        const table = 'tmp_users';
        const idGenerator = new PgIdGenerator(`${table}_id_seq`);

        const seed = {id: '1', createdOn: Date.now(), updatedOn: Date.now(), username: 'user', tags: ['1', '2']};

        beforeEach(async () => {
            db = new Database(settings);
            session = db.getSession(options, logger);

            await prepareDatabase(session);

            customHandler = {
                parse    : (value: string): string[] => JSON.parse(value).map((v: string): string => v + '_parsed'),
                serialize: (value: string[]): string => JSON.stringify(value),
                clone    : (value: string[]): string[] => value.map((v: string): string => v + '_cloned'),
                areEqual : (value1: string, value2: string): boolean => value1 !== value2
            };

            parseSpy = sinon.spy(customHandler, 'parse');
            serializeSpy = sinon.spy(customHandler, 'serialize');
            cloneSpy = sinon.spy(customHandler, 'clone');
            equalSpy = sinon.spy(customHandler, 'areEqual');

            @dbModel(table, idGenerator)
            class UModel extends Model {
                @dbField(String)
                username!: string;

                @dbField(Array, {handler: customHandler})
                tags!: string[];
            }

            UserModel = UModel;
        });

        afterEach(async () => {
            if (session && session.isActive) {
                await session.close('commit');
            }
        });

        describe('creating new model with clone=true', () => {
            beforeEach(() => {
                const user = new UserModel(seed, true);
            });

            it('should not call parse() method', () => {
                expect(parseSpy.called).to.be.false;
            });

            it('should call clone() method', () => {
                expect(cloneSpy.called).to.be.true;
                expect(cloneSpy.callCount).to.equal(1);
                expect(cloneSpy.firstCall.calledWithExactly(seed.tags)).to.be.true;
            });

            it('should not call serialize() method', () => {
                expect(serializeSpy.called).to.be.false;
            });

            it('should not call areEqual() method', () => {
                expect(equalSpy.called).to.be.false;
            });
        });

        describe('creating new model with clone=false', () => {
            beforeEach(() => {
                const user = new UserModel(seed, false);
            });

            it('should not call parse() method', () => {
                expect(parseSpy.called).to.be.false;
            });

            it('should not call clone() method', () => {
                expect(cloneSpy.called).to.be.false;
            });

            it('should not call serialize() method', () => {
                expect(serializeSpy.called).to.be.false;
            });

            it('should not call areEqual() method', () => {
                expect(equalSpy.called).to.be.false;
            });
        });

        describe('fetching model from db', () => {
            let user: any;

            beforeEach(async () => {
                user = await session.fetchOne(UserModel, {id: '1'});
            });

            it('should call parse() method', () => {
                expect(user.tags).to.deep.equal([ 'test_parsed', 'testing_parsed' ]);

                expect(parseSpy.called).to.be.true;
                expect(parseSpy.callCount).to.equal(1);
                expect(parseSpy.firstCall.calledWithExactly('["test", "testing"]')).to.be.true;
            });

            it('should call clone() method', () => {
                expect(cloneSpy.called).to.be.true;
                expect(cloneSpy.callCount).to.equal(1);
                expect(cloneSpy.firstCall.calledWithExactly(user.tags)).to.be.true;
            });

            it('should not call serialize() method', () => {
                expect(serializeSpy.called).to.be.false;
            });

            it('should not call areEqual() method', () => {
                expect(equalSpy.called).to.be.false;
            });
        });

        describe('creating new model and closing session', () => {
            let user: any;

            beforeEach(async () => {
                user = await session.create(UserModel, {username: seed.username, tags: seed.tags});

                await session.close('commit');
            });

            it('should not call parse() method', () => {
                expect(parseSpy.called).to.be.false;
            });

            it('should call clone() method', () => {
                expect(cloneSpy.called).to.be.true;
                expect(cloneSpy.callCount).to.equal(2);
                expect(cloneSpy.firstCall.calledWithExactly(seed.tags)).to.be.true;
                expect(cloneSpy.secondCall.calledWithExactly(user.tags)).to.be.true;
            });

            it('should call serialize() method', () => {
                expect(serializeSpy.called).to.be.true;
                expect(serializeSpy.callCount).to.equal(1);
                expect(serializeSpy.firstCall.calledWithExactly([ '1_cloned', '2_cloned' ])).to.be.true;
            });

            it('should not call areEqual() method', () => {
                expect(equalSpy.called).to.be.false;
            });
        });

        describe('fetching new model and closing session', () => {
            let user: any;

            beforeEach(async () => {
                user = await session.fetchOne(UserModel, {id: '1'});

                await session.close('commit');
            });

            it('should call parse() method', () => {
                expect(parseSpy.called).to.be.true;
                expect(parseSpy.callCount).to.equal(1);
            });

            it('should call clone() method', () => {
                expect(cloneSpy.called).to.be.true;
                expect(cloneSpy.callCount).to.equal(1);
            });

            it('should not call serialize() method', () => {
                expect(serializeSpy.called).to.be.false;
            });

            it('should not call areEqual() method', () => {
                expect(equalSpy.called).to.be.true;
                expect(equalSpy.callCount).to.equal(1);
            });
        });
    });

    describe('Error condition tests;', () => {
        beforeEach(async () => {
            db = new Database(settings);
            session = db.getSession(options, logger);

            await prepareDatabase(session);
        });

        // todo  uncomment after fixing
        // afterEach(async () => {
        //     if ( session && session.isActive) {
        //         await session.close('rollback');
        //     }
        // });

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

        describe('Trying to fetch for update/create/delete models in a read-only session should throw errors', async () => {
            let UserModel: any;

            const readOnlyOpts = {...options, readonly: true};

            beforeEach(async () => {
                session = db.getSession(readOnlyOpts, logger);

                @dbModel('tmp_users', new PgIdGenerator('tmp_users_id_seq'))
                class UModel extends Model {
                    @dbField(String)
                    username!: string;

                    @dbField(Array)
                    tags!: string[];
                }

                UserModel = UModel;
            });

            afterEach(async () => {
                if ( session && session.isActive) {
                    await session.close('commit');
                }
            });

            it('fetchOne() method for update', async () => {
                await expect(session.fetchOne(UserModel, {id: '1'}, true)).to.eventually.be.rejectedWith(Error, 'Cannot fetch mutable model: session is read-only');
            });

            it('fetchAll() method for update', async () => {
                await expect(session.fetchAll(UserModel, {id: '1'}, true)).to.eventually.be.rejectedWith(Error, 'Cannot fetch mutable models: session is read-only');
            });

            it('create() method', async () => {
                await expect(session.create(UserModel, {id: '1', tags:[1,3]})).to.eventually.be.rejectedWith(Error, 'Cannot create model: session is read-only');
            });

            it('delete() method', async () => {
                const user = new UserModel({id: '4', username: 'test', createdOn: 1, updatedOn: 2, tags: [1,2]});

                expect(() => session.delete(user)).to.throw(Error, 'Cannot delete model: session is read-only');
            });
        });

        describe('flush/close methods errors', async () => {
            let UserModel: any;

            const readOnlyOpts = {...options, readonly: true};

            beforeEach(async () => {
                @dbModel('tmp_users', new PgIdGenerator('tmp_users_id_seq'))
                class UModel extends Model {
                    @dbField(String)
                    username!: string;

                    @dbField(Array)
                    tags!: string[];
                }

                UserModel = UModel;
            });

            afterEach(async () => {
                if ( session && session.isActive) {
                    await session.close('commit');
                }
            });

            it('Trying to call flush() method in a read-only session should throw errors', async () => {
                session = db.getSession(readOnlyOpts, logger);

                expect(session.isActive).to.be.true;
                expect(session.isReadOnly).to.be.true;

                await expect(session.flush()).to.eventually.be.rejectedWith(Error, 'Cannot flush session: session is read-only');
            });

            it('Trying to call flush() method in closed session should throw errors', async () => {
                session = db.getSession(options, logger);
                await session.close('commit');

                expect(session.isActive).to.be.false;
                expect(session.isReadOnly).to.be.false;

                await expect(session.flush()).to.eventually.be.rejectedWith(Error, 'Cannot flush session: session has already been closed');
            });

            it('Closing an already closed session should throw an error', async () => {
                session = db.getSession(options, logger);
                await session.close('commit');

                expect(session.isActive).to.be.false;

                await expect(session.close('commit')).to.eventually.be.rejectedWith(Error, 'Cannot close session: session has already been closed');
            });

            it('Closing read-only session with dirty models should throw an error', async () => {
                session = db.getSession(options, logger);

                await prepareDatabase(session);
                await session.close('commit');

                session = db.getSession(readOnlyOpts, logger);

                expect(session.isReadOnly).to.be.true;

                const user = await session.fetchOne(UserModel, {id: '4'});

                expect(user).to.not.be.undefined;

                user.username = 'username';

                await expect(session.close('commit')).to.eventually.be.rejectedWith(Error, 'Error while closing session: Dirty models detected in read-only session');
            });

            describe('Closing session with invalid action should throw an error', () => {
                beforeEach(async () => {
                    session = db.getSession(options, logger);
                });

                afterEach(async () => {
                    if ( session && session.isActive) {
                        await session.close('commit');
                    }
                });

                [
                    undefined, null, false, 0, '',
                    123, 'commmmit', 'rollingback', 'roll back',
                    ['commit']
                ].forEach((action: any) => {
                    it(`for action=${JSON.stringify(action)}`, async () => {
                        await expect(session.close(action)).to.eventually.be.rejectedWith(Error, `Cannot close session: '${action}' action is invalid`);
                    });
                });
            });
        });

        describe.only('custom model handlers errors', () => {
            let customHandler: FieldHandler;
            let UserModel: any;

            const table = 'tmp_users';
            const idGenerator = new PgIdGenerator(`${table}_id_seq`);
            const errorText = 'parse error';

            beforeEach(async () => {
                await session.close('commit');

                customHandler = {
                    parse    : (value: string): string[] => JSON.parse(value),
                    serialize: (value: string[]): string => JSON.stringify(value),
                    clone    : (value: string[]): string[] => value,
                    areEqual : (value1: string, value2: string): boolean => value1 !== value2
                };

                session = db.getSession(options, logger);
            });

            describe('when parse() handler throw error', () => {
                beforeEach(() => {
                    customHandler.parse = (value: string): string[] => {throw new Error(errorText);};

                    @dbModel(table, idGenerator)
                    class UModel extends Model {
                        @dbField(String)
                        username!: string;

                        @dbField(Array, {handler: customHandler})
                        tags!: string[];
                    }

                    UserModel = UModel;
                });

                it('should call parse() method', async () => {
                    expect(session.isActive).to.be.true;

                    await expect(session.fetchOne(UserModel, {id: '1'})).to.eventually.be.rejectedWith(Error, errorText);

                    expect(session.isActive).to.be.true;
                });
            });

            describe('when serialize() handler throw error', () => {
                beforeEach(() => {
                    customHandler.serialize = (value: string[]): string => {throw new Error(errorText);};

                    @dbModel(table, idGenerator)
                    class UModel extends Model {
                        @dbField(String)
                        username!: string;

                        @dbField(Array, {handler: customHandler})
                        tags!: string[];
                    }

                    UserModel = UModel;
                });

                it('should call serialize() method', async () => {
                    expect(session.isActive).to.be.true;

                    await session.create(UserModel, {username: 'username', tags: ['1', '2']});

                    await expect(session.close('commit')).to.eventually.be.rejectedWith(Error, errorText);

                    expect(session.isActive).to.be.true;
                });
            });

            describe('when clone() handler throw error', () => {
                beforeEach(() => {
                    customHandler.clone = (value: string[]): string[] => {throw new Error(errorText);};

                    @dbModel(table, idGenerator)
                    class UModel extends Model {
                        @dbField(String)
                        username!: string;

                        @dbField(Array, {handler: customHandler})
                        tags!: string[];
                    }

                    UserModel = UModel;
                });

                it('should call close() method', async () => {
                    expect(session.isActive).to.be.true;

                    await expect(session.fetchOne(UserModel, {id: '1'})).to.eventually.be.rejectedWith(Error, errorText);

                    expect(session.isActive).to.be.true;
                });
            });

            describe('when areEqual() handler throw error', () => {
                beforeEach(() => {
                    customHandler.areEqual = (value1: string, value2: string): boolean => {throw new Error(errorText);};

                    @dbModel(table, idGenerator)
                    class UModel extends Model {
                        @dbField(String)
                        username!: string;

                        @dbField(Array, {handler: customHandler})
                        tags!: string[];
                    }

                    UserModel = UModel;
                });

                it('should call areEqual() method', async () => {
                    expect(session.isActive).to.be.true;

                    await session.fetchOne(UserModel, {id: '1'});

                    await expect(session.close('commit')).to.eventually.be.rejectedWith(Error, errorText);

                    expect(session.isActive).to.be.true;
                });
            });
            // flush
            // parse -> from db
            // clone -> from db -> constructor of model
            // areEqual -> isModified() || close()
            // serialize -> to db (update/ create)

            // after error
            // expect(session.isActive).to.to.be.true;
            // query execute without error

            // close -> rollback
            // expect(session.isActive).to.to.be.false;
        });
    });
});

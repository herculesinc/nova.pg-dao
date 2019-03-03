// IMPORTS
// ================================================================================================
import { DaoSession, ListResultQuery, SingleResultQuery } from '@nova/pg-dao';

// INTERFACES
// ================================================================================================
export interface User {
    id          : number;
    username    : string;
    tags        : string[],
    createdOn   : Date;
    updatedOn   : Date;
}

// QUERIES
// ================================================================================================
export class qFetchUserById implements SingleResultQuery<User> {
    text: string;
    mask: 'single' = 'single';
    handler = Object;

    constructor(userId: number) {
        this.text = `
            SELECT id, username, created_on AS "createdOn", updated_on AS "updatedOn"
            FROM tmp_users WHERE id = ${userId};`;
    }

    get name(): string { return (<any> this).constructor.name; }
}

export class qFetchRawUserById implements SingleResultQuery<any[]> {
    text: string;
    mask: 'single' = 'single';
    handler = Array;

    constructor(userId: number) {
        this.text = `
            SELECT id, username, created_on AS "createdOn", updated_on AS "updatedOn"
            FROM tmp_users WHERE id = ${userId};`;
    }
}

export class qFetchUsersByIdList implements ListResultQuery<User> {
    text: string;
    mask: 'list' = 'list';
    handler = Object;

    constructor(userIdList: number[]) {
        this.text = `
            SELECT id, username, created_on AS "createdOn", updated_on AS "updatedOn"
            FROM tmp_users WHERE id in (${userIdList.join(',') })
            ORDER BY id;`;
    }

    get name(): string { return (<any> this).constructor.name; }
}

export async function prepareDatabase(conn: DaoSession): Promise<any> {
    await conn.execute({
        name: 'dropTable',
        text: `DROP TABLE IF EXISTS tmp_users;`
    });
    await conn.execute({
        name: 'dropSequence',
        text: `DROP SEQUENCE IF EXISTS tmp_users_id_seq;`
    });
    await conn.execute({
        name: 'createSequence',
        text: `CREATE TEMPORARY SEQUENCE tmp_users_id_seq START 5;`
    });
    await conn.execute({
        name: 'insertUsers',
        text: `SELECT * INTO TEMPORARY tmp_users
            FROM (VALUES 
                (1::bigint, 'Irakliy'::text, '["test","testing"]'::jsonb,   extract(epoch from now())::bigint, extract(epoch from now())::bigint),
                (2::bigint, 'Yason'::text,   '["test1","testing1"]'::jsonb, extract(epoch from now())::bigint, extract(epoch from now())::bigint),
                (3::bigint, 'George'::text,  '["test2","testing2"]'::jsonb, extract(epoch from now())::bigint, extract(epoch from now())::bigint),
                (4::bigint, 'T''est'::text,  '["test3","testing3"]'::jsonb, extract(epoch from now())::bigint, extract(epoch from now())::bigint)
            ) AS q (id, username, tags, created_on, updated_on);`
    });
}

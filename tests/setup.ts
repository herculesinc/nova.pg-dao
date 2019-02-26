// IMPORTS
// ================================================================================================
import { ListResultQuery, SingleResultQuery } from '@nova/pg-dao';
import { DaoSession } from '../lib/Session';

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
        name: 'insertUsers',
        text: `SELECT * INTO TEMPORARY tmp_users
            FROM (VALUES 
                (1::int, 'Irakliy'::VARCHAR, '["test","testing"]'::jsonb,   now()::timestamptz, now()::timestamptz),
                (2::int, 'Yason'::VARCHAR, 	 '["test1","testing1"]'::jsonb, now()::timestamptz, now()::timestamptz),
                (3::int, 'George'::VARCHAR,  '["test2","testing2"]'::jsonb, now()::timestamptz, now()::timestamptz),
                (4::int, 'T''est'::VARCHAR,  '["test3","testing3"]'::jsonb, now()::timestamptz, now()::timestamptz)
            ) AS q (id, username, tags, created_on, updated_on);`
    });
}

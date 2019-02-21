// IMPORTS
// ================================================================================================
import { Database, Query } from '../index';
import { ListResultQueryOptions, SingleResultQueryOptions } from '@nova/pg-dao';

// MODULE VARIABLES
// ================================================================================================
const queryText = 'SELECT * FROM accounts WHERE id = 123';
const paramQueryText1 = 'SELECT * FROM accounts WHERE id = {{id}}';
const paramQueryText2 = 'SELECT * FROM accounts WHERE id = {{~id}}';
const paramQueryText3 = 'SELECT * FROM accounts WHERE id IN ([[id]])';
const paramQueryText4 = 'SELECT * FROM accounts WHERE id IN ([[~id]])';

const listQueryOptions: ListResultQueryOptions<string> = {
    mask    : 'list',
    handler: {
        parse   : extractId
    }
};

const singleQueryOptions: SingleResultQueryOptions<string> = {
    mask    : 'single',
    handler: {
        parse   : extractId
    }
};

function extractId(row: any): string {
    return row.id;
}

// QUERY TESTS
// ================================================================================================
(function queryTests() {

    const query1 = Query.from(queryText);
    console.log(JSON.stringify(query1));

    const query2 = Query.from(queryText, 'query2');
    console.log(JSON.stringify(query2));

    const query3 = Query.from(queryText, 'query3', listQueryOptions);
    console.log(JSON.stringify(query3));

    const query4 = Query.from(queryText, 'query4', singleQueryOptions);
    console.log(JSON.stringify(query4));

    const template1 = Query.template(paramQueryText1, 'template1', singleQueryOptions);
    const query5 = new template1({ id: "123" });
    console.log(JSON.stringify(query5));

    const query5a = new template1({ id: ["123", "456"] });
    console.log(JSON.stringify(query5a));

    const template2 = Query.template(paramQueryText2, 'template2', singleQueryOptions);
    const query6 = new template2({ id: "123" });
    console.log(JSON.stringify(query6));

    const template3 = Query.template(paramQueryText3, 'template3', listQueryOptions);
    const query7 = new template3({ id: ["123", "456"] });
    console.log(JSON.stringify(query7));

    const template4 = Query.template(paramQueryText4, 'template4', listQueryOptions);
    const query8 = new template4({ id: ["123", "456"] });
    console.log(JSON.stringify(query8));
})();

// DATABASE TESTS
// ================================================================================================
const database = new Database({
    connection: {
        database    : "",
        host        : "",
        port        : 5432,
        ssl         : true,
        user        : "",
        password    : ""
    }
});

(async function dbTests() {

    const session = database.getSession();

    const query1 = Query.from('SELECT id FROM tokens LIMIT 5;', { mask: 'list' })
    const result1 = await session.execute(query1);
    console.log(JSON.stringify(result1));

    const template1 = Query.template('SELECT id, status, handle FROM accounts WHERE profile = {{profile}} LIMIT 5', { mask: 'list' });
    const query2 = new template1({ profile: `test's` });
    const result2 = await session.execute(query2);
    console.log(JSON.stringify(result2));

    await session.close('commit');
});

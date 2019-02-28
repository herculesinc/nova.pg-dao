// IMPORTS
// ================================================================================================
import { Database, Query } from '../index';
import { ListResultQueryOptions, SingleResultQueryOptions, ResultHandler, FieldHandler } from '@nova/pg-dao';
import { Model } from '../lib/Model';
import { dbModel, dbField, PgIdGenerator, GuidGenerator, Operators as Op } from '../lib/schema';

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

const IdHandler: ResultHandler<string> = {
    
    parse(rowData) {
        return rowData[0];
    }
}

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
});

// MODEL TESTS
// ================================================================================================
interface Password {
    value: string;
}

const Password: FieldHandler = {
    clone(pwd: Password) { return pwd; },
    areEqual(pwd1: Password, pwd2: Password) { return pwd1 === pwd2; }
};

@dbModel('tokens', new PgIdGenerator('tokens_seq'))
class Token extends Model {

    @dbField(String, { readonly: true })
    accountId!: string;

    @dbField(Number)
    status!: number;

    @dbField(Object)
    origin!: any;
}

(function modelTests() {

    console.log(JSON.stringify(Token.getSchema()));
    const qSelectTokens = Token.SelectQuery('list');
    console.log(new qSelectTokens(false, { id: '123' }).text);
    console.log(new qSelectTokens(true,  { id: '234' }).text);
    console.log(new qSelectTokens(false, [
        { 
            origin: Op.contains({ method: 'facebook'}), 
            status: Op.not(null) 
        }, 
        { 
            status: Op.lte(5) 
        }
    ]).text);

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

    const query1 = Query.from('SELECT id FROM tokens LIMIT 5;', { name: 'query1', mask: 'list', handler: IdHandler })
    const result1 = session.execute(query1);

    const query2 = Query.from('SELECT status FROM tokens LIMIT 5;', 'query2', { mask: 'list' })
    const result2 = session.execute(query2);

    const template1 = Query.template('SELECT id, status, handle FROM accounts WHERE profile = {{profile}};', 'query3', 'single');
    const query3 = new template1({ profile: `test's` });
    const result3 = session.execute(query3);

    try {
        const results = await Promise.all([result1, result2, result3 ]);
        console.log(JSON.stringify(results));

        const token = await session.fetchOne(Token, { id: '1554790800074735617'});
        console.log(JSON.stringify(token));
        
        await session.close('commit');
    }
    catch (error) {
        console.error(error);
    }

    const guidGenerator = new GuidGenerator();
    console.log(await guidGenerator.getNextId());
});
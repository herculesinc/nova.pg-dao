// IMPORTS
// ================================================================================================
import { Database, Query, Model as ModelClass, dbModel, dbField, PgIdGenerator, Operators as Op } from '../index';
import { Model as ModelType, ListResultQueryOptions, SingleResultQueryOptions, ResultHandler, FieldHandler, QueryTextLogLevel } from '@nova/pg-dao';

const Model: typeof ModelType = ModelClass as any;

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

class qSelectConversationTokens extends Token.SelectQuery('list') {
    constructor(conversationId: string) {
        super(false);
        this.where = `id IN (SELECT token_id FROM conversations WHERE id = ${conversationId})`;
    }
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
    console.log(new qSelectTokens(false, { id: Op.in(['1', '2']) }).text);
    console.log(new qSelectConversationTokens('1').text);
});

// DATABASE TESTS
// ================================================================================================
const database = new Database({
    connection: {
        database    : "credotest",
        host        : "",
        port        : 5432,
        ssl         : true,
        user        : "credoapi@credo-dev",
        password    : ""
    }
});

(async function dbTests() {

    const session = database.getSession({ logQueryText: QueryTextLogLevel.onError });

    const query1 = Query.from('SELECT id FROM tokens LIMIT 5;', { name: 'query1', mask: 'list', handler: IdHandler });
    const result1 = session.execute(query1);

    const query2 = Query.from('SELECT status FROM tokens LIMIT 5;', 'query2', { mask: 'list' })
    const result2 = session.execute(query2);

    const template1 = Query.template('SELECT id, status, handle FROM accounts WHERE profile = {{profile}};', 'query3', 'single');
    const query3 = new template1({ profile: `test's` });
    const result3 = session.execute(query3);

    const errorQuery = Query.from('SELLECT * FROM tokens;');

    try {
        const results = await Promise.all([result1, result2, result3 ]);
        console.log(JSON.stringify(results));

        const errResult = await session.execute(errorQuery);

        const token = await session.fetchOne(Token, { id: '1554790800074735617'});
        console.log(JSON.stringify(token));

        await session.close('commit');

        await database.close();
        console.log('Pool size: ' + database.getPoolState().size);
    }
    catch (error) {
        console.error(error);
        if (session.isActive) {
            await session.close('rollback');
        }
    }
})();
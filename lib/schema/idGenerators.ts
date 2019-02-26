// IMPORTS
// ================================================================================================
import { IdGenerator, SingleResultQuery, DaoSession } from '@nova/pg-dao';

// POSTGRES ID GENERATOR
// ================================================================================================
export class PgIdGenerator implements IdGenerator {
    
    idSequenceQuery: SingleResultQuery<string>;
    
    constructor(idSequence: string) {
        this.idSequenceQuery = {
            name    : 'qGetNextId:' + idSequence,
            text    : `SELECT nextval('${idSequence}'::regclass) AS id;`,
            mask    : 'single',
            handler : idExtractor
        };
    }
    
    async getNextId(dao: DaoSession): Promise<string> {
        return dao.execute(this.idSequenceQuery) as Promise<string>;
    }
}

// GUID ID GENERATOR
// ================================================================================================
export class GuidIdGenerator implements IdGenerator {
    async getNextId(): Promise<string> {
        return ''; // TODO: generate a new guid
    }
}

// HELPERS
// ================================================================================================
const idExtractor = {
    parse(row: string[]) { return row[0]; }
}
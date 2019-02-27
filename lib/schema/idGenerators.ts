// IMPORTS
// ================================================================================================
import { IdGenerator, SingleResultQuery, DaoSession, Logger } from '@nova/pg-dao';

// POSTGRES ID GENERATOR
// ================================================================================================
export class PgIdGenerator implements IdGenerator {
    
    idSequenceQuery: SingleResultQuery<string>;
    
    constructor(idSequenceName: string) {
        this.idSequenceQuery = {
            name    : 'qGetNextId:' + idSequenceName,
            text    : `SELECT nextval('${idSequenceName}'::regclass) AS id;`,
            mask    : 'single',
            handler : idExtractor
        };
    }
    
    async getNextId(logger: Logger, dao: DaoSession): Promise<string> {
        return dao.execute(this.idSequenceQuery) as Promise<string>;
    }
}

// GUID GENERATOR
// ================================================================================================
export class GuidGenerator implements IdGenerator {
    async getNextId(): Promise<string> {
        return ''; // TODO: generate a new guid
    }
}

// HELPERS
// ================================================================================================
const idExtractor = {
    parse(row: string[]) { return row[0]; }
}
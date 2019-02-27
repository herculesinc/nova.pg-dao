"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// POSTGRES ID GENERATOR
// ================================================================================================
class PgIdGenerator {
    constructor(idSequenceName) {
        this.idSequenceQuery = {
            name: 'qGetNextId:' + idSequenceName,
            text: `SELECT nextval('${idSequenceName}'::regclass) AS id;`,
            mask: 'single',
            handler: idExtractor
        };
    }
    async getNextId(logger, dao) {
        return dao.execute(this.idSequenceQuery);
    }
}
exports.PgIdGenerator = PgIdGenerator;
// GUID GENERATOR
// ================================================================================================
class GuidGenerator {
    async getNextId() {
        return ''; // TODO: generate a new guid
    }
}
exports.GuidGenerator = GuidGenerator;
// HELPERS
// ================================================================================================
const idExtractor = {
    parse(row) { return row[0]; }
};
//# sourceMappingURL=idGenerators.js.map
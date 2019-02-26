"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// POSTGRES ID GENERATOR
// ================================================================================================
class PgIdGenerator {
    constructor(idSequence) {
        this.idSequenceQuery = {
            name: 'qGetNextId:' + idSequence,
            text: `SELECT nextval('${idSequence}'::regclass) AS id;`,
            mask: 'single',
            handler: idExtractor
        };
    }
    async getNextId(dao) {
        return dao.execute(this.idSequenceQuery);
    }
}
exports.PgIdGenerator = PgIdGenerator;
// GUID ID GENERATOR
// ================================================================================================
class GuidIdGenerator {
    async getNextId() {
        return ''; // TODO: generate a new guid
    }
}
exports.GuidIdGenerator = GuidIdGenerator;
// HELPERS
// ================================================================================================
const idExtractor = {
    parse(row) { return row[0]; }
};
//# sourceMappingURL=idGenerators.js.map
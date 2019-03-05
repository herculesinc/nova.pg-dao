"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// DEFAULTS
// ================================================================================================
exports.defaults = {
    name: 'database',
    connection: {
        host: undefined,
        port: 5432,
        ssl: false,
        user: undefined,
        password: undefined,
        database: undefined,
    },
    session: {
        readonly: true,
        verifyImmutability: true,
        logQueryText: 1 /* onError */
    },
    pool: {
        maxSize: 20,
        idleTimeout: 30000,
        reapInterval: 1000
    }
};
//# sourceMappingURL=defaults.js.map
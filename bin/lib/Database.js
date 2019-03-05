"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTS
// =================================================================================================
const nova = require("@nova/core");
const events_1 = require("events");
const pg_1 = require("pg");
const Session_1 = require("./Session");
const defaults_1 = require("./defaults");
// CLASS DEFINITION
// =================================================================================================
class Database extends events_1.EventEmitter {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(config) {
        super();
        if (!config)
            throw TypeError('Cannot create a Database: config parameter is undefined');
        if (!config.connection)
            throw TypeError('Cannot create a Database: connection settings are undefined');
        this.source = { name: config.name || defaults_1.defaults.name, type: 'sql' };
        const poolOptions = Object.assign({}, defaults_1.defaults.pool, config.pool);
        const connectionSettings = Object.assign({}, defaults_1.defaults.connection, config.connection);
        this.pool = new pg_1.Pool(buildPgPoolOptions(connectionSettings, poolOptions));
        this.pool.on('error', (error) => {
            // turn off error emitter because pgPool emits duplicate errors when client creation fails
            // this.emit('error', error);
        });
    }
    // PUBLIC METHODS
    // --------------------------------------------------------------------------------------------
    getSession(options, logger) {
        const sOptions = Object.assign({}, defaults_1.defaults.session, options);
        return new Session_1.DaoSession(this.pool, sOptions, this.source, logger || nova.logger);
    }
    close() {
        return this.pool.end();
    }
    // POOL INFO ACCESSORS
    // --------------------------------------------------------------------------------------------
    getPoolState() {
        return {
            size: this.pool._clients.length,
            idle: this.pool._idle.length
        };
    }
}
exports.Database = Database;
// HELPER FUNCTIONS
// ================================================================================================
function buildPgPoolOptions(conn, pool) {
    return {
        host: conn.host,
        port: conn.port,
        ssl: conn.ssl,
        user: conn.user,
        password: conn.password,
        database: conn.database,
        max: pool.maxSize,
        idleTimeoutMillis: pool.idleTimeout,
        reapIntervalMillis: pool.reapInterval
    };
}
//# sourceMappingURL=Database.js.map
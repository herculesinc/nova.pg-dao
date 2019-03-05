// IMPORTS
// =================================================================================================
import * as nova from '@nova/core';
import { EventEmitter } from 'events';
import { DatabaseConfig, ConnectionSettings, PoolOptions, PoolState, SessionOptions, TraceSource } from '@nova/pg-dao';
import { Pool, ClientConfig } from 'pg';
import { DaoSession } from './Session';
import { defaults } from './defaults';

// CLASS DEFINITION
// =================================================================================================
export class Database extends EventEmitter {

    private readonly pool   : Pool;
    private readonly source : TraceSource;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(config: DatabaseConfig) {
        super();

        if (!config) throw TypeError('Cannot create a Database: config parameter is undefined');
        if (!config.connection) throw TypeError('Cannot create a Database: connection settings are undefined');

        this.source = { name: config.name || defaults.name, type: 'sql' };

        const poolOptions = { ...defaults.pool, ...config.pool };
        const connectionSettings = { ...defaults.connection, ...config.connection };
        this.pool = new Pool(buildPgPoolOptions(connectionSettings, poolOptions));

        this.pool.on('error', (error) => {
            // turn off error emitter because pgPool emits duplicate errors when client creation fails
            // this.emit('error', error);
        });
    }

    // PUBLIC METHODS
    // --------------------------------------------------------------------------------------------
    getSession(options?: Partial<SessionOptions>, logger?: nova.Logger | null): DaoSession {
        const sOptions = { ...defaults.session, ...options };
        if (logger === undefined) {
            logger = nova.logger;
        }
        return new DaoSession(this.pool, sOptions, this.source, logger || undefined);
    }

    close(): Promise<any> {
        return this.pool.end();
    }

    // POOL INFO ACCESSORS
    // --------------------------------------------------------------------------------------------
    getPoolState(): PoolState {
        return {
            size: this.pool._clients.length,
            idle: this.pool._idle.length
        };
    }
}

// HELPER FUNCTIONS
// ================================================================================================
function buildPgPoolOptions(conn: ConnectionSettings, pool: PoolOptions): ClientConfig {
    return {
        host                : conn.host,
        port                : conn.port,
        ssl                 : conn.ssl,
        user                : conn.user,
        password            : conn.password,
        database            : conn.database,
        max                 : pool.maxSize,
        idleTimeoutMillis   : pool.idleTimeout,
        reapIntervalMillis  : pool.reapInterval
    };
}

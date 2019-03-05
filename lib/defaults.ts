// IMPORTS
// ================================================================================================
import { ConnectionSettings, SessionOptions, PoolOptions, QueryTextLogLevel } from '@nova/pg-dao';

// INTERFACES
// ================================================================================================
export interface Defaults {
    name                : string;
    connection          : Partial<ConnectionSettings>;
    session             : SessionOptions;
    pool                : PoolOptions;
}

// DEFAULTS
// ================================================================================================
export const defaults: Defaults = {
    name                : 'database',
    connection: {
        host            : undefined,
        port            : 5432,
        ssl             : false,
        user            : undefined,
        password        : undefined,
        database        : undefined,
    },
    session: {
        readonly            : true,
        verifyImmutability  : true,
        logQueryText        : QueryTextLogLevel.onError
    },
    pool: {
        maxSize         : 20,
        idleTimeout     : 30000,
        reapInterval    : 1000
    }
};
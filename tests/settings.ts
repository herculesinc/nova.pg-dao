export const settings = {
    connection: {
        database: 'postgres',
        host    : '127.0.0.1',
        port    : 5432,
        ssl     : false,
        user    : 'postgres',
        password: ''
    },
    pool: {
        maxSize          : 10,
        idleTimeout      : 1000,
        connectionTimeout: 3000
    }
};

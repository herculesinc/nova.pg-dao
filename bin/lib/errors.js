"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTS
// ================================================================================================
const core_1 = require("@nova/core");
// ERROR CLASSES
// ================================================================================================
class ConnectionError extends core_1.Exception {
    constructor(messageOrCause, cause) {
        if (typeof messageOrCause === 'string') {
            super({ name: 'Connection Error', message: messageOrCause, cause });
        }
        else {
            super({ name: 'Connection Error', cause: messageOrCause });
        }
    }
}
exports.ConnectionError = ConnectionError;
class QueryError extends core_1.Exception {
    constructor(messageOrCause, cause) {
        if (typeof messageOrCause === 'string') {
            super({ name: 'Query Error', message: messageOrCause, cause });
        }
        else {
            super({ name: 'Query Error', cause: messageOrCause });
        }
    }
}
exports.QueryError = QueryError;
class ParseError extends core_1.Exception {
    constructor(messageOrCause, cause) {
        if (typeof messageOrCause === 'string') {
            super({ name: 'Parse Error', message: messageOrCause, cause });
        }
        else {
            super({ name: 'Parse Error', cause: messageOrCause });
        }
    }
}
exports.ParseError = ParseError;
class ModelError extends core_1.Exception {
    constructor(messageOrCause, cause) {
        if (typeof messageOrCause === 'string') {
            super({ name: 'Model Error', message: messageOrCause, cause });
        }
        else {
            super({ name: 'Model Error', cause: messageOrCause });
        }
    }
}
exports.ModelError = ModelError;
//# sourceMappingURL=errors.js.map
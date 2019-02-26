// IMPORTS
// ================================================================================================
import { Exception } from '@nova/core';

// ERROR CLASSES
// ================================================================================================
export class ConnectionError extends Exception {
	constructor(cause: Error);
	constructor(message: string, cause?: Error)
	constructor(messageOrCause: string | Error, cause?: Error) {
		if (typeof messageOrCause === 'string') {
			super({ name: 'Connection Error', message: messageOrCause, cause })
		}
		else {
			super({ name: 'Connection Error', cause: messageOrCause })
		}
	}
}

export class QueryError extends Exception {
	constructor(cause: Error);
	constructor(message: string, cause?: Error)
	constructor(messageOrCause: string | Error, cause?: Error) {
		if (typeof messageOrCause === 'string') {
			super({ name: 'Query Error', message: messageOrCause, cause })
		}
		else {
			super({ name: 'Query Error', cause: messageOrCause })
		}
	}
}

export class ParseError extends Exception {
	constructor(cause: Error);
	constructor(message: string, cause?: Error)
	constructor(messageOrCause: string | Error, cause?: Error) {
		if (typeof messageOrCause === 'string') {
			super({ name: 'Parse Error', message: messageOrCause, cause })
		}
		else {
			super({ name: 'Parse Error', cause: messageOrCause })
		}
	}
}

export class ModelError extends Exception {
	constructor(cause: Error);
	constructor(message: string, cause?: Error)
	constructor(messageOrCause: string | Error, cause?: Error) {
		if (typeof messageOrCause === 'string') {
			super({ name: 'Model Error', message: messageOrCause, cause })
		}
		else {
			super({ name: 'Model Error', cause: messageOrCause })
		}
	}
}
// IMPORTS
// =================================================================================================
import * as nova from "@nova/core";
import {TraceCommand, TraceSource} from '@nova/core';

// LOGGER CLASS
// =================================================================================================
export class MockLogger implements nova.Logger {

    debug(message: string): void {}
    info(message: string): void {}
    warn(message: string): void {}
    error(error: Error): void {}

    trace(source: TraceSource, command: string | TraceCommand, duration: number, success: boolean): void {}
}

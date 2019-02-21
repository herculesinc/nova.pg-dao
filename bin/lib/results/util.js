"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// MODULE VARIABLES
// ================================================================================================
const matchRegexp = /^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/;
// PUBLIC FUNCTIONS
// ================================================================================================
function applyCommandComplete(result, command) {
    const match = matchRegexp.exec(command);
    if (match) {
        result.command = match[1];
        if (match[3]) {
            result.oid = Number.parseInt(match[2], 10);
            result.rowCount = Number.parseInt(match[3], 10);
        }
        else if (match[2]) {
            result.rowCount = Number.parseInt(match[2], 10);
        }
    }
}
exports.applyCommandComplete = applyCommandComplete;
//# sourceMappingURL=util.js.map
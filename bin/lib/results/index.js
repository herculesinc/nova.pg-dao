"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ArrayResult_1 = require("./ArrayResult");
const ObjectResult_1 = require("./ObjectResult");
const CustomResult_1 = require("./CustomResult");
const EmptyResult_1 = require("./EmptyResult");
// PUBLIC FUNCTIONS
// ================================================================================================
function createResult(options) {
    if (options.mode === 'array') {
        return new ArrayResult_1.ArrayResult(options.mask || 'list');
    }
    else if (options.mode === 'object') {
        return new ObjectResult_1.ObjectResult(options.mask || 'list');
    }
    else if (options.handler) {
        return new CustomResult_1.CustomResult(options.mask || 'list', options.handler);
    }
    else {
        return new EmptyResult_1.EmptyResult();
    }
}
exports.createResult = createResult;
//# sourceMappingURL=index.js.map
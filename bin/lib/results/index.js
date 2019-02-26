"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Model_1 = require("../Model");
const ArrayResult_1 = require("./ArrayResult");
const ObjectResult_1 = require("./ObjectResult");
const CustomResult_1 = require("./CustomResult");
const ModelResult_1 = require("./ModelResult");
const EmptyResult_1 = require("./EmptyResult");
// PUBLIC FUNCTIONS
// ================================================================================================
function createResult(options, store) {
    if (options.handler) {
        const handler = options.handler;
        const mask = options.mask || 'list';
        if (handler === Object) {
            return new ObjectResult_1.ObjectResult(mask);
        }
        else if (handler === Array) {
            return new ArrayResult_1.ArrayResult(mask);
        }
        else if (Model_1.isModelClass(handler)) {
            return new ModelResult_1.ModelResult(mask, options.mutable || false, handler, store);
        }
        else {
            return new CustomResult_1.CustomResult(mask, handler);
        }
    }
    else {
        if (options.mask) {
            return new ObjectResult_1.ObjectResult(options.mask);
        }
        else {
            return new EmptyResult_1.EmptyResult();
        }
    }
}
exports.createResult = createResult;
//# sourceMappingURL=index.js.map
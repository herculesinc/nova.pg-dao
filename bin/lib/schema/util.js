"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// MODULE VARIABLES
// ================================================================================================
const camelPattern = /([A-Z]+)/g;
// CASE CONVERTERS
// ================================================================================================
function camelToSnake(camel) {
    return camel.replace(camelPattern, (match) => '_' + match.toLowerCase());
}
exports.camelToSnake = camelToSnake;
// CLONERS
// ================================================================================================
function clonePrimitive(source) {
    return source;
}
exports.clonePrimitive = clonePrimitive;
function cloneDate(source) {
    if (!source)
        return undefined;
    return new Date(source.valueOf());
}
exports.cloneDate = cloneDate;
function cloneObject(source) {
    if (!source)
        return undefined;
    return JSON.parse(JSON.stringify(source));
}
exports.cloneObject = cloneObject;
function cloneArray(source) {
    if (!source)
        return undefined;
    return JSON.parse(JSON.stringify(source));
}
exports.cloneArray = cloneArray;
// COMPARATORS
// ================================================================================================
function arePrimitivesEqual(value1, value2) {
    if (value1 == undefined && value2 == undefined)
        return true;
    return (value1 === value2);
}
exports.arePrimitivesEqual = arePrimitivesEqual;
function areDatesEqual(date1, date2) {
    if (date1 == date2)
        return true;
    if (date1 == undefined || date2 == undefined)
        return false;
    return (date1.valueOf() === date2.valueOf());
}
exports.areDatesEqual = areDatesEqual;
function areObjectsEqual(object1, object2) {
    if (object1 == object2)
        return true;
    if (!object1 || !object2)
        return false;
    return (JSON.stringify(object1) === JSON.stringify(object2));
}
exports.areObjectsEqual = areObjectsEqual;
function areArraysEqual(array1, array2) {
    if (array1 == array2)
        return true;
    if (!array1 || !array2)
        return false;
    return (JSON.stringify(array1) === JSON.stringify(array2));
}
exports.areArraysEqual = areArraysEqual;
//# sourceMappingURL=util.js.map
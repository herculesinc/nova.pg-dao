// MODULE VARIABLES
// ================================================================================================
const camelPattern = /([A-Z]+)/g;

// CASE CONVERTERS
// ================================================================================================
export function camelToSnake(camel: string) {
	return camel.replace(camelPattern, (match) => '_' + match.toLowerCase());
}

// CLONERS
// ================================================================================================
export function clonePrimitive<T extends number | string | boolean>(source?: T): T | undefined {
    return source;
}

export function cloneDate(source?: Date): Date | undefined {
	if (!source) return undefined;
	return new Date(source.valueOf());
}

export function cloneObject(source?: object): object | undefined {
    if (!source) return undefined;
    return JSON.parse(JSON.stringify(source));
}

export function cloneArray(source?: any[]): any[] | undefined {
    if (!source) return undefined;
    return JSON.parse(JSON.stringify(source));
}

// COMPARATORS
// ================================================================================================
export function arePrimitivesEqual<T extends number | string | boolean>(value1?: T, value2?: T): boolean {
    if (value1 == undefined && value2 == undefined) return true;
    return (value1 === value2);
}

export function areDatesEqual(date1: Date, date2: Date): boolean {
	if (date1 == date2) return true;
	if (date1 == undefined || date2 == undefined) return false;
	return (date1.valueOf() === date2.valueOf());
}

export function areObjectsEqual(object1?: object, object2?: object): boolean {
    if (object1 == object2) return true;
    if (!object1 || !object2) return false;
    return (JSON.stringify(object1) === JSON.stringify(object2));
}

export function areArraysEqual(array1?: any[], array2?: any[]): boolean {
    if (array1 == array2) return true;
    if (!array1 || !array2) return false;
    return (JSON.stringify(array1) === JSON.stringify(array2));
}
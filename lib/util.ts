export function prepareValue(value: any) {
    if (value instanceof Buffer) {
        return value;
    }
    else if (ArrayBuffer.isView(value)) {
        return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    }
    else if (value instanceof Date) {
        return dateToString(value);
    }
    else if (Array.isArray(value)) {
        return arrayString(value);
    }
    else if (value === null || typeof value === 'undefined') {
        return null;
    }
    else if (typeof value === 'object') {
        return JSON.stringify(value);
    }

    return value.toString();
}

function arrayString(value: any[]) {
    let result = '{'
    for (var i = 0; i < value.length; i++) {
        if (i > 0) {
            result = result + ','
        }
        if (value[i] === null || typeof value[i] === 'undefined') {
            result = result + 'NULL'
        }
        else if (Array.isArray(value[i])) {
            result = result + arrayString(value[i])
        } else if (value[i] instanceof Buffer) {
            result += '\\\\x' + value[i].toString('hex')
        } else {
            result += escapeElement(prepareValue(value[i]))
        }
    }
    result = result + '}'
    return result
}

function escapeElement(elementRepresentation: string) {
    let escaped = elementRepresentation
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');

    return '"' + escaped + '"';
}

function dateToString(date: Date) {
    let offset = -date.getTimezoneOffset()
    let ret = pad(date.getFullYear(), 4) + '-' +
        pad(date.getMonth() + 1, 2) + '-' +
        pad(date.getDate(), 2) + 'T' +
        pad(date.getHours(), 2) + ':' +
        pad(date.getMinutes(), 2) + ':' +
        pad(date.getSeconds(), 2) + '.' +
        pad(date.getMilliseconds(), 3)

    if (offset < 0) {
        ret += '-';
        offset *= -1;
    } else {
        ret += '+';
    }

    return ret + pad(Math.floor(offset / 60), 2) + ':' + pad(offset % 60, 2);
}

function pad(number: any, digits: number) {
    number = '' + number;
    while (number.length < digits) { number = '0' + number };
    return number;
}
// HTTP methods whose capitalization should be normalized
const methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];

export function normalizeMethod(method: string) {
    const upcased = method.toUpperCase();
    return methods.indexOf(upcased) > -1 ? upcased : method
}

export function unmarshalHeaders(headers: domTypes.HeadersInit): Headers {
    let ret: Headers = new Headers();
    if (headers instanceof Headers) {
        ret = headers
    } else if (Array.isArray(headers)) {
        for (const entry of headers) {
            ret.set(entry[0], entry[1])
        }
    } else {
        for (const [key, val] of Object.entries(headers)) {
            ret.set(key, val);
        }
    }
    return ret;
}

export function extendBytes(a: Uint8Array, size: number): Uint8Array {
    const ret = new Uint8Array(a.length + size);
    ret.set(a, 0);
    return ret;
}

export function isArrayBufferView(a): a is ArrayBufferView {
    return (
        a instanceof Int8Array ||
        a instanceof Uint8Array ||
        a instanceof Uint8ClampedArray ||
        a instanceof Int16Array ||
        a instanceof Uint16Array ||
        a instanceof Int32Array ||
        a instanceof Uint32Array ||
        a instanceof Float32Array ||
        a instanceof Float64Array ||
        a instanceof DataView
    )
}

export function binaryArrayToBytes(bin: ArrayBufferView | ArrayBuffer): Uint8Array {
    const buf = new ArrayBuffer(bin.byteLength);
    let view = new DataView(buf);
    if (bin instanceof Int8Array) {
        for (let i = 0; i < bin.byteLength; i++) {
            view.setInt8(i, bin[i]);
        }
    } else if (bin instanceof Int16Array) {
        for (let i = 0; i < bin.byteLength; i++) {
            view.setInt16(i * 2, bin[i]);
        }
    } else if (bin instanceof Int32Array) {
        for (let i = 0; i < bin.byteLength; i++) {
            view.setInt32(i * 4, bin[i]);
        }
    } else if (bin instanceof Uint8Array) {
        return bin;
    } else if (bin instanceof Uint16Array) {
        for (let i = 0; i < bin.byteLength; i++) {
            view.setUint16(i * 2, bin[i]);
        }
    } else if (bin instanceof Uint32Array) {
        for (let i = 0; i < bin.byteLength; i++) {
            view.setUint32(i * 4, bin[i]);
        }
    } else if (bin instanceof Uint8ClampedArray) {
        for (let i = 0; i < bin.byteLength; i++) {
            view.setUint8(i, bin[i]);
        }
    } else if (bin instanceof Float32Array) {
        for (let i = 0; i < bin.byteLength; i++) {
            view.setFloat32(i * 4, bin[i]);
        }
    } else if (bin instanceof Float64Array) {
        for (let i = 0; i < bin.byteLength; i++) {
            view.setFloat64(i * 8, bin[i]);
        }
    } else if (bin instanceof ArrayBuffer) {
        view = new DataView(bin);
    } else if (bin instanceof DataView) {
        view = bin;
    }
    const ret = new Uint8Array(view.byteLength);
    for (let i = 0; i < view.byteLength; i++) {
        ret[i] = view.getUint8(i);
    }
    return ret;
}

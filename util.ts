import {
  ReadableStream,
  ReadableStreamReadResult
} from "https://denopkg.com/keroxp/deno-streams/readable_stream.ts";
import {ReadableStreamReader} from "https://denopkg.com/keroxp/deno-streams/readable_stream_reader.ts";
import {copy, Reader, ReadResult, Writer} from "deno";
import {
  IsReadableStreamBYOBReader,
  ReadableStreamBYOBReader
} from "https://denopkg.com/keroxp/deno-streams/readable_stream_byob_reader.ts";

// HTTP methods whose capitalization should be normalized
const methods = ["DELETE", "GET", "HEAD", "OPTIONS", "POST", "PUT"];

export function normalizeMethod(method: string) {
  const upcased = method.toUpperCase();
  return methods.indexOf(upcased) > -1 ? upcased : method;
}

export function unmarshalHeaders(headers: domTypes.HeadersInit): Headers {
  let ret: Headers = new Headers();
  if (headers instanceof Headers) {
    ret = headers;
  } else if (Array.isArray(headers)) {
    for (const entry of headers) {
      ret.set(entry[0], entry[1]);
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
  );
}

export function binaryArrayToBytes(
  bin: ArrayBufferView | ArrayBuffer
): Uint8Array {
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

export async function readFullStream(
  stream: ReadableStream
): Promise<Uint8Array> {
  const reader = stream.getReader() as ReadableStreamReader<Uint8Array>;
  let chunks: Uint8Array[] = [];
  let len = 0;
  while (true) {
    const {value, done} = await reader.read();
    if (value) {
      chunks.push(value);
      len += value.byteLength;
    }
    if (done) {
      break;
    }
  }
  const ret = new Uint8Array(len);
  let loc = 0;
  chunks.forEach(chunk => {
    ret.set(chunk, loc);
    loc += chunk.byteLength;
  });
  return ret;
}

export class ReadableStreamDenoReader implements Reader {
  reader: ReadableStreamReader<Uint8Array>;
  byobReader: ReadableStreamBYOBReader;

  constructor(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader();
    if (IsReadableStreamBYOBReader(reader)) {
      this.byobReader = reader;
    } else {
      this.reader = reader;
    }
  }

  private async _read(p: Uint8Array) {
    if (this.reader) {
      return await this.reader.read();
    } else {
      const {done} = await this.byobReader.read(p);
      return {value: p, done};
    }
  }

  async read(p: Uint8Array): Promise<ReadResult> {
    const {value, done} = await this._read(p);
    let nread = 0;
    if (value) {
      p.set(value);
      nread = value.byteLength;
    }
    return {nread, eof: done};
  }
}


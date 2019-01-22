import {binaryArrayToBytes, extendBytes, isArrayBufferView} from "./util.ts";
import BodyInit = domTypes.BodyInit;

type MultipartFormData = {
    file: Uint8Array,
    name: string,
}
const encoder = new TextEncoder;
const decoder = new TextDecoder;

export class Body implements domTypes.Body {
    protected _bodyInit: BodyInit;
    public get bodyInit(): BodyInit {
        return this._bodyInit;
    };

    protected bodyString?: string;
    protected bodyArrayBuffer?: ArrayBuffer;
    protected bodyBlob?: Blob;
    protected bodyFormData?: domTypes.FormData;
    protected bodySearchParams?: URLSearchParams;

    constructor(body: BodyInit = "") {
        this._bodyInit = body;
        if (typeof body === "string") {
            this.bodyString = body;
        } else if (body instanceof ArrayBuffer) {
            this.bodyArrayBuffer = body;
        } else if (isArrayBufferView(body)) {
            this.bodyArrayBuffer = body.buffer;
        } else if (body.constructor.name === "ReadableStream") {
            this.body = body as domTypes.ReadableStream;
        } else if (body instanceof Blob) {
            this.bodyBlob = body;
        } else if (body instanceof FormData) {
            this.bodyFormData = body;
        } else if (body instanceof URLSearchParams) {
            this.bodySearchParams = body;
        } else {
            throw new Error("invalid input: " + body)
        }
    }

    protected _headers: Headers;
    get headers(): Headers {
        return this._headers;
    }

    protected initBody(bodyInit: BodyInit, headers: Headers) {
        if (!headers.has("content-type")) {
            const type = estimateBodyType(bodyInit);
            if (type) {
                headers.set("content-type", type);
            }
        }
    }

    body: domTypes.ReadableStream | null;
    protected _bodyUsed = false;
    get bodyUsed(): boolean {
        return this._bodyUsed
    };

    async arrayBuffer(): Promise<ArrayBuffer> {
        return this.bodyArrayBuffer || await unmarshalBodyInit(this._bodyInit);
    }

    async blob(): Promise<domTypes.Blob> {
        if (this.bodyBlob) return this.bodyBlob;
        return this.bodyBlob = new Blob([await unmarshalBodyInit(this._bodyInit)], {
            type: estimateBodyType(this._bodyInit)
        });
    }

    async formData(): Promise<domTypes.FormData> {
        if (this.bodyFormData) return this.bodyFormData;
        const contentType = this.headers.get("content-type") || "";
        if (contentType.match(/^application\/x-www-form-urlencoded/)) {
            // form
            const text = await this.text();
            const form = new FormData();
            text.trim()
                .split("&")
                .map(kv => kv.split("="))
                .map(kv => form.set(kv[0], kv[1]));
            return this.bodyFormData = form;
        } else if (contentType.match(/^multipart\/form-data/)) {
            throw new Error("multipart formdata is not implemented")
        }
        throw new Error("body is not formData");
    }

    async json(): Promise<any> {
        this.bodyString = await this.text();
        return JSON.parse(this.bodyString);
    }

    async text(): Promise<string> {
        return this.bodyString || decoder.decode(await unmarshalBodyInit(this._bodyInit))
    }

}

export function estimateBodyType(body: BodyInit) {
    if (typeof body === "string") {
        return "text/plain;charset=UTF-8"
    } else if (body instanceof Blob && body.type) {
        return body.type;
    } else if (body instanceof FormData) {
        //return "application/x-www-form-urlencoded;charset=UTF-8"
    }
}

export async function unmarshalBodyInit(body: BodyInit): Promise<Uint8Array> {
    if (body === void 0 || body === null) {
        return new Uint8Array;
    }
    let bytes: Uint8Array;
    if (typeof body === "string") {
        bytes = new TextEncoder().encode(body)
    } else if (body instanceof ArrayBuffer || isArrayBufferView(body)) {
        bytes = binaryArrayToBytes(body)
    } else if (body.constructor.name === "ReadableStream") {
        const stream = body as domTypes.ReadableStream;
        const streamReader = stream.getReader();
        let buf = new Uint8Array(1024);
        let offs = 0;
        while (true) {
            const result = await streamReader.read();
            if (result.done) break;
            const value = result.value as ArrayLike<number>;
            if (offs + value.length > buf.length) {
                buf = extendBytes(buf, 1024)
            }
            buf.set(value, offs);
            offs += value.length;
        }
        bytes = buf.slice(0, offs);
    } else if (body instanceof Blob) {
        bytes = await readBlob(body);
    } else if (body instanceof FormData) {
        const boundary = "--aaa";
        const components: MultipartFormData[] = [];
        const promises = [];
        for (const [key, val] of body.entries()) {
            if (typeof val === "string") {
                const file = encoder.encode(val);
                components.push({
                    file,
                    name: key,
                })
            } else {
                promises.push(readBlob(val).then(file => ({
                    file,
                    name: key
                })))
            }
        }
        const files = await Promise.all(promises);
        components.push(...files);
        const contentLength = components.reduce((sum, v) => sum + calcFormDataByteLength(v, boundary), 0) + 4;
        bytes = new Uint8Array(contentLength);
        let offs = 0;
        for (const data of components) {
            const head = [boundary, `content-disposition: name=\"${data.name}\"`, "",].join("\r\n")
            const headBytes = encoder.encode(head);
            bytes.set(headBytes, offs);
            bytes.set(data.file);
            offs += headBytes.byteLength + data.file.byteLength
        }
    } else if (body instanceof URLSearchParams) {
        let str = "";
        for (const [key, val] of body.entries()) {
            str += `${key}=${val}`
        }
        bytes = encoder.encode(str)
    } else {
        throw new Error("invalid input: " + body)
    }
    return bytes;
}

const kContentDispositionTemplate = "content-disposition: name=\"\"";

function calcFormDataByteLength(data: MultipartFormData, boundary: string): number {
    let len = 0;
    len += boundary.length;
    len += kContentDispositionTemplate.length + data.name.length;
    len += data.file.byteLength;
    len += "\r\n".length * 4;
    return len;
}

async function readBlob(blob: domTypes.Blob): Promise<Uint8Array> {
    const fileReader = null;//new FileReader();
    await new Promise(resolve => {
        fileReader.addEventListener("loadend", resolve);
        fileReader.readAsArrayBuffer(blob);
    });
    const {result} = fileReader;
    if (typeof result === "string") {
        return new TextEncoder().encode(result)
    } else if (result instanceof ArrayBuffer) {
        return new Uint8Array(result)
    }
    return null;
}
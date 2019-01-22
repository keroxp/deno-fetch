//Copyright (c) 2014-2016 GitHub, Inc,
//Copyright (c) 2019 Deno authors
// MIT License.
import {Buffer, dial} from "deno"
import {BufReader, BufWriter} from "https://deno.land/x/io/bufio.ts";
import {TextProtoReader} from "https://deno.land/x/textproto/mod.ts";
import {Body} from "./body.ts";
import {normalizeMethod, unmarshalHeaders} from "./util.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const CRLF = "\r\n";
const kPortMap = {
    "http:": "80",
    "https:": "443"
};

export class Request extends Body implements domTypes.Request {
    constructor(input: Request | string, options: domTypes.RequestInit = {}) {
        let body = options.body;
        super(options.body);
        if (input instanceof Request) {
            if (input.bodyUsed) {
                throw new TypeError('Already read')
            }
            this.cache = input.cache;
            this.integrity = input.integrity;
            this.destination = input.destination;
            this.isHistoryNavigation = input.isHistoryNavigation;
            this.isReloadNavigation = input.isReloadNavigation;
            this.keepalive = input.keepalive;
            this.redirect = input.redirect;
            this.referrerPolicy = input.referrerPolicy;
            this.url = input.url;
            this.credentials = input.credentials;
            this._headers = unmarshalHeaders(options.headers || {});
            this.method = input.method;
            this.mode = input.mode;
            this.signal = input.signal;
            if (!body && input.bodyInit !== null) {
                this._bodyInit = input.bodyInit;
                input._bodyUsed = true
            }
        } else {
            this.url = String(input)
        }

        this.credentials = options.credentials || this.credentials || 'same-origin';
        if (options.headers || !this.headers) {
            this._headers = new Headers(options.headers)
        }
        this.method = normalizeMethod(options.method || this.method || 'GET');
        this.mode = options.mode || this.mode || null;
        this.signal = options.signal || this.signal;
        this.referrer = null;

        if ((this.method === 'GET' || this.method === 'HEAD') && body) {
            throw new TypeError('Body not allowed for GET or HEAD requests')
        }

        this.initBody(body, this.headers);

    }

    cache: domTypes.RequestCache;
    credentials: domTypes.RequestCredentials;
    destination: domTypes.RequestDestination;
    //headers: domTypes.Headers;
    integrity: string;
    isHistoryNavigation: boolean;
    isReloadNavigation: boolean;
    keepalive: boolean;
    method: string;
    mode: domTypes.RequestMode;
    redirect: domTypes.RequestRedirect;
    referrer: string;
    referrerPolicy: domTypes.ReferrerPolicy;
    signal: domTypes.AbortSignal;
    url: string;

    clone(): domTypes.Request {
        return new Request(this, {body: this.bodyInit});
    }

}

export async function request(params: {
    url: string,
    method: "GET" | "POST",
    data?: string | { [key: string]: string },
    headers: Headers
}): Promise<{
    status: number,
    statusText: string,
    headers: Headers,
    body: Buffer
}> {
    const {method, data, headers: reqHeaders} = params;
    const url = new URL(params.url);
    let {host, pathname, protocol, port, search} = url;
    if (!port) {
        port = kPortMap[protocol];
    }
    const conn = await dial("tcp", `${host}:${port}`);
    try {
        const writer = new BufWriter(conn);
        const reader = new BufReader(conn);
        const tpReader = new TextProtoReader(reader);
        // start line
        const lines = [`${method} ${pathname}${search} HTTP/1.1`];
        let reqBody = "";
        // data
        if (data) {
            if (typeof data === "string") {
                reqBody = data;
            } else {
                reqBody += Object.entries(data).map((kv) => `${kv[0]}=${[kv[1]]}`).join("&");
            }
            const contentLength = encoder.encode(reqBody).byteLength;
            reqHeaders.set("content-length", `${contentLength}`);
        }
        // header
        if (!reqHeaders.has("host")) {
            reqHeaders.set("host", host);
        }
        for (const [key, value] of reqHeaders) {
            lines.push(`${key}: ${value}`)
        }
        lines.push(CRLF);
        // dump message
        const msg = lines.join(CRLF) + reqBody;
        await writer.write(encoder.encode(msg));
        await writer.flush();
        // read status line
        const [resLine, state] = await tpReader.readLine();
        const [m, _, status, statusText] = resLine.match(/^([^ ]+)? (\d{3}) (.+?)$/);
        // read header
        const [resHeaders] = await tpReader.readMIMEHeader();
        // read body
        const contentLength = parseInt(resHeaders.get("content-length"));
        const bodyBytes = new Uint8Array(contentLength);
        await reader.readFull(bodyBytes);
        return {
            status: parseInt(status),
            statusText,
            headers: resHeaders,
            body: new Buffer(bodyBytes),
        };
    } catch (e) {
        console.error(e);
    } finally {
        conn.close();
    }
}

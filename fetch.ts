import {Request} from "./request.ts";
import {dial} from "deno";
import {BufReader, BufWriter} from "https://deno.land/x/io/bufio.ts";
import {TextProtoReader} from "https://deno.land/x/textproto/mod.ts";
import {unmarshalHeaders} from "./util.ts";
import {Response} from "./response.ts";
import {unmarshalBodyInit} from "./body.ts";

export async function fetch(
    input: Request | string,
    init?: domTypes.RequestInit
): Promise<domTypes.Response> {
    if (typeof input === "string") {
        if (!init) {
            return _fetch(new Request(input))
        } else {
            return _fetch(new Request(input, init));
        }
    } else if (input instanceof Request) {
        return _fetch(input)
    }
}

const encoder = new TextEncoder;
const CRLF = "\r\n";
const kPortMap = {
    "http:": "80",
    "https:": "443"
};

async function _fetch(
    req: Request
): Promise<domTypes.Response> {
    const reqHeaders = unmarshalHeaders(req.headers);
    if (req.keepalive) {
        reqHeaders.set("Connection", "Keep-Alive")
    }
    const url = new URL(req.url);
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
        const lines = [`${req.method} ${pathname}${search} HTTP/1.1`];
        let reqBody = await unmarshalBodyInit(req.bodyInit);
        const reqContentLength = reqBody.byteLength;
        reqHeaders.set("content-length", `${reqContentLength}`);
        // header
        if (!reqHeaders.has("host")) {
            reqHeaders.set("host", host);
        }
        for (const [key, value] of reqHeaders) {
            lines.push(`${key}: ${value}`)
        }
        lines.push(CRLF);
        // dump message
        const headerText = lines.join(CRLF);
        await writer.write(encoder.encode(headerText));
        await writer.write(reqBody);
        await writer.flush();
        // read status line
        const [resLine, state] = await tpReader.readLine();
        const [m, _, status, statusText] = resLine.match(/^([^ ]+)? (\d{3}) (.+?)$/);
        // read header
        const [resHeaders] = await tpReader.readMIMEHeader();
        // read body
        const contentLength = parseInt(resHeaders.get("content-length"));
        const resBodyBytes = new Uint8Array(contentLength);
        await reader.readFull(resBodyBytes);
        return new Response(resBodyBytes, {
            url: req.url,
            status: parseInt(status),
            statusText,
            headers: resHeaders,
        });
    } finally {

    }
}
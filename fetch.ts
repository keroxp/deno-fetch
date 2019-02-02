import { Request, RequestInit } from "./request.ts";
import { dial, Reader, ReadResult } from "deno";
import { BufReader, BufWriter } from "https://deno.land/x/io/bufio.ts";
import { TextProtoReader } from "https://deno.land/x/textproto/mod.ts";
import { unmarshalHeaders } from "./util.ts";
import { Response } from "./response.ts";
import { ReadableStream } from "https://denopkg.com/keroxp/deno-streams/readable_stream.ts";
import { WritableStream } from "https://denopkg.com/keroxp/deno-streams/writable_stream.ts";

export async function fetch(
  input: Request | string,
  init?: RequestInit
): Promise<Response> {
  if (typeof input === "string") {
    if (!init) {
      return _fetch(new Request(input));
    } else {
      return _fetch(new Request(input, init));
    }
  } else {
    return _fetch(input);
  }
}

const encoder = new TextEncoder();
const CRLF = "\r\n";
const kPortMap = {
  "http:": "80",
  "https:": "443"
};

async function _fetch(req: Request): Promise<Response> {
  const reqHeaders = unmarshalHeaders(req.headers);
  if (req.keepalive) {
    reqHeaders.set("Connection", "Keep-Alive");
  }
  const url = new URL(req.url);
  let { host, pathname, protocol, port, search } = url;
  if (!port) {
    port = kPortMap[protocol];
  }
  const conn = await dial("tcp", `${host}:${port}`);
  try {
    const writer = new BufWriter(conn);
    // start line
    const lines = [`${req.method} ${pathname}${search} HTTP/1.1`];
    // header
    if (!reqHeaders.has("host")) {
      reqHeaders.set("host", host);
    }
    for (const [key, value] of reqHeaders) {
      lines.push(`${key}: ${value}`);
    }
    if (req.bodySize === null) {
      reqHeaders.set("transfer-encoding", "chunked");
    } else {
      reqHeaders.set("content-length", `${req.bodySize}`);
    }
    lines.push(CRLF);
    const headerText = lines.join(CRLF);
    await writer.write(encoder.encode(headerText));
    const reqBodyStream = new WritableStream<Uint8Array>({
      write: async (chunk: Uint8Array) => {
        if (req.bodySize === null) {
          const size = chunk.byteLength.toString(16);
          await writer.write(encoder.encode(`${size}\r\n`));
          await writer.write(chunk);
          await writer.write(encoder.encode("\r\n"));
        } else {
          await writer.write(chunk);
        }
      },
      close: async () => {
        if (req.bodySize === null) {
          await writer.write(encoder.encode("0\r\n"));
        }
      }
    });
    await req.body.pipeTo(reqBodyStream);
    // Response
    const reader = new BufReader(conn);
    const tpReader = new TextProtoReader(reader);
    // read status line
    const [resLine, state] = await tpReader.readLine();
    const [m, _, status, statusText] = resLine.match(
      /^([^ ]+)? (\d{3}) (.+?)$/
    );
    // read header
    const [resHeaders] = await tpReader.readMIMEHeader();
    // read body
    const resContentLength = resHeaders.get("content-length");
    const contentLength = parseInt(resContentLength);
    const resBodyBuffer = new Uint8Array(1024);
    let bodyReader: Reader;
    if (resHeaders.get("transfer-encoding") !== "chunked") {
      bodyReader = new BodyReader(conn, contentLength);
    } else {
      bodyReader = new ChunkedBodyReader(conn);
    }
    return new Response(
      new ReadableStream<Uint8Array>({
        pull: async controller => {
          try {
            const { nread, eof } = await bodyReader.read(resBodyBuffer);
            if (nread > 0) {
              controller.enqueue(resBodyBuffer.slice(0, nread));
            }
            if (eof) {
              controller.close();
              conn.close();
            }
          } catch (e) {
            controller.error(e);
            conn.close();
          }
        },
        cancel: async reason => {
          conn.close();
        }
      }),
      {
        url: req.url,
        status: parseInt(status),
        statusText,
        headers: resHeaders
      }
    );
  } finally {
    conn.close();
  }
}

class BodyReader implements Reader {
  bodyLengthRemaining: number;

  constructor(private reader: Reader, private contentLength: number) {
    this.bodyLengthRemaining = contentLength;
  }

  async read(p: Uint8Array): Promise<ReadResult> {
    const { nread } = await this.reader.read(p);
    this.bodyLengthRemaining -= nread;
    return { nread, eof: this.bodyLengthRemaining === 0 };
  }
}

class ChunkedBodyReader implements Reader {
  bufReader = new BufReader(this.reader);
  tpReader = new TextProtoReader(this.bufReader);

  constructor(private reader: Reader) {}

  chunks: Uint8Array[] = [];
  crlfBuf = new Uint8Array(2);
  finished: boolean = false;

  async read(p: Uint8Array): Promise<ReadResult> {
    const [line] = await this.tpReader.readLine();
    const len = parseInt(line, 16);
    if (len === 0) {
      this.finished = true;
    } else {
      const buf = new Uint8Array(len);
      await this.bufReader.readFull(buf);
      await this.bufReader.readFull(this.crlfBuf);
      this.chunks.push(buf);
    }
    const buf = this.chunks[0];
    if (buf) {
      if (p.byteOffset + buf.byteLength < p.byteLength) {
        p.set(buf, p.byteOffset);
        this.chunks.shift();
        return { nread: p.byteLength, eof: false };
      } else {
        p.set(buf.slice(buf.byteOffset, p.byteLength), p.byteOffset);
        this.chunks[0] = buf.slice(p.byteOffset, buf.byteLength);
        return { nread: p.byteLength, eof: false };
      }
    } else {
      return { nread: 0, eof: true };
    }
  }
}

import {Request, RequestInit} from "./request.ts";
import {dial, Reader} from "deno";
import {ReadableStreamDenoReader, unmarshalHeaders} from "./util.ts";
import {Response} from "./response.ts";
import {ReadableStream} from "https://denopkg.com/keroxp/deno-streams/readable_stream.ts";
import {HttpRequest, writeHttpRequest} from "https://denopkg.com/keroxp/deno-request/writer.ts";
import {HttpResponse, readHttpResponse} from "https://denopkg.com/keroxp/deno-request/reader.ts";

const kPortMap = {
  "http:": "80",
  "https:": "443"
};

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

async function _fetch(req: Request): Promise<Response> {
  const reqHeaders = unmarshalHeaders(req.headers);
  if (req.keepalive) {
    reqHeaders.set("Connection", "Keep-Alive");
  }
  const url = new URL(req.url);
  let {hostname, protocol, port} = url;
  if (!port) {
    port = kPortMap[protocol];
  }
  const conn = await dial("tcp", `${hostname}:${port}`);
  let body: Reader;
  if (req.body) {
    body = new ReadableStreamDenoReader(req.body);
  }
  await writeHttpRequest(conn, {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body,
    bodySize: req.bodySize
  });
  // Response
  const {
    status,
    statusText,
    headers: resHeaders,
    body: bodyReader
  } = await readHttpResponse(conn);
  const resBodyBuffer = new Uint8Array(1024);
  return new Response(
    new ReadableStream<Uint8Array>({
      pull: async controller => {
        try {
          const {nread, eof} = await bodyReader.read(resBodyBuffer);
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
      status,
      statusText,
      headers: resHeaders
    }
  );
}

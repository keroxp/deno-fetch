import { unmarshalHeaders } from "./util.ts";
import { Body, BodyInit, BodyMixin, extractBody } from "./body.ts";
import { ReadableStream } from "https://denopkg.com/keroxp/deno-streams/readable_stream.ts";

export class Response implements BodyMixin {
  constructor(
    init: BodyInit,
    opts: {
      url?: string;
      status?: number;
      statusText?: string;
      headers?: domTypes.HeadersInit;
    } = {}
  ) {
    this.status = opts.status || 200;
    this.statusText = opts.statusText || "OK";
    this.url = opts.url || "";
    this.headers = unmarshalHeaders(opts.headers || {});
    this.ok = this.status < 300;
    this.type = "default";
    this.bodyInit = init;
    const { stream, size, contentType } = extractBody(init);
    if (contentType) {
      this.headers.set("Content-Type", contentType);
    }
    this.bodySize = size;
    this.bodyDelegate = new Body(stream, contentType);
  }

  private readonly bodyInit: BodyInit;
  readonly headers: Headers;
  readonly ok: boolean;
  readonly redirected: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly trailer: Promise<domTypes.Headers>;
  readonly type: domTypes.ResponseType;
  readonly url: string;

  get body(): ReadableStream | null {
    return this.bodyDelegate.stream;
  }

  get bodyUsed(): boolean {
    return this.bodyDelegate.bodyUsed;
  }

  private readonly bodyDelegate: Body;
  bodySize: number;

  arrayBuffer(): Promise<ArrayBuffer> {
    return this.bodyDelegate.arrayBuffer();
  }

  blob(): Promise<domTypes.Blob> {
    return this.bodyDelegate.blob();
  }

  formData(): Promise<FormData> {
    return this.bodyDelegate.formData();
  }

  json(): Promise<any> {
    return this.bodyDelegate.json();
  }

  text(): Promise<string> {
    return this.bodyDelegate.text();
  }

  clone(): Response {
    return new Response(this.bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    });
  }
}

//Copyright (c) 2014-2016 GitHub, Inc,
//Copyright (c) 2019 Yusuke Sakurai
// MIT License.
import { Body, BodyInit, BodyMixin, extractBody } from "./body.ts";
import { normalizeMethod, unmarshalHeaders } from "./util.ts";
import { ReadableStream } from "https://denopkg.com/keroxp/deno-streams/readable_stream.ts";

export interface RequestInit {
  body?: BodyInit | null;
  cache?: domTypes.RequestCache;
  credentials?: domTypes.RequestCredentials;
  headers?: domTypes.HeadersInit;
  integrity?: string;
  keepalive?: boolean;
  method?: string;
  mode?: domTypes.RequestMode;
  redirect?: domTypes.RequestRedirect;
  referrer?: string;
  referrerPolicy?: domTypes.ReferrerPolicy;
  signal?: domTypes.AbortSignal | null;
  window?: any;
}

export class Request implements BodyMixin {
  constructor(input: Request | string, options: RequestInit = {}) {
    let bodyInit = options.body;
    if (input instanceof Request) {
      if (input.bodyUsed) {
        throw new TypeError("Already read");
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
      this.headers = unmarshalHeaders(options.headers || {});
      this.method = input.method;
      this.mode = input.mode;
      this.signal = input.signal;
      if (!bodyInit && input.bodyInit !== null) {
        this.bodyInit = input.bodyInit;
      }
    } else {
      this.url = String(input);
    }

    this.credentials = options.credentials || this.credentials || "same-origin";
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers);
    }
    this.method = normalizeMethod(options.method || this.method || "GET");
    this.mode = options.mode || this.mode || null;
    this.signal = options.signal || this.signal;
    this.referrer = null;
    if ((this.method === "GET" || this.method === "HEAD") && bodyInit) {
      throw new TypeError("Body not allowed for GET or HEAD requests");
    }
    const { stream, size, contentType } = extractBody(bodyInit);
    this.bodyInit = bodyInit;
    this.bodySize = size;
    if (contentType) {
      this.headers.set("Content-Type", contentType);
    }
    this.bodyDelegate = new Body(stream, contentType);
  }

  cache: domTypes.RequestCache;
  credentials: domTypes.RequestCredentials;
  destination: domTypes.RequestDestination;
  headers: domTypes.Headers;
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

  get body(): ReadableStream | null {
    return this.bodyDelegate.stream;
  }

  get bodyUsed(): boolean {
    return this.bodyDelegate.bodyUsed;
  }

  private readonly bodyDelegate: Body;
  private readonly bodyInit: BodyInit;

  bodySize: number | null;

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

  clone(): Request {
    return new Request(this, { body: this.bodyInit });
  }
}

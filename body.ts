import {
  binaryArrayToBytes,
  isArrayBufferView,
  readFullStream
} from "./util.ts";
import { ReadableStream } from "https://denopkg.com/keroxp/deno-streams/readable_stream.ts";
import { Multipart } from "./multipart.ts";
import { ReadableStreamDefaultReader } from "https://denopkg.com/keroxp/deno-streams/readable_stream_reader.ts";
import { defer } from "https://denopkg.com/keroxp/deno-streams/defer.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type BodyInit =
  | Blob
  | domTypes.BufferSource
  | FormData
  | URLSearchParams
  | ReadableStream<Uint8Array>
  | string;

export interface BodyMixin {
  readonly body: ReadableStream | null;
  readonly bodyUsed: boolean;

  arrayBuffer(): Promise<ArrayBuffer>;

  blob(): Promise<domTypes.Blob>;

  formData(): Promise<FormData>;

  json(): Promise<any>;

  text(): Promise<string>;
}

export class Body implements BodyMixin {
  private _bodyInit: BodyInit;
  public get bodyInit(): BodyInit {
    return this._bodyInit;
  }

  private _headers: Headers;
  public get headers(): Headers {
    return this._headers;
  }

  constructor(
    public readonly stream: ReadableStream<Uint8Array>,
    public readonly contentType: string
  ) {}

  get body(): ReadableStream {
    return this.stream;
  }

  get bodyUsed(): boolean {
    return this.body !== null && this.body.disturbed;
  }

  get bodyLocked(): boolean {
    return this.body !== null && this.body.locked;
  }

  private async readFullBody(): Promise<Uint8Array> {
    if (this.bodyUsed || this.bodyLocked) {
      throw new TypeError("body is locked or disturbed");
    }
    const stream = this.body || new ReadableStream<Uint8Array>({});
    return readFullStream(stream);
  }

  private bodyArrayBuffer: ArrayBuffer;

  async arrayBuffer(): Promise<ArrayBuffer> {
    if (this.bodyArrayBuffer) return this.bodyArrayBuffer;
    const bytes = await this.readFullBody();
    return bytes.buffer as ArrayBuffer;
  }

  private bodyBlob: Blob;

  async blob(): Promise<domTypes.Blob> {
    if (this.bodyBlob) return this.bodyBlob;
    return (this.bodyBlob = new Blob([await this.arrayBuffer()], {
      type: this.contentType
    }));
  }

  private bodyFormData: FormData;

  async formData(): Promise<domTypes.FormData> {
    if (this.bodyFormData) return this.bodyFormData;
    if (!this.contentType) throw new RangeError("body is not form data");
    if (this.contentType.match(/^application\/x-www-form-urlencoded/)) {
      // form
      const text = await this.text();
      const form = new FormData();
      text
        .trim()
        .split("&")
        .map(kv => kv.split("="))
        .map(kv => form.set(kv[0], kv[1]));
      return (this.bodyFormData = form);
    } else if (this.contentType.match(/^multipart\/form-data/)) {
      throw new Error("multipart formdata is not implemented");
    }
    throw new Error("body is not formData");
  }

  private bodyString: string;

  async json(): Promise<any> {
    this.bodyString = await this.text();
    return JSON.parse(this.bodyString);
  }

  async text(): Promise<string> {
    if (this.bodyString) return this.bodyString;
    return (this.bodyString = decoder.decode(await this.arrayBuffer()));
  }
}

export function extractBody(
  body: BodyInit
): {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number | null;
} {
  let contentType = null;
  let size = null;
  let stream = new ReadableStream<Uint8Array>({});
  if (body instanceof ReadableStream) {
    if (!(body.locked || body.disturbed)) {
      throw new Error("body stream is locked or disturbed");
    }
    stream = body;
  } else if (typeof body === "string") {
    contentType = "text/plain;charset=UTF-8";
    const bytes = encoder.encode(body);
    const controller = stream.readableStreamController;
    controller.enqueue(bytes);
    controller.close();
    size = bytes.byteLength;
  } else if (body instanceof ArrayBuffer) {
    const view = new Uint8Array(body);
    const controller = stream.readableStreamController;
    controller.enqueue(view);
    controller.close();
    size = view.byteLength;
  } else if (body instanceof Blob) {
    if (body.type && body.type !== "") {
      contentType = body.type;
    }
    stream = new ReadableStream({
      start: async controller => {
        return readBlob(body)
          .then(controller.enqueue)
          .then(controller.close)
          .catch(controller.error);
      }
    });
    size = body.size;
  } else if (body instanceof FormData) {
    const startDefer = defer<void>();
    stream = new ReadableStream({
      start: async _ => startDefer
    });
    const controller = stream.readableStreamController;
    const writer = {
      write: async p => {
        controller.enqueue(p);
        return p.byteLength;
      }
    };
    const multipart = new Multipart(writer);
    (async function a() {
      for (const [key, val] of body.entries()) {
        if (typeof val === "string") {
          await multipart.writeField(key, val);
        } else if (val) {
          const fw = multipart.createFormFile(key, val.name);
          await readBlob(val).then(fw.write);
        }
      }
      await multipart.close();
      await multipart.flush();
    })()
      .then(startDefer.resolve)
      .catch(startDefer.reject);
    contentType = multipart.formDataContentType();
  } else if (body instanceof URLSearchParams) {
    let res = "";
    const controller = stream.readableStreamController;
    for (const [key, val] of body.entries()) {
      res += `${key}=${val}&`;
    }
    const bytes = encoder.encode(res);
    controller.enqueue(bytes);
    controller.close();
    contentType = "application/x-www-form-urlencoded";
    size = bytes.byteLength;
  } else if (isArrayBufferView(body)) {
    const bytes = binaryArrayToBytes(body);
    const controller = stream.readableStreamController;
    controller.enqueue(bytes);
    controller.close();
    size = bytes.byteLength;
  } else {
    throw new Error("invalid input: " + body);
  }
  return { stream, contentType, size };
}

async function readBlob(blob: domTypes.Blob): Promise<Uint8Array> {
  const fileReader = null; //new FileReader();
  await new Promise(resolve => {
    fileReader.addEventListener("loadend", resolve);
    fileReader.readAsArrayBuffer(blob);
  });
  const { result } = fileReader;
  if (typeof result === "string") {
    return new TextEncoder().encode(result);
  } else if (result instanceof ArrayBuffer) {
    return new Uint8Array(result);
  }
  return null;
}

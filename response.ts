import {unmarshalHeaders} from "./util.ts";
import {Body} from "./body.ts";

export class Response extends Body implements domTypes.Response {
    constructor(init: domTypes.BodyInit, opts: {
        url?: string,
        status?: number,
        statusText?: string,
        headers?: domTypes.HeadersInit
    } = {}) {
        super(init);
        this.status = opts.status || 200;
        this.statusText = opts.statusText || "OK";
        this.url = opts.url || "";
        super._headers = unmarshalHeaders(opts.headers || {});
        this.ok = this.status < 300;
        this.type = "default";
        super.initBody(init, super.headers);
    }

    readonly ok: boolean;
    readonly redirected: boolean;
    readonly status: number;
    readonly statusText: string;
    readonly trailer: Promise<domTypes.Headers>;
    readonly type: domTypes.ResponseType;
    readonly url: string;

    clone(): domTypes.Response {
        return new Response(this.bodyInit, {
            status: this.status,
            statusText: this.statusText,
            headers: new Headers(this.headers),
            url: this.url
        });
    }

}
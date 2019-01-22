import {Reader} from "deno";

class ReadableStream implements ReadableStream {
    constructor(reader: Reader) {
    }

    readonly locked: boolean;

    cancel(): Promise<void> {
        return undefined;
    }

    getReader(): domTypes.ReadableStreamReader {
        return undefined;
    }
}

class ReadableStreamReaderImpl implements domTypes.ReadableStreamReader {
    private readonly buf: Uint8Array;
    private canceled = false;
    constructor(private reader: Reader, bufSize = 1024) {
        this.buf = new Uint8Array(bufSize)
    }

    cancel(): Promise<void> {
        this.canceled = true;
        return;
    }

    async read(): Promise<any> {
        if (this.canceled) {
            throw new Error("already canceled")
        }
        const {nread, eof} = await this.reader.read(this.buf);
        if (eof) {
            return {done: true, value: void 0}
        } else {
            return {done: false, value: this.buf.slice(0, nread)}
        }
    }

    releaseLock(): void {
    }

}
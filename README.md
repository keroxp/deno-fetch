# deno-fetch

WHATWG fetch for deno, based on [Dial](https://deno.land/typedoc/index.html#dial) and [streams](https://github.com/keroxp/deno-streams),
This is more compatible with [fetch standard](https://fetch.spec.whatwg.org) than deno's native fetch.

# Usage

```ts

import {fetch} from "https://denopkg.com/keroxp/deno-fetch/fetch.ts"

// GET
fetch("http://httpbin.org/get?deno=land")
    .then(body => body.json()})
    .then(console.log)

//POST (applicaton/x-www-form-urlencoded)
fetch("http://httpbin.org/post", new URLSearchParams({
    deno: "land"
})).then(body => body.json()).then(console.log)

```

### Download with ReadableStream Pipe

```ts
import { open } from "deno";
import { fetch } from "https://denopkg.com/keroxp/deno-fetch/fetch.ts";
import { WritableStream } from "https://denopkg.com/keroxp/deno-streams/writable_stream.ts";

const f = await open("out.json", "w+");
const dest = new WritableStream(f);
const resp = await fetch("http://httpbin.org/get?deno=land");
await resp.body.pipeTo(dest); // => respose is written to out.json
```

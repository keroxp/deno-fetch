import {
  test,
  assertEqual,
  runTests
} from "https://deno.land/x/testing/mod.ts";
import { fetch } from "./fetch.ts";
import { open } from "deno";
import { WritableStream } from "https://denopkg.com/keroxp/deno-streams/writable_stream.ts";
import { setFilter } from "https://deno.land/x/testing/testing.ts";
setFilter("File");
test(async function testGet() {
  const res = await fetch("http://httpbin.org/get?deno=land", {
    method: "GET"
  });
  console.log(await res.text());
  const js = await res.json();
  assertEqual(js["args"]["deno"], "land");
});

test(async function testPost() {
  const res = await fetch("http://httpbin.org/post", {
    method: "POST",
    body: new URLSearchParams({
      deno: "land"
    })
  });
  console.log(await res.text());
  const js = await res.json();
  assertEqual(js["form"]["deno"], "land");
});

test(async function testGetAndFile() {
  const f = await open("out.json", "w+");
  const dest = new WritableStream(f);
  const resp = await fetch("http://httpbin.org/get?deno=land");
  await resp.body.pipeTo(dest);
  assertEqual("closed", resp.body.state);
  assertEqual("closed", dest.state);
});
runTests();

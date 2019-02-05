import {
  assertEqual,
  runTests,
  setFilter,
  test
} from "https://deno.land/x/std@v0.2.8/testing/mod.ts";
import { fetch } from "./fetch.ts";
import { copy, open } from "deno";
import { ReadableStreamDenoReader } from "./util.ts";
import { readString } from "https://denopkg.com/keroxp/deno-request/strings.ts";
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
  const resp = await fetch("http://httpbin.org/get?deno=land");
  const src = new ReadableStreamDenoReader(resp.body);
  await copy(f, src).catch(e => f.close());
  assertEqual("closed", resp.body.state);
});

runTests();

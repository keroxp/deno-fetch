import {assertEqual, runTests, test} from "https://deno.land/x/testing/mod.ts";
import {fetch, request} from "./fetch.ts";
import {copy, open} from "deno";
import {setFilter} from "https://deno.land/x/testing/testing.ts";
import {ReadableStreamDenoReader, readString} from "./util.ts";

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

test(async function testRequest() {
  const {body} = await request("http://httpbin.org/get?deno=land");
  const str = await readString(body);
  const json = JSON.parse(str);
  assertEqual("land", json["args"]["deno"])
});
runTests();

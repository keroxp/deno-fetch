import {
  test,
  assertEqual,
  runTests
} from "https://deno.land/x/testing/mod.ts";
import { fetch } from "./fetch.ts";
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

runTests();

import assert from "node:assert/strict";
import { test } from "node:test";
import { readLimitedBody, readLimitedText, toLimitedRequest } from "../lib/request-body.js";

test("an oversized declared body is rejected before it is read", async () => {
	const request = new Request("https://example.test", { method: "POST", headers: { "Content-Length": "100" }, body: "x" });
	await assert.rejects(readLimitedBody(request, 4), error => error.status === 413);
	assert.equal(request.bodyUsed, false);
});
test("chunked oversized input is cancelled and limited by bytes", async () => {
	let cancelled = false;
	const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(5)); c.enqueue(new Uint8Array(5)); }, cancel() { cancelled = true; } });
	const request = new Request("https://example.test", { method: "POST", body: stream, duplex: "half" });
	await assert.rejects(readLimitedBody(request, 8), error => error.status === 413);
	assert.equal(cancelled, true);
});
test("UTF-8 text at the exact byte limit is accepted", async () => {
	const request = new Request("https://example.test", { method: "POST", body: "é" });
	assert.equal(await readLimitedText(request, 2), "é");
});
test("a stalled stream is timed out and cancelled", async () => {
	let cancelled = false;
	const request = new Request("https://example.test", { method: "POST", body: new ReadableStream({ cancel() { cancelled = true; } }), duplex: "half" });
	await assert.rejects(readLimitedBody(request, 8, 20), error => error.status === 408);
	assert.equal(cancelled, true);
});
test("a limited copy of a request keeps its method, headers and bytes, and refuses an oversized body", async () => {
	const original = new Request("https://example.test/api/jobs/send-batch?x=1", {
		method: "POST",
		headers: { "content-type": "application/json", "upstash-signature": "sig" },
		body: JSON.stringify({ messageIds: ["a"] }),
	});
	const copy = await toLimitedRequest(original, 1024);
	assert.equal(copy.url, original.url);
	assert.equal(copy.method, "POST");
	assert.equal(copy.headers.get("upstash-signature"), "sig");
	assert.equal(copy.headers.get("content-type"), "application/json");
	assert.deepEqual(await copy.json(), { messageIds: ["a"] });
	const get = new Request("https://example.test/");
	assert.equal(await toLimitedRequest(get, 1), get, "a GET has no body to read");
	const large = new Request("https://example.test/", { method: "POST", body: "x".repeat(2048) });
	await assert.rejects(toLimitedRequest(large, 1024), (error) => error.status === 413);
});

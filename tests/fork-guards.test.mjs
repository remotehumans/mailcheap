// ABOUTME: Remote Humans' own guards on top of upstream: the SIGNUPS_ENABLED switch on every public form, the body limit
// ABOUTME: on Better Auth's routes, and share images that only read logos from public/.
import assert from "node:assert/strict";
import { test } from "node:test";
import { withEnv } from "./helpers/app.mjs";

const NEWSLETTER_ID = "0123456789abcdef01234567";

function formData(fields) {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

test("with SIGNUPS_ENABLED=false the website and embedded forms refuse signups before anything else", async () => {
	const { subscribe } = await import("../app/archive/actions.js");
	const embed = await import("../app/api/embed/[id]/route.js");
	await withEnv({ SIGNUPS_ENABLED: "false" }, async () => {
		assert.deepEqual(await subscribe(null, formData({ email: "reader@example.org", newsletter: "bring-your-own-brain" })), {
			error: "Signups are not open yet",
		});
		const response = await embed.POST(
			new Request(`http://localhost:3000/api/embed/${NEWSLETTER_ID}`, {
				method: "POST",
				headers: { "content-type": "application/json", accept: "application/json" },
				body: JSON.stringify({ email: "reader@example.org" }),
			}),
			{ params: Promise.resolve({ id: NEWSLETTER_ID }) }
		);
		assert.equal(response.status, 503);
		assert.deepEqual(await response.json(), { error: "Signups are not open yet" });
	});
});

test("an embedded form's body is read within its limit", async () => {
	const embed = await import("../app/api/embed/[id]/route.js");
	const response = await embed.POST(
		new Request(`http://localhost:3000/api/embed/${NEWSLETTER_ID}`, {
			method: "POST",
			headers: { "content-type": "application/json", accept: "application/json" },
			body: JSON.stringify({ email: "reader@example.org", first_name: "x".repeat(32 * 1024) }),
		}),
		{ params: Promise.resolve({ id: NEWSLETTER_ID }) }
	);
	assert.equal(response.status, 400);
});

test("Better Auth's routes refuse an oversized body before reading it", async () => {
	const { handleAuthRequest } = await import("../lib/auth.js");
	const declared = await handleAuthRequest(
		new Request("http://localhost:3000/api/auth/oauth2/register", { method: "POST", headers: { "content-length": String(1024 * 1024) }, body: "{}" })
	);
	assert.equal(declared.status, 413);
	const streamed = await handleAuthRequest(
		new Request("http://localhost:3000/api/auth/oauth2/register", { method: "POST", body: "x".repeat(128 * 1024) })
	);
	assert.equal(streamed.status, 413);
});

test("a share image's local logo is read from public/ only", async () => {
	const { loadImage } = await import("../lib/og-image.js");
	assert.match(await loadImage("/icon-192.png"), /^data:image\/png;base64,/);
	assert.equal(await loadImage("/../package.json"), null);
	assert.equal(await loadImage("/../../../../etc/hosts"), null);
	assert.equal(await loadImage("/logos/../../../package.json"), null);
});

// ABOUTME: The single-admin to account-model migration on a database shaped like the old release's, indexes included.
// ABOUTME: Afterwards the reader site's signup call works with its old key and the owner's code sign-in finds the migrated account.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import { migrateToAccounts } from "../scripts/migrate-to-accounts.mjs";
import { callApi, signIn, startTestApp, withEnv } from "./helpers/app.mjs";

const OWNER = "owner@example.com";
// A key made by the single-admin release: no level, no account.
const OLD_KEY = `mc_${"A1b2_C3d4-".repeat(4)}xyz`;
const SLUG = "bring-your-own-brain";
const SEEDED_AT = new Date("2026-10-20T09:00:00Z");

let app;
let db;
let newsletterId;
let migratedAccountId;
let visitor = 0;

async function seedSingleAdminDatabase() {
	newsletterId = new mongoose.Types.ObjectId();
	const contactId = new mongoose.Types.ObjectId();
	const stamps = { createdAt: SEEDED_AT, updatedAt: SEEDED_AT };
	await db.collection("newsletters").insertOne({
		_id: newsletterId,
		name: "Bring Your Own Brain",
		slug: SLUG,
		fromName: "Remote Humans",
		fromEmail: "byob@mail.example.com",
		replyTo: "editor@example.com",
		postalAddress: "1 Main St, London",
		requireConfirmation: true,
		archiveEnabled: false,
		...stamps,
	});
	await db.collection("contacts").insertMany([
		{ _id: contactId, newsletterId, email: "reader@example.org", status: "pending", source: "byob", subscribedAt: SEEDED_AT, stats: { sent: 0, opens: 0, clicks: 0 }, ...stamps },
		{ newsletterId, email: "fan@example.org", status: "active", source: "byob", subscribedAt: SEEDED_AT, confirmedAt: SEEDED_AT, stats: { sent: 1, opens: 0, clicks: 0 }, ...stamps },
	]);
	await db.collection("apikeys").insertOne({
		name: "BYOB reader",
		prefix: `${OLD_KEY.slice(0, 10)}…`,
		hash: crypto.createHash("sha256").update(OLD_KEY).digest("hex"),
		...stamps,
	});
	await db.collection("messages").insertOne({ newsletterId, contactId, kind: "confirmation", status: "sent", sesMessageId: "ses-0001", sentAt: SEEDED_AT, ...stamps });
	await db.collection("events").insertOne({ sesMessageId: "ses-0001", type: "delivery", occurredAt: SEEDED_AT, ...stamps });
	await db.collection("suppressions").insertOne({ email: "bounced@example.org", reason: "bounce", ...stamps });
	await db.collection("alerts").insertOne({ key: "api-signup-flood:old", title: "API signups paused", lastSentAt: SEEDED_AT, ...stamps });

	// The single-admin release's indexes, as its models built them.
	await db.collection("contacts").createIndex({ newsletterId: 1, email: 1 }, { unique: true });
	await db.collection("contacts").createIndex({ email: 1 });
	await db.collection("contacts").createIndex({ subscribedAt: -1, _id: -1 });
	await db.collection("contacts").createIndex({ status: 1, subscribedAt: -1, _id: -1 });
	await db.collection("campaigns").createIndex({ status: 1 });
	await db.collection("campaigns").createIndex({ startedAt: -1 });
	await db.collection("messages").createIndex({ sesMessageId: 1 }, { sparse: true });
	await db.collection("events").createIndex({ sesMessageId: 1 });
	await db.collection("suppressions").createIndex({ email: 1 }, { unique: true });
	await db.collection("alerts").createIndex({ key: 1 }, { unique: true });
}

async function indexNames(collection) {
	return (await db.collection(collection).indexes()).map(({ name }) => name);
}

function signup(email, body = {}) {
	return callApi("POST", "/api/v1/contacts", {
		key: OLD_KEY,
		body: { newsletter: SLUG, email, source: "byob", resubscribe: true, ip: `203.0.113.${++visitor}`, ...body },
	});
}

before(async () => {
	app = await startTestApp({ MAILCHEAP_CLOUD: "", ADMIN_EMAILS: OWNER, EMAIL_FROM: "Remote Humans <login@mail.example.com>", SENDING_ENABLED: "false" });
	db = mongoose.connection.db;
	await seedSingleAdminDatabase();
});

after(() => app?.stop());

test("an owner who isn't in ADMIN_EMAILS is refused before anything is written", async () => {
	await assert.rejects(migrateToAccounts(db, { ownerEmail: "someone@example.com", adminEmails: OWNER, apply: true }), /must be in ADMIN_EMAILS/);
	await assert.rejects(migrateToAccounts(db, { ownerEmail: "", adminEmails: OWNER, apply: true }), /Pass the owner's email/);
	assert.equal(await db.collection("users").countDocuments(), 0);
	assert.equal(await db.collection("accounts").countDocuments(), 0);
});

test("a dry run says what it would change and writes nothing", async () => {
	const report = await migrateToAccounts(db, { ownerEmail: ` ${OWNER.toUpperCase()} `, adminEmails: `admin@example.net, ${OWNER}` });
	assert.equal(report.apply, false);
	assert.equal(report.owner, OWNER);
	assert.equal(report.user, "created");
	assert.equal(report.account, "created");
	assert.deepEqual(report.assigned, { newsletters: 1, contacts: 2, campaigns: 0, messages: 1, events: 1, apikeys: 1, suppressions: 1 });
	assert.deepEqual(report.renamed, { messages: 1, events: 1 });
	assert.deepEqual(report.droppedIndexes, [
		"contacts.email_1",
		"contacts.subscribedAt_-1__id_-1",
		"contacts.status_1_subscribedAt_-1__id_-1",
		"campaigns.status_1",
		"campaigns.startedAt_-1",
		"messages.sesMessageId_1",
		"events.sesMessageId_1",
		"suppressions.email_1",
		"alerts.key_1",
	]);
	assert.deepEqual(report.createdIndexes, ["contacts.email_1"]);

	assert.equal(await db.collection("users").countDocuments(), 0);
	assert.equal(await db.collection("accounts").countDocuments(), 0);
	assert.equal(await db.collection("contacts").countDocuments({ accountId: { $exists: true } }), 0);
	assert.equal(await db.collection("messages").countDocuments({ sesMessageId: "ses-0001" }), 1);
	assert.ok((await indexNames("alerts")).includes("key_1"));
});

test("applied, every document joins the owner's account, and a second run changes nothing", async () => {
	const report = await migrateToAccounts(db, { ownerEmail: OWNER, adminEmails: OWNER, apply: true });
	migratedAccountId = new mongoose.Types.ObjectId(report.accountId);

	const user = await db.collection("users").findOne({ email: OWNER });
	assert.equal(user.emailVerified, true, "keys only work for an owner with a verified email");
	const account = await db.collection("accounts").findOne({ _id: migratedAccountId });
	assert.deepEqual(account.ownerId, user._id);
	assert.equal(account.status, "active");
	for (const name of ["newsletters", "contacts", "messages", "events", "apikeys", "suppressions"]) {
		assert.equal(await db.collection(name).countDocuments({ accountId: { $ne: migratedAccountId } }), 0, name);
	}
	assert.equal(await db.collection("messages").countDocuments({ providerMessageId: "ses-0001", sesMessageId: { $exists: false } }), 1);
	assert.equal(await db.collection("events").countDocuments({ providerMessageId: "ses-0001" }), 1);
	for (const [collection, name] of [["alerts", "key_1"], ["suppressions", "email_1"], ["messages", "sesMessageId_1"], ["campaigns", "status_1"]]) {
		assert.equal((await indexNames(collection)).includes(name), false, `${collection}.${name}`);
	}
	const emailIndex = (await db.collection("contacts").indexes()).find(({ name }) => name === "email_1");
	assert.deepEqual(emailIndex.partialFilterExpression, { undeliverableAt: { $exists: true } });

	const again = await migrateToAccounts(db, { ownerEmail: OWNER, adminEmails: OWNER, apply: true });
	assert.equal(again.user, "existing");
	assert.equal(again.account, "existing");
	assert.equal(again.accountId, report.accountId);
	assert.deepEqual(Object.values(again.assigned), [0, 0, 0, 0, 0, 0, 0]);
	assert.deepEqual(again.renamed, { messages: 0, events: 0 });
	assert.deepEqual(again.droppedIndexes, []);
	assert.deepEqual(again.createdIndexes, []);
});

test("the models build every index of theirs on the migrated collections", async () => {
	const models = await Promise.all(
		["Contact", "Campaign", "Message", "Event", "ApiKey", "Suppression", "Alert", "Newsletter"].map(async (name) => (await import(`../models/${name}.js`)).default)
	);
	for (const model of models) await model.init();
	for (const model of models) await model.createIndexes();
});

test("the reader site's signup call works with its old key", async () => {
	const added = await signup("new-reader@example.org");
	assert.equal(added.status, 201, JSON.stringify(added.body));
	assert.equal(added.body.status, "pending", "confirmed opt-in stays on");
	assert.equal(added.body.created, true);
	const stored = await db.collection("contacts").findOne({ email: "new-reader@example.org" });
	assert.deepEqual(stored.accountId, migratedAccountId);
	assert.deepEqual(stored.newsletterId, newsletterId);
	assert.equal(stored.source, "byob");

	const again = await signup("new-reader@example.org");
	assert.equal(again.status, 200);
	assert.equal(again.body.created, false);
	const existing = await signup("reader@example.org");
	assert.equal(existing.status, 200, "a contact from before the migration is found");
	assert.equal(existing.body.created, false);

	assert.equal((await signup("not-an-email")).status, 400);
	await withEnv({ SIGNUPS_ENABLED: "false" }, async () => {
		const closed = await signup("later@example.org");
		assert.equal(closed.status, 503);
		assert.equal(closed.body.error.message, "Signups are not open yet");
	});
	assert.equal(await db.collection("contacts").countDocuments({ email: "later@example.org" }), 0);
});

test("the owner's first code sign-in lands in the migrated account", async () => {
	const user = await signIn(OWNER);
	assert.deepEqual(user.accountId, migratedAccountId);
	assert.equal(await db.collection("users").countDocuments(), 1);
	assert.equal(await db.collection("accounts").countDocuments(), 1);
});

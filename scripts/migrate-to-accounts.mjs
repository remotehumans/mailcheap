// ABOUTME: One-time upgrade of a single-admin Mailcheap database to the account model: every document gets the owner's accountId.
// ABOUTME: Dry run by default; --apply writes. Safe to run again: it only touches what is still unmigrated.
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

// The single-admin release's collections. Each one is account scoped now (lib/account-scope.js), and a query without
// accountId never finds an old document.
export const SCOPED_COLLECTIONS = ["newsletters", "contacts", "campaigns", "messages", "events", "apikeys", "suppressions"];

// Indexes the account model replaced. contacts email_1 must go: the new email_1 is partial, so MongoDB refuses to build
// it while the old one exists. The unique ones would stop two accounts from holding the same key or address.
export const OBSOLETE_INDEXES = [
	{ collection: "contacts", name: "email_1", unlessPartial: true },
	{ collection: "contacts", name: "subscribedAt_-1__id_-1" },
	{ collection: "contacts", name: "status_1_subscribedAt_-1__id_-1" },
	{ collection: "campaigns", name: "status_1" },
	{ collection: "campaigns", name: "startedAt_-1" },
	{ collection: "messages", name: "sesMessageId_1" },
	{ collection: "events", name: "sesMessageId_1" },
	{ collection: "suppressions", name: "email_1" },
	{ collection: "alerts", name: "key_1" },
];

// Built here instead of waiting for the next restart: models/Contact.js has it, and a server that started before the
// migration couldn't build it.
const CONTACT_EMAIL_INDEX = { key: { email: 1 }, name: "email_1", partialFilterExpression: { undeliverableAt: { $exists: true } } };

const UNMIGRATED = { accountId: { $exists: false } };

function readList(value) {
	return String(value ?? "")
		.split(",")
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);
}

async function listIndexes(db, collection) {
	try {
		return await db.collection(collection).indexes();
	} catch (error) {
		if (error?.codeName === "NamespaceNotFound") return [];
		throw error;
	}
}

// The owner signs in with a code to ADMIN_EMAILS' address, and an API key only works while its account's owner has a
// verified email on the allowlist (lib/api-keys.js), so the owner has to be listed before anything moves.
export async function migrateToAccounts(db, { ownerEmail, adminEmails, apply = false, now = new Date() }) {
	const email = String(ownerEmail ?? "").trim().toLowerCase();
	if (!email) throw new Error("Pass the owner's email: --owner-email=<address in ADMIN_EMAILS>");
	if (!readList(adminEmails).includes(email)) throw new Error("The owner's email must be in ADMIN_EMAILS, or its account's API keys stop working");

	const report = { apply, owner: email, user: null, account: null, assigned: {}, renamed: {}, droppedIndexes: [], createdIndexes: [] };
	const users = db.collection("users");
	const accounts = db.collection("accounts");

	// Better Auth's user fields (name, email, emailVerified, image, timestamps). The first code sign-in finds this user
	// and signs in to it; lib/accounts.js createAccount then finds its account already there.
	let user = await users.findOne({ email });
	if (!user) {
		report.user = "created";
		user = { _id: new mongoose.Types.ObjectId(), name: "", email, emailVerified: true, image: null, createdAt: now, updatedAt: now };
		if (apply) await users.insertOne(user);
	} else if (user.emailVerified !== true) {
		report.user = "verified";
		if (apply) await users.updateOne({ _id: user._id }, { $set: { emailVerified: true, updatedAt: now } });
	} else {
		report.user = "existing";
	}

	const others = await accounts.countDocuments({ ownerId: { $ne: user._id } });
	if (others > 0) throw new Error(`${others} other account(s) exist: unmigrated documents can't be given to one owner safely`);

	// The defaults Mongoose gives a new Account (models/Account.js).
	let account = await accounts.findOne({ ownerId: user._id });
	if (!account) {
		report.account = "created";
		account = { _id: new mongoose.Types.ObjectId(), ownerId: user._id, status: "active", usage: { emailsSent: 0 }, createdAt: now, updatedAt: now };
		if (apply) await accounts.insertOne(account);
	} else {
		report.account = "existing";
	}
	report.accountId = String(account._id);

	for (const name of SCOPED_COLLECTIONS) {
		const collection = db.collection(name);
		report.assigned[name] = apply
			? (await collection.updateMany(UNMIGRATED, { $set: { accountId: account._id } })).modifiedCount
			: await collection.countDocuments(UNMIGRATED);
	}

	// Message and Event name the provider's id providerMessageId now that PostShiba sends too.
	for (const name of ["messages", "events"]) {
		const filter = { sesMessageId: { $exists: true }, providerMessageId: { $exists: false } };
		const collection = db.collection(name);
		report.renamed[name] = apply
			? (await collection.updateMany(filter, { $rename: { sesMessageId: "providerMessageId" } })).modifiedCount
			: await collection.countDocuments(filter);
	}

	for (const { collection, name, unlessPartial } of OBSOLETE_INDEXES) {
		const index = (await listIndexes(db, collection)).find((existing) => existing.name === name);
		if (!index || (unlessPartial && index.partialFilterExpression)) continue;
		report.droppedIndexes.push(`${collection}.${name}`);
		if (apply) await db.collection(collection).dropIndex(name);
	}

	const contactIndexes = await listIndexes(db, "contacts");
	const hasPartialEmail = contactIndexes.some((index) => index.name === CONTACT_EMAIL_INDEX.name && index.partialFilterExpression);
	if (!hasPartialEmail) {
		report.createdIndexes.push(`contacts.${CONTACT_EMAIL_INDEX.name}`);
		if (apply) {
			const { key, ...options } = CONTACT_EMAIL_INDEX;
			await db.collection("contacts").createIndex(key, options);
		}
	}
	return report;
}

function readArgs(argv) {
	const args = { apply: argv.includes("--apply") };
	const owner = argv.find((arg) => arg.startsWith("--owner-email="));
	args.ownerEmail = owner?.slice("--owner-email=".length);
	return args;
}

async function main() {
	if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
	const { apply, ownerEmail } = readArgs(process.argv.slice(2));
	await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
	try {
		const report = await migrateToAccounts(mongoose.connection.db, { ownerEmail, adminEmails: process.env.ADMIN_EMAILS, apply });
		console.log(JSON.stringify(report, null, 2));
		if (!apply) console.log("Dry run: nothing was written. Run again with --apply to migrate.");
	} finally {
		await mongoose.disconnect();
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(`Migration failed: ${error.message}`);
		process.exitCode = 1;
	});
}

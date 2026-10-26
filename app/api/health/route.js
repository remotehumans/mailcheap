import { NextResponse } from "next/server";
import { areSignupsEnabled, getConfigProblems, isSendingEnabled } from "@/lib/config";
import { connectDb } from "@/lib/db";

// Read on every request: it reports the environment the server runs with, not the one it was built with.
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

// For uptime checks. A server set up in a way it refuses to run with (instrumentation.js) answers 503 and why.
// The database ping makes the container health check fail while MongoDB is unreachable. Only readiness and the
// two feature flags are reported, never credentials.
export async function GET() {
	const problems = getConfigProblems();
	if (problems.length > 0) return NextResponse.json({ ok: false, problems }, { status: 503, headers: NO_STORE });
	try {
		const db = await connectDb();
		await db.connection.db.command({ ping: 1 });
	} catch {
		return NextResponse.json({ ok: false, problems: ["The database is unreachable."] }, { status: 503, headers: NO_STORE });
	}
	return NextResponse.json(
		{ ok: true, sendingEnabled: isSendingEnabled(), signupsEnabled: areSignupsEnabled() },
		{ headers: NO_STORE }
	);
}

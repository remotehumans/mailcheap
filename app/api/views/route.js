import { connectDb } from "@/lib/db";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { isObjectIdString } from "@/lib/validation";
import Campaign from "@/models/Campaign";

const BOT_PATTERN = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|curl|wget|python|axios|go-http/i;
const RATE_LIMIT = { name: "views", limit: 30, window: "10 m" };

function noContent() {
	return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

// Archive pages send one beacon per issue per browser and day; this only counts the ones from people.
export async function POST(request) {
	const userAgent = request.headers.get("user-agent") ?? "";
	let body;
	try { body = JSON.parse(await readLimitedText(request, 2048)); }
	catch (error) { return NextResponse.json({ error: "Invalid request body" }, { status: error.status || 400 }); }
	const { id } = body || {};
	if (!isObjectIdString(id) || !userAgent || BOT_PATTERN.test(userAgent)) return noContent();
	if (await isRateLimited({ ...RATE_LIMIT, key: getClientIp(request.headers) })) return noContent();

	await connectDb();
	await Campaign.updateOne(
		{ _id: id, archiveSlug: { $type: "string" }, status: { $in: ["sending", "paused", "sent"] } },
		{ $inc: { webViews: 1 } }
	);
	return noContent();
}

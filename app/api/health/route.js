import { connectDb } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
 try {
  const db = await connectDb();
  await db.connection.db.command({ ping: 1 });
  return Response.json({ ok: true, sendingEnabled: process.env.SENDING_ENABLED === "true", signupsEnabled: process.env.SIGNUPS_ENABLED !== "false" }, { headers: { "Cache-Control": "no-store" } });
 } catch { return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}

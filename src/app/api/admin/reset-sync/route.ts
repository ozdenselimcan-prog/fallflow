import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { saveConnection, type ConnectionProvider } from "@/lib/integrations/connections-store";

/** Temporäres Admin-Werkzeug: setzt den Mail-Sync-Zeitpunkt zurück, um dieselbe Testmail erneut zu verarbeiten. */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { companyId?: string; provider?: string; before?: string };
  if (!body.companyId || !body.provider) return NextResponse.json({ error: "companyId und provider erforderlich" }, { status: 400 });
  await saveConnection({ companyId: body.companyId, provider: body.provider as ConnectionProvider, lastSyncedAt: body.before ?? null });
  return NextResponse.json({ ok: true });
}

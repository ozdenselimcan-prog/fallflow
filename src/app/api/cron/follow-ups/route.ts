import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { listAllStores } from "@/lib/data";
import { dispatchDueFollowUps } from "@/lib/intake/follow-ups";

/**
 * Cron-Endpunkt (siehe vercel.json): verarbeitet fällige Follow-ups aller Büros. Geschützt durch CRON_SECRET
 * (Vercel sendet es automatisch als Bearer-Token). Ohne verbundenen Kanal werden Follow-ups auf „manuell“ gesetzt.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET ist nicht gesetzt." }, { status: 503 });
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const totals = { companies: 0, due: 0, sent: 0, manual: 0, cancelled: 0 };
  for (const store of await listAllStores()) {
    const r = await dispatchDueFollowUps(store);
    totals.companies++;
    totals.due += r.due;
    totals.sent += r.sent;
    totals.manual += r.manual;
    totals.cancelled += r.cancelled;
  }
  return NextResponse.json(totals);
}

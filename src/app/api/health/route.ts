import { NextResponse } from "next/server";
import { mailHealth } from "@/lib/admin/overview";

export const dynamic = "force-dynamic";

/**
 * Öffentlicher Gesundheits-Check für einen Uptime-Monitor (z. B. UptimeRobot): 200 = alles in Ordnung,
 * 503 = mindestens ein Postfach hat einen Fehler oder wurde seit über 3 Stunden nicht mehr abgerufen (z. B. weil
 * der Cron-Job steht). Enthält nur Zahlen, keine Büro- oder Kundendaten.
 */
export async function GET() {
  try {
    const health = await mailHealth();
    if (!health) return NextResponse.json({ status: "ok", note: "Demo-Modus" });
    return NextResponse.json({ status: health.ok ? "ok" : "degraded", ...health, checkedAt: new Date().toISOString() }, { status: health.ok ? 200 : 503 });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { mailHealth } from "@/lib/admin/overview";
import { aiHealth } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

/**
 * Öffentlicher Gesundheits-Check für einen Uptime-Monitor (z. B. UptimeRobot): 200 = alles in Ordnung,
 * 503 = ein Postfach hat einen Fehler bzw. wurde seit über 3 Stunden nicht abgerufen, oder die KI ist nicht nutzbar
 * (z. B. OpenAI-Guthaben aufgebraucht). Enthält nur Zahlen/Status, keine Büro- oder Kundendaten.
 */
export async function GET() {
  try {
    const [health, ai] = await Promise.all([mailHealth(), aiHealth()]);
    const aiOk = ai === "ok" || ai === "not_configured";
    if (!health) return NextResponse.json({ status: aiOk ? "ok" : "degraded", ai, note: "Demo-Modus" }, { status: aiOk ? 200 : 503 });
    const ok = health.ok && aiOk;
    return NextResponse.json({ status: ok ? "ok" : "degraded", ai, ...health, checkedAt: new Date().toISOString() }, { status: ok ? 200 : 503 });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}

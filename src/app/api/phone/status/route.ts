import { NextResponse, type NextRequest } from "next/server";
import { callEnded } from "@/lib/phone/voice";
import { readTwilioRequest } from "@/lib/phone/webhook";

/** Twilio: Status des Anrufs hat sich geändert ("Call status changes") – bei Ende die Dauer speichern. */
export async function POST(req: NextRequest) {
  const r = await readTwilioRequest(req);
  if ("error" in r) return r.error;
  const status = r.params.CallStatus ?? "";
  if (["completed", "busy", "failed", "no-answer", "canceled"].includes(status)) {
    await callEnded({ callSid: r.params.CallSid ?? "", status, durationSec: Number(r.params.CallDuration ?? 0) || 0 }).catch((err) =>
      console.error("[phone] Anrufdauer nicht gespeichert:", err instanceof Error ? err.message : "unbekannt"),
    );
  }
  return new NextResponse(null, { status: 204 });
}

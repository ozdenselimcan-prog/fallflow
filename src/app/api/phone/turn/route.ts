import type { NextRequest } from "next/server";
import { callTurn } from "@/lib/phone/voice";
import { readTwilioRequest, twimlResponse } from "@/lib/phone/webhook";
import { twiml } from "@/lib/phone/twilio";

// KI-Erkennung und Fallakte brauchen ein paar Sekunden – Twilio wartet bis zu 15 Sekunden.
export const maxDuration = 30;

/** Twilio: Der Anrufer hat etwas gesagt (SpeechResult) – nächste Frage oder Verabschiedung zurückgeben. */
export async function POST(req: NextRequest) {
  const r = await readTwilioRequest(req);
  if ("error" in r) return r.error;
  try {
    const attempt = Number(req.nextUrl.searchParams.get("attempt") ?? 0) || 0;
    return twimlResponse(await callTurn({ callSid: r.params.CallSid ?? "", from: r.params.From ?? "", to: r.params.To ?? "", speech: r.params.SpeechResult ?? "", attempt }));
  } catch (err) {
    console.error("[phone] Gesprächszug fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    return twimlResponse(twiml([{ say: "Entschuldigung, da ist etwas schiefgelaufen. Ihr Anliegen ist notiert, wir melden uns bei Ihnen. Auf Wiederhören." }, { hangup: true }]));
  }
}

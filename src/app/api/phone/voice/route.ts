import type { NextRequest } from "next/server";
import { incomingCall } from "@/lib/phone/voice";
import { readTwilioRequest, twimlResponse } from "@/lib/phone/webhook";
import { twiml } from "@/lib/phone/twilio";

/** Twilio: Anruf auf einer FallFlow-Nummer geht ein (in der Nummer als "A call comes in" hinterlegt). */
export async function POST(req: NextRequest) {
  const r = await readTwilioRequest(req);
  if ("error" in r) return r.error;
  try {
    return twimlResponse(await incomingCall({ callSid: r.params.CallSid ?? "", from: r.params.From ?? "", to: r.params.To ?? "" }));
  } catch (err) {
    console.error("[phone] Anruf konnte nicht angenommen werden:", err instanceof Error ? err.message : "unbekannt");
    return twimlResponse(twiml([{ say: "Es ist ein technischer Fehler aufgetreten. Bitte versuchen Sie es später noch einmal." }, { hangup: true }]));
  }
}

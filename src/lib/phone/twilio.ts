import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio-Anbindung ohne SDK: Prüfung der Webhook-Signatur und kleine TwiML-Bausteine (die XML-Antwort, mit der wir
 * Twilio sagen, was am Telefon passieren soll – vorlesen, zuhören, auflegen).
 */

/** Prüft X-Twilio-Signature: HMAC-SHA1 über die aufgerufene URL + alle POST-Parameter (alphabetisch, Name+Wert). */
export function validTwilioSignature(authToken: string, url: string, params: Record<string, string>, signature: string | null): boolean {
  if (!signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

const escapeXml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

/** Deutsche Neural-Stimme (Amazon Polly über Twilio). */
const VOICE = 'language="de-DE" voice="Polly.Vicki-Neural"';

/** Text für die Sprachausgabe säubern: keine Links, Sternchen o. Ä. vorlesen. */
export function speakable(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "")
    // Formulierungen aus dem Chat für das Telefon anpassen
    .replace(/schreiben Sie mir einfach die Korrektur/g, "sagen Sie es mir einfach")
    .replace(/\(z\. B\. („[^)]*)\)/g, "Zum Beispiel $1.")
    .replace(/\bm²/g, "Quadratmeter")
    .replace(/\bz\. B\./g, "zum Beispiel")
    .replace(/[*_#`>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

export type TwimlPart = { say: string } | { gather: { action: string; prompt: string; hints?: string[] } } | { hangup: true } | { pause: number };

/** Baut die TwiML-Antwort. Nach einem Gather ohne Ergebnis ruft Twilio die action-URL mit leerem SpeechResult auf. */
export function twiml(parts: TwimlPart[]): string {
  const body = parts
    .map((p) => {
      if ("say" in p) return p.say ? `<Say ${VOICE}>${escapeXml(speakable(p.say))}</Say>` : "";
      if ("pause" in p) return `<Pause length="${Math.max(1, Math.round(p.pause))}"/>`;
      if ("hangup" in p) return "<Hangup/>";
      const hints = p.gather.hints?.length ? ` hints="${escapeXml(p.gather.hints.join(", ").slice(0, 900))}"` : "";
      return `<Gather input="speech" language="de-DE" speechTimeout="auto" timeout="6" actionOnEmptyResult="true" method="POST" action="${escapeXml(p.gather.action)}"${hints}>${p.gather.prompt ? `<Say ${VOICE}>${escapeXml(speakable(p.gather.prompt))}</Say>` : ""}</Gather>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

/** Twilio-Telefonnummer in E.164 (+49…) bringen – so steht sie in phone_numbers. */
export function e164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0")) return `+49${digits.slice(1)}`;
  return digits ? `+${digits}` : "";
}

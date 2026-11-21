import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { receiveForwardedMail } from "@/lib/integrations/forwarding";

// Die KI braucht für Prüfung und Antwort einige Sekunden; der Mailserver wartet so lange auf das Ergebnis.
export const maxDuration = 300;

/**
 * Nimmt Mails an die Weiterleitungs-Adressen entgegen. Aufgerufen nur vom eigenen Mailserver auf demselben Server
 * (deploy/mail-inbound.mjs), geschützt durch CRON_SECRET. Antwort 404 = keine solche Adresse (der Mailserver lehnt die
 * Mail dann ab), 5xx = später erneut zustellen.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET ist nicht gesetzt." }, { status: 503 });
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { recipients?: unknown; raw?: unknown } | null;
  const recipients = Array.isArray(body?.recipients) ? body.recipients.filter((r): r is string => typeof r === "string") : [];
  if (!recipients.length || typeof body?.raw !== "string") return NextResponse.json({ error: "recipients und raw fehlen" }, { status: 400 });
  try {
    const result = await receiveForwardedMail(recipients, Buffer.from(body.raw, "base64"));
    if (result === "unknown-recipient") return NextResponse.json({ error: "Unbekannte Adresse" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[forward] Mail konnte nicht verarbeitet werden:", err instanceof Error ? err.message : "unbekannt");
    return NextResponse.json({ error: "Verarbeitung fehlgeschlagen" }, { status: 500 });
  }
}

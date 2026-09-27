import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicStore } from "@/lib/data";
import { findCompanyByWhatsAppPhoneId } from "@/lib/integrations/connections-store";
import { appConfigured, parseWebhook, verifyWebhook } from "@/lib/integrations/whatsapp";
import { routeInbound } from "@/lib/intake/router";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Meta-Webhook-Verifizierung. Ohne FallFlow-App-Konfiguration: Mock-Antwort, keine Fake-Integration. */
export async function GET(req: NextRequest) {
  if (!appConfigured()) return NextResponse.json({ mock: true, message: "WhatsApp ist bei FallFlow noch nicht konfiguriert." });
  const p = req.nextUrl.searchParams;
  const challenge = verifyWebhook(p.get("hub.mode"), p.get("hub.verify_token"), p.get("hub.challenge"));
  return challenge === null ? new NextResponse("Forbidden", { status: 403 }) : new NextResponse(challenge);
}

function validSignature(raw: string, header: string | null, secret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const given = Buffer.from(header.slice(7), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Eingehende WhatsApp-Nachrichten aller Büros landen an diesem einen Meta-App-Webhook.
 * Die Telefonnummer-ID im Payload (metadata.phone_number_id) identifiziert, welches Büro seinen
 * WhatsApp-Anschluss darauf verbunden hat (siehe connections-store.ts) – Nachrichten werden strikt
 * auf dessen Company beschränkt weiterverarbeitet.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`wa:${clientIp(req)}`, 120, 60_000)) return new NextResponse("Too Many Requests", { status: 429 });
  if (!appConfigured()) return NextResponse.json({ mock: true, received: false });

  const secret = process.env.WHATSAPP_APP_SECRET!;
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"), secret)) return new NextResponse("Forbidden", { status: 403 });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const messages = parseWebhook(payload);
  let received = 0;
  for (const m of messages) {
    const connection = await findCompanyByWhatsAppPhoneId(m.phoneNumberId);
    if (!connection) continue; // Anschluss ist keinem Büro zugeordnet – nichts zu tun.
    const store = await getPublicStore(connection.companyId);
    if (!store) continue;
    try {
      await routeInbound(store, { companyId: connection.companyId, channel: "whatsapp", text: m.text.slice(0, 1500), sender: { phone: m.from } });
      received++;
    } catch (err) {
      console.error("[whatsapp] Verarbeitung fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    }
  }
  return NextResponse.json({ received });
}

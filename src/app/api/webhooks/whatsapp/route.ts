import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicStore } from "@/lib/data";
import { routeInbound } from "@/lib/intake/router";
import { whatsappProvider } from "@/lib/integrations/whatsapp";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Meta-Webhook-Verifizierung. Ohne Credentials: Mock-Antwort, keine Fake-Integration. */
export async function GET(req: NextRequest) {
  if (whatsappProvider.missingConfig().length) return NextResponse.json({ mock: true, message: "WhatsApp ist nicht konfiguriert." });
  const p = req.nextUrl.searchParams;
  const challenge = whatsappProvider.verifyWebhook(p.get("hub.mode"), p.get("hub.verify_token"), p.get("hub.challenge"));
  return challenge === null ? new NextResponse("Forbidden", { status: 403 }) : new NextResponse(challenge);
}

function validSignature(raw: string, header: string | null, secret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const given = Buffer.from(header.slice(7), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Eingehende WhatsApp-Nachrichten → Kunde/Fall erkennen → Nachricht im Fall speichern → KI reagiert.
 * Wird nur verarbeitet, wenn alles konfiguriert ist: WHATSAPP_*-Zugangsdaten, WHATSAPP_APP_SECRET (Signaturprüfung
 * X-Hub-Signature-256) und WHATSAPP_COMPANY_ID (Büro, dem dieser Anschluss gehört). Sonst passiert nichts.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`wa:${clientIp(req)}`, 120, 60_000)) return new NextResponse("Too Many Requests", { status: 429 });
  if (whatsappProvider.missingConfig().length) return NextResponse.json({ mock: true, received: false });

  const secret = process.env.WHATSAPP_APP_SECRET;
  const companyId = process.env.WHATSAPP_COMPANY_ID;
  if (!secret || !companyId) return NextResponse.json({ mock: true, received: false, message: "WHATSAPP_APP_SECRET und WHATSAPP_COMPANY_ID fehlen." });

  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"), secret)) return new NextResponse("Forbidden", { status: 403 });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }
  const store = await getPublicStore(companyId);
  if (!store) return NextResponse.json({ received: 0 });

  const messages = whatsappProvider.parseWebhook(payload);
  for (const m of messages) {
    try {
      await routeInbound(store, { channel: "whatsapp", text: m.text.slice(0, 1500), sender: { phone: m.from } });
    } catch (err) {
      console.error("[whatsapp] Verarbeitung fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    }
  }
  return NextResponse.json({ received: messages.length });
}

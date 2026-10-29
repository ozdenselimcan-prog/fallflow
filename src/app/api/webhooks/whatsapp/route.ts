import { after, NextResponse, type NextRequest } from "next/server";
import { handleWhatsAppWebhook } from "@/lib/integrations/whatsapp-inbound";
import { validMetaSignature } from "@/lib/integrations/whatsapp";
import { isSupabaseConfigured } from "@/lib/utils";

// Die Verarbeitung (KI, Fallakte, Antwort) läuft nach der Bestätigung an Meta weiter.
export const maxDuration = 60;

/** Meta prüft die Webhook-Adresse einmalig mit einem GET (hub.challenge zurückgeben, wenn das Token stimmt). */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  return new NextResponse("Forbidden", { status: 403 });
}

/** Eingehende WhatsApp-Nachrichten: Signatur prüfen, sofort bestätigen, danach verarbeiten. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    if (isSupabaseConfigured()) return new NextResponse("WhatsApp nicht eingerichtet", { status: 503 });
  } else if (!validMetaSignature(secret, raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Ungültige Signatur", { status: 403 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("Ungültige Daten", { status: 400 });
  }
  after(() => handleWhatsAppWebhook(body).catch((err) => console.error("[whatsapp] Webhook-Verarbeitung fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt")));
  return NextResponse.json({ ok: true });
}

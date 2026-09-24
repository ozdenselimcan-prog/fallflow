import { NextResponse, type NextRequest } from "next/server";
import { whatsappProvider } from "@/lib/integrations/whatsapp";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Meta-Webhook-Verifizierung. Ohne Credentials: Mock-Antwort, keine Fake-Integration. */
export async function GET(req: NextRequest) {
  if (whatsappProvider.missingConfig().length) return NextResponse.json({ mock: true, message: "WhatsApp ist nicht konfiguriert." });
  const p = req.nextUrl.searchParams;
  const challenge = whatsappProvider.verifyWebhook(p.get("hub.mode"), p.get("hub.verify_token"), p.get("hub.challenge"));
  return challenge === null ? new NextResponse("Forbidden", { status: 403 }) : new NextResponse(challenge);
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`wa:${clientIp(req)}`, 120, 60_000)) return new NextResponse("Too Many Requests", { status: 429 });
  if (whatsappProvider.missingConfig().length) return NextResponse.json({ mock: true, received: false });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }
  // TODO (mit echten Zugangsdaten): X-Hub-Signature-256 mit dem App Secret prüfen, Nachricht der richtigen
  // Company zuordnen (Phone-Number-ID → channels) und über processChatMessage() in einen Fall überführen.
  const messages = whatsappProvider.parseWebhook(payload);
  return NextResponse.json({ received: messages.length });
}

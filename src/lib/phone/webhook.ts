import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/lib/config/site";
import { isSupabaseConfigured } from "@/lib/utils";
import { validTwilioSignature } from "./twilio";

/**
 * Liest einen Twilio-Webhook (Formular-POST) und prüft die Signatur mit TWILIO_AUTH_TOKEN – nur echte Anrufe von
 * Twilio werden verarbeitet. Ohne Token (lokal/Tests ohne Supabase) wird nicht geprüft; im Betrieb ist er Pflicht.
 */
export async function readTwilioRequest(req: NextRequest): Promise<{ params: Record<string, string> } | { error: NextResponse }> {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") params[k] = v;
  });
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) {
    if (isSupabaseConfigured()) return { error: new NextResponse("Telefon nicht eingerichtet", { status: 503 }) };
    return { params };
  }
  // Twilio signiert genau die URL, die in der Nummer hinterlegt ist (öffentliche Adresse, inkl. ?attempt=…).
  const url = `${siteConfig.appUrl}${req.nextUrl.pathname}${req.nextUrl.search}`;
  if (!validTwilioSignature(token, url, params, req.headers.get("x-twilio-signature"))) {
    return { error: new NextResponse("Ungültige Signatur", { status: 403 }) };
  }
  return { params };
}

export const twimlResponse = (xml: string) => new NextResponse(xml, { headers: { "Content-Type": "text/xml; charset=utf-8" } });

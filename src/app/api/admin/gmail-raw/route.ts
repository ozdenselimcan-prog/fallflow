import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { gmailProvider } from "@/lib/integrations/gmail";
import { getValidTokens } from "@/lib/integrations/tokens";

/** Temporäres Diagnose-Werkzeug: zeigt die rohe Gmail-API-Antwort für die neuesten Posteingangs-Mails. Nach Gebrauch entfernen. */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId fehlt" }, { status: 400 });

  const found = await getValidTokens(gmailProvider, companyId);
  if (!found) return NextResponse.json({ error: "Keine Gmail-Verbindung" }, { status: 400 });

  const listRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=3", {
    headers: { Authorization: `Bearer ${found.tokens.accessToken}` },
  });
  const list = (await listRes.json()) as { messages?: { id: string }[] };

  const out = [];
  for (const m of list.messages ?? []) {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, { headers: { Authorization: `Bearer ${found.tokens.accessToken}` } });
    const full = (await res.json()) as { payload?: unknown };
    out.push({ id: m.id, payload: full.payload });
  }
  return NextResponse.json({ messages: out });
}

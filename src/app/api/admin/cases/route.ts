import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicStore } from "@/lib/data";

/**
 * Temporäres Admin-Werkzeug zum Aufräumen von Testfällen, die während der Entwicklung in einer echten
 * Company angelegt wurden. Gleiches Schutzschema wie /api/cron/follow-ups (CRON_SECRET als Bearer-Token).
 * Nicht Teil des Produkts für Endnutzer – nach Gebrauch wieder entfernen.
 */
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
  const store = await getPublicStore(companyId);
  if (!store) return NextResponse.json({ error: "Company nicht gefunden" }, { status: 404 });
  const cases = await store.listCases({ sort: "newest" });
  return NextResponse.json({
    cases: cases.map((c) => ({ id: c.id, customerName: c.customerName, service: c.service, source: c.source, summary: c.summary, createdAt: c.createdAt, fields: c.fields })),
  });
}

export async function DELETE(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { companyId?: string; ids?: string[] };
  if (!body.companyId || !Array.isArray(body.ids) || body.ids.length === 0) return NextResponse.json({ error: "companyId und ids erforderlich" }, { status: 400 });
  const store = await getPublicStore(body.companyId);
  if (!store) return NextResponse.json({ error: "Company nicht gefunden" }, { status: 404 });
  for (const id of body.ids) await store.deleteCase(id);
  return NextResponse.json({ deleted: body.ids.length });
}

import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { listAllStores } from "@/lib/data";
import { syncServiceQuestionOptions } from "@/lib/intake/case-ops";

/**
 * Einmaliger Nachzieh-Abgleich fuer bestehende Bueros: synchronisiert die Options-Liste der
 * "Leistung"-Frage mit den tatsaechlich angebotenen Leistungen (siehe syncServiceQuestionOptions),
 * die bei Aenderungen VOR Einfuehrung dieser Funktion nie aktualisiert wurde. Wird nach einmaligem
 * Gebrauch wieder entfernt - kein Dauer-Endpunkt.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET ist nicht gesetzt." }, { status: 503 });
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  let companies = 0;
  for (const store of await listAllStores()) {
    const company = await store.getCompany();
    await syncServiceQuestionOptions(store, company.services);
    companies++;
  }
  return NextResponse.json({ companies });
}

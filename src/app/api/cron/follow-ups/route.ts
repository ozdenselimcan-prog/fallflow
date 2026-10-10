import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { listAllStores } from "@/lib/data";
import { gmailProvider } from "@/lib/integrations/gmail";
import { syncMailbox } from "@/lib/integrations/mail-sync";
import { purgeStaleCases } from "@/lib/intake/retention";

// Mit wachsender Buero-Anzahl dauert ein Durchlauf laenger als das Standard-Timeout erlaubt – ohne das
// wird die Funktion mitten im Mail-Abruf abgebrochen (siehe mail-sync.ts fuer die Absicherung dagegen).
export const maxDuration = 60;

/**
 * Cron-Endpunkt (Pfad bleibt aus Kompatibilität mit dem externen Scheduler bestehen): holt neue E-Mails aller Büros
 * ab und räumt alte, nicht übernommene Anfragen auf. Geschützt durch CRON_SECRET (Bearer-Token).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET ist nicht gesetzt." }, { status: 503 });
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  // Mit wachsender Buero-Anzahl waere ein rein sequentieller Durchlauf zu langsam fuers Timeout –
  // mehrere Bueros gleichzeitig bearbeiten (begrenzte Parallelitaet, damit die DB nicht ueberlastet wird).
  const totals = { companies: 0, purged: 0 };
  const stores = await listAllStores();
  const CONCURRENCY = 10;
  for (let i = 0; i < stores.length; i += CONCURRENCY) {
    const batch = stores.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (store) => ({ purged: await purgeStaleCases(store) })));
    for (const r of results) {
      totals.companies++;
      totals.purged += r.purged;
    }
  }

  // E-Mail-Postfächer haben keinen Push-Webhook – neue Nachrichten werden hier für alle Büros abgeholt.
  const gmail = await syncMailbox(gmailProvider);

  return NextResponse.json({ ...totals, mail: { gmail } });
}

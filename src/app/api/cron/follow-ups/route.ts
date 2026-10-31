import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { listAllStores } from "@/lib/data";
import { gmailProvider } from "@/lib/integrations/gmail";
import { microsoftProvider } from "@/lib/integrations/microsoft";
import { syncMailbox } from "@/lib/integrations/mail-sync";
import { purgeStaleCases } from "@/lib/intake/retention";
import { sendReminders, sendReviewRequests } from "@/lib/intake/reminders";
import { purgeOldTrialUsage } from "@/lib/billing/trial-usage";
import { processCanceledCompanies } from "@/lib/billing/account-deletion";
import { syncAllSubscriptions } from "@/lib/billing/stripe-sync";

// Mit wachsender Buero-Anzahl dauert ein Durchlauf laenger als das Standard-Timeout erlaubt – ohne das
// wird die Funktion mitten im Mail-Abruf abgebrochen (siehe mail-sync.ts fuer die Absicherung dagegen).
export const maxDuration = 300;

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
  const totals = { companies: 0, purged: 0, reminders: 0, reviews: 0 };
  const stores = await listAllStores();
  const CONCURRENCY = 10;
  for (let i = 0; i < stores.length; i += CONCURRENCY) {
    const batch = stores.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (store) => ({
        purged: await purgeStaleCases(store),
        // Erinnerungen an Kunden, die fehlende Angaben/Unterlagen nicht schicken (Fehler eines Büros stoppt nicht alle).
        reminders: await sendReminders(store).catch((err) => {
          console.error("[reminders] fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
          return 0;
        }),
        reviews: await sendReviewRequests(store).catch((err) => {
          console.error("[reviews] fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
          return 0;
        }),
      })),
    );
    for (const r of results) {
      totals.companies++;
      totals.purged += r.purged;
      totals.reminders += r.reminders;
      totals.reviews += r.reviews;
    }
  }

  // E-Mail-Postfächer haben keinen Push-Webhook – neue Nachrichten werden hier für alle Büros abgeholt.
  const [gmail, microsoft] = await Promise.all([syncMailbox(gmailProvider), syncMailbox(microsoftProvider)]);

  // Abo-Stand mit Stripe abgleichen (falls ein Webhook nicht angekommen ist) – einmal pro Stunde genügt.
  const billing = new Date().getUTCMinutes() < 10 ? await syncAllSubscriptions() : null;

  // Beendete Abos: 7 Tage vorher warnen, 30 Tage nach Vertragsende alle Daten löschen (AVV § 9).
  const deletion = await processCanceledCompanies();
  await purgeOldTrialUsage();

  return NextResponse.json({ ...totals, mail: { gmail, microsoft }, billing, deletion });
}

import type { Metadata } from "next";
import Link from "next/link";
import { Article, H2, Template } from "@/components/landing/article";

const PATH = "/ratgeber/besichtigungstermin-vereinbaren";
const TITLE = "Besichtigungstermin vereinbaren – ohne Telefon-Pingpong";
const INTRO =
  "„Wann passt es Ihnen?“ – „Dienstag vormittags?“ – „Da kann ich nicht …“: Termine abzustimmen kostet oft mehr Zeit als die Besichtigung selbst. So geht es schneller, mit Vorlagen für Terminvorschlag, Bestätigung und Erinnerung.";

export const metadata: Metadata = {
  title: "Besichtigungstermin vereinbaren – Vorlagen für Handwerker",
  description: INTRO,
  alternates: { canonical: PATH },
};

export default function Page() {
  return (
    <Article path={PATH} title={TITLE} intro={INTRO} published="2026-11-26">
      <H2>Vor dem Termin: Brauchen Sie ihn überhaupt?</H2>
      <p>
        Mit ein paar Fotos und den wichtigsten Angaben lässt sich oft schon einschätzen, ob der Auftrag passt – manchmal reicht das sogar für ein erstes Angebot. Fragen
        Sie deshalb gleich in der ersten Antwort danach. Welche Angaben je Gewerk sinnvoll sind, steht in der{" "}
        <Link href="/ratgeber/angaben-fuer-angebot-checkliste" className="font-medium underline underline-offset-2">
          Checkliste
        </Link>
        .
      </p>

      <H2>Drei Wege, Termine schneller festzumachen</H2>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong>Zwei feste Vorschläge statt einer offenen Frage.</strong> „Passt Ihnen Dienstag um 10 Uhr oder Donnerstag um 15 Uhr?“ wird viel schneller beantwortet als
          „Wann passt es Ihnen?“.
        </li>
        <li>
          <strong>Feste Besichtigungszeiten.</strong> Zum Beispiel immer dienstags und donnerstags nachmittags. Das bündelt die Fahrten und macht die Planung einfacher.
        </li>
        <li>
          <strong>Ein Buchungslink.</strong> Der Kunde sieht Ihre freien Zeiten und wählt selbst – ohne dass Sie zurückschreiben müssen.
        </li>
      </ul>

      <H2>Vorlage: Terminvorschlag</H2>
      <Template title="Betreff: Besichtigungstermin für Ihr Dach">{`Guten Tag Herr Weber,

vielen Dank für die Fotos – damit können wir uns gut vorbereiten. Für die Besichtigung vor Ort hätten wir folgende Termine frei:

– Dienstag, 8. Dezember, um 10:00 Uhr
– Donnerstag, 10. Dezember, um 15:00 Uhr

Antworten Sie einfach mit dem Termin, der Ihnen passt. Die Besichtigung dauert etwa 20 Minuten.

Viele Grüße
Ihr Name
Firmenname · Telefon`}</Template>

      <H2>Vorlage: Terminbestätigung</H2>
      <Template title="Betreff: Bestätigung – Besichtigung am Dienstag, 8. Dezember, 10:00 Uhr">{`Guten Tag Herr Weber,

hiermit bestätigen wir Ihnen die Besichtigung am Dienstag, 8. Dezember, um 10:00 Uhr in der Lerchenauer Str. 12.

Falls etwas dazwischenkommt, antworten Sie einfach auf diese E-Mail – dann finden wir einen neuen Termin.

Viele Grüße
Ihr Name`}</Template>

      <H2>Vorlage: Erinnerung am Vortag</H2>
      <Template title="Betreff: Erinnerung – morgen um 10:00 Uhr">{`Guten Tag Herr Weber,

kurze Erinnerung: Wir kommen morgen, Dienstag, um 10:00 Uhr zur Besichtigung vorbei.

Bis morgen!
Ihr Name`}</Template>
      <p>Eine Erinnerung am Vortag kostet Sie zehn Sekunden und erspart Ihnen viele vergebliche Fahrten.</p>
    </Article>
  );
}

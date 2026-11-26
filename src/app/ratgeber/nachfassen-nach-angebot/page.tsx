import type { Metadata } from "next";
import Link from "next/link";
import { Article, H2, Template } from "@/components/landing/article";

const PATH = "/ratgeber/nachfassen-nach-angebot";
const TITLE = "Kunde meldet sich nicht nach dem Angebot: So fassen Sie freundlich nach";
const INTRO =
  "Angebot verschickt – und dann Funkstille. Oft liegt es nicht am Preis, sondern daran, dass der Kunde es vergessen hat oder noch eine Frage hat. Mit einer kurzen Nachricht zur richtigen Zeit holen Sie viele dieser Aufträge doch noch.";

export const metadata: Metadata = {
  title: "Kunde meldet sich nicht nach Angebot – Nachfassen mit Vorlage",
  description: INTRO,
  alternates: { canonical: PATH },
};

export default function Page() {
  return (
    <Article path={PATH} title={TITLE} intro={INTRO} published="2026-11-26">
      <H2>Warum sich Kunden nicht melden</H2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Sie vergleichen noch andere Angebote und haben sich noch nicht entschieden.</li>
        <li>Das Angebot ist im Postfach untergegangen.</li>
        <li>Es gibt eine offene Frage – zum Preis, zum Termin, zu einer Position –, die sie nicht stellen mögen.</li>
        <li>Das Projekt ist verschoben, weil z. B. Geld oder Zeit gerade fehlen.</li>
      </ul>
      <p>In fast allen Fällen hilft eine kurze, freundliche Nachfrage. Wer nachfasst, wirkt nicht aufdringlich, sondern zuverlässig.</p>

      <H2>Der richtige Zeitpunkt</H2>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong>Nach etwa einer Woche:</strong> kurze Nachfrage, ob das Angebot angekommen ist und ob es Fragen gibt.
        </li>
        <li>
          <strong>Nach etwa zwei bis drei Wochen:</strong> ein zweites, letztes Mal – mit Hinweis auf Gültigkeit oder Termine.
        </li>
        <li>
          <strong>Danach:</strong> nicht weiter nachhaken. Wer zweimal nicht antwortet, hat sich meist anders entschieden.
        </li>
      </ul>

      <H2>Vorlage: erste Nachfrage nach einer Woche</H2>
      <Template title="Betreff: Ihr Angebot Nr. 2026-041 – noch Fragen?">{`Guten Tag Frau Schneider,

vor einer Woche haben wir Ihnen unser Angebot für den Anstrich von Wohnzimmer und Flur geschickt. Ist es gut bei Ihnen angekommen?

Falls Sie noch Fragen haben oder etwas anders haben möchten, sagen Sie es gern – wir passen das Angebot an.

Viele Grüße
Ihr Name
Firmenname · Telefon`}</Template>

      <H2>Vorlage: zweite Nachfrage nach zwei bis drei Wochen</H2>
      <Template title="Betreff: Ihr Angebot Nr. 2026-041">{`Guten Tag Frau Schneider,

ich wollte mich noch einmal kurz wegen unseres Angebots melden. Für Dezember haben wir aktuell noch einen Termin frei – danach wird es erst wieder im Februar etwas.

Wenn das Thema für Sie gerade nicht mehr aktuell ist, ist das natürlich auch in Ordnung – eine kurze Rückmeldung würde uns trotzdem helfen.

Viele Grüße
Ihr Name`}</Template>
      <p>
        Wichtig: Nennen Sie nur Termine oder Fristen, die wirklich stimmen. Künstlicher Zeitdruck fällt auf und kostet Vertrauen.
      </p>

      <H2>Anrufen oder schreiben?</H2>
      <p>
        Bei größeren Aufträgen lohnt sich ein kurzer Anruf – im Gespräch kommen offene Fragen eher auf den Tisch. Bei kleineren Aufträgen reicht eine E-Mail; die kann
        der Kunde beantworten, wann es ihm passt. Fragen Sie bei einer Absage ruhig nach dem Grund: Liegt es am Preis, am Termin oder an etwas anderem? Das hilft Ihnen beim
        nächsten Angebot.
      </p>

      <H2>Vorher ansetzen: schnell und vollständig antworten</H2>
      <p>
        Viele Aufträge gehen schon vor dem Angebot verloren – weil die erste Antwort zu lange dauert. Wie Sie Anfragen schneller beantworten, steht in den{" "}
        <Link href="/ratgeber/kundenanfragen-schneller-beantworten" className="font-medium underline underline-offset-2">
          7 Tipps für schnellere Antworten
        </Link>
        , eine Vorlage für das Angebot selbst unter{" "}
        <Link href="/ratgeber/angebot-schreiben-vorlage" className="font-medium underline underline-offset-2">
          Angebot schreiben
        </Link>
        .
      </p>
    </Article>
  );
}

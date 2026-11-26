import type { Metadata } from "next";
import Link from "next/link";
import { Article, H2, Template } from "@/components/landing/article";

const PATH = "/ratgeber/angebot-schreiben-vorlage";
const TITLE = "Angebot schreiben als Handwerker: Vorlage und was hineingehört";
const INTRO =
  "Ein klares Angebot erspart Rückfragen und Ärger auf der Baustelle. Hier steht, was in ein gutes Angebot gehört, worin es sich vom Kostenvoranschlag unterscheidet – und eine Vorlage für das Anschreiben zum Kopieren.";

export const metadata: Metadata = {
  title: "Angebot schreiben Handwerker – Vorlage & Inhalte",
  description: INTRO,
  alternates: { canonical: PATH },
};

const inhalte: [string, string][] = [
  ["Ihr Betrieb und der Kunde", "Name und Anschrift von beiden, dazu Telefon und E-Mail für Rückfragen."],
  ["Datum und Angebotsnummer", "Damit Sie und der Kunde später eindeutig darauf Bezug nehmen können."],
  ["Was genau gemacht wird", "Jede Leistung als eigene Position, verständlich beschrieben – lieber „Wände und Decken im Wohnzimmer zweimal weiß streichen, ca. 62 m²“ als „Malerarbeiten“."],
  ["Mengen, Einheiten, Einzel- und Gesamtpreise", "z. B. 62 m² × 9,50 € = 589,00 €. So sieht der Kunde, wie der Preis zustande kommt."],
  ["Material", "Was enthalten ist (Marke, Qualität) – und was der Kunde ggf. selbst stellt."],
  ["Umsatzsteuer", "Netto, Umsatzsteuer und Brutto – oder als Kleinunternehmer der Hinweis, dass keine Umsatzsteuer berechnet wird."],
  ["Was nicht enthalten ist", "z. B. Entsorgung, Gerüst, Arbeiten, die erst beim Öffnen sichtbar werden. Das vermeidet die meisten Diskussionen."],
  ["Ausführungszeitraum", "Wann Sie anfangen können und wie lange es ungefähr dauert."],
  ["Gültigkeit", "Wie lange Sie an das Angebot gebunden sind, z. B. 30 Tage – Materialpreise ändern sich."],
  ["Zahlungsbedingungen", "Zahlungsziel, ggf. Abschlagszahlungen bei größeren Aufträgen."],
];

export default function Page() {
  return (
    <Article path={PATH} title={TITLE} intro={INTRO} published="2026-11-26">
      <H2>Was in ein gutes Angebot gehört</H2>
      <ul className="list-disc space-y-2 pl-6">
        {inhalte.map(([t, d]) => (
          <li key={t}>
            <strong>{t}</strong> – {d}
          </li>
        ))}
      </ul>
      <p>
        Ein Tipp vorab: Die meisten dieser Angaben bekommen Sie schon mit der ersten Antwort auf die Anfrage, wenn Sie gezielt nachfragen. Welche das je Gewerk sind, steht in
        der{" "}
        <Link href="/ratgeber/angaben-fuer-angebot-checkliste" className="font-medium underline underline-offset-2">
          Checkliste für Angebote
        </Link>
        .
      </p>

      <H2>Angebot oder Kostenvoranschlag?</H2>
      <p>
        Im Alltag wird beides oft gleich verwendet, rechtlich ist es nicht dasselbe. Ein <strong>Angebot</strong> nennt einen festen Preis, an den Sie gebunden sind, sobald
        der Kunde es annimmt. Ein <strong>Kostenvoranschlag</strong> ist eine Schätzung: Zeigt sich, dass die Kosten deutlich höher werden, müssen Sie den Kunden
        unverzüglich informieren – er kann den Auftrag dann kündigen (§ 649 BGB). Für einen Kostenvoranschlag dürfen Sie im Zweifel kein Geld verlangen, außer es ist
        vorher so vereinbart (§ 632 Abs. 3 BGB).
      </p>
      <p>Schreiben Sie deshalb klar darüber, was es ist – „Angebot“ oder „Kostenvoranschlag (unverbindlich)“. Das ist keine Rechtsberatung; im Zweifel hilft Ihre Handwerkskammer.</p>

      <H2>Vorlage: Anschreiben zum Angebot</H2>
      <Template title="Betreff: Ihr Angebot Nr. 2026-041 – Anstrich Wohnzimmer und Flur">{`Guten Tag Frau Schneider,

vielen Dank für die Besichtigung am Dienstag. Wie besprochen erhalten Sie anbei unser Angebot für den Anstrich von Wohnzimmer und Flur.

Kurz zusammengefasst:
– Wände und Decken zweimal weiß streichen, ca. 85 m²
– Abkleben und Abdecken, Reinigung nach den Arbeiten
– Gesamtpreis: 1.190,00 € inkl. Material

Wir könnten in der Woche ab dem 14. Dezember beginnen, die Arbeiten dauern etwa zwei Tage. Das Angebot gilt 30 Tage.

Passt alles? Dann antworten Sie einfach kurz auf diese E-Mail – wir melden uns mit dem genauen Termin.

Viele Grüße
Ihr Name
Firmenname · Telefon`}</Template>

      <H2>Und wenn sich der Kunde nicht meldet?</H2>
      <p>
        Das ist normal – viele holen mehrere Angebote ein und entscheiden sich erst nach Tagen. Wie Sie freundlich nachfassen, ohne aufdringlich zu wirken, steht im Artikel{" "}
        <Link href="/ratgeber/nachfassen-nach-angebot" className="font-medium underline underline-offset-2">
          Kunde meldet sich nicht nach dem Angebot
        </Link>
        .
      </p>
    </Article>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Article, H2 } from "@/components/landing/article";

const PATH = "/ratgeber/kundenanfragen-schneller-beantworten";
const TITLE = "Kundenanfragen schneller beantworten: 7 Tipps für Handwerksbetriebe";
const INTRO =
  "Den ganzen Tag beim Kunden, abends noch das Postfach voll: So bleiben Anfragen nicht liegen – mit wenig Aufwand und ohne neue Software, die erst eingerichtet werden muss.";

export const metadata: Metadata = {
  title: "Kundenanfragen schneller beantworten – 7 Tipps für Handwerker",
  description: INTRO,
  alternates: { canonical: PATH },
};

const tips: { title: string; text: ReactNode }[] = [
  {
    title: "Sofort kurz bestätigen",
    text: "Eine Zeile reicht: „Ihre Anfrage ist angekommen, wir melden uns bis übermorgen.“ Viele Kunden fragen mehrere Betriebe an – wer zuerst reagiert, bleibt im Rennen.",
  },
  {
    title: "Feste Zeiten für E-Mails",
    text: "Zweimal am Tag zehn Minuten, z. B. in der Mittagspause und nach Feierabend, sind besser als nebenbei auf dem Gerüst. So geht nichts unter.",
  },
  {
    title: "Mit Vorlagen arbeiten",
    text: (
      <>
        Die meisten Anfragen sind ähnlich. Legen Sie sich für Ihre häufigsten Leistungen je eine Antwort zurecht – Muster finden Sie{" "}
        <Link href="/ratgeber/antwort-auf-kundenanfrage-muster" className="font-medium underline underline-offset-2">
          hier zum Kopieren
        </Link>
        .
      </>
    ),
  },
  {
    title: "Alles auf einmal abfragen",
    text: (
      <>
        Statt dreimal hin und her: in der ersten Antwort Adresse, Größe, Fotos und Zeitraum in einer kurzen Liste abfragen. Welche Angaben je Gewerk sinnvoll sind, steht in
        der{" "}
        <Link href="/ratgeber/angaben-fuer-angebot-checkliste" className="font-medium underline underline-offset-2">
          Checkliste
        </Link>
        .
      </>
    ),
  },
  {
    title: "Fotos statt erster Besichtigung",
    text: "Mit zwei, drei Handyfotos können Sie oft schon abschätzen, worum es geht – und fahren nur noch zu den Aufträgen, die wirklich passen.",
  },
  {
    title: "Termine per Link statt Telefon-Pingpong",
    text: "Ein Link mit Ihren freien Zeiten, aus denen der Kunde selbst wählt, spart die „Wann passt es Ihnen?“-Runden am Telefon.",
  },
  {
    title: "Ansage auf der Mailbox",
    text: "Sagen Sie auf der Mailbox, wann Sie zurückrufen und dass man Ihnen auch eine E-Mail mit Fotos schicken kann. Dann kommen Anfragen gleich mit den wichtigsten Angaben.",
  },
];

export default function Page() {
  return (
    <Article path={PATH} title={TITLE} intro={INTRO} published="2026-11-25">
      <p>
        Wie wichtig Tempo ist, zeigt eine Auswertung, über die die{" "}
        <a href="https://www.deutsche-handwerks-zeitung.de/kundenanfragen-schneller-beantwortet-349790/" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
          Deutsche Handwerks Zeitung
        </a>{" "}
        berichtet: Rund jede vierte telefonische Anfrage bei Handwerksbetrieben wird gar nicht angenommen. Jede davon ist ein möglicher Auftrag, der woanders landet.
      </p>
      {tips.map((t, i) => (
        <section key={t.title}>
          <H2>
            {i + 1}. {t.title}
          </H2>
          <p className="mt-2">{t.text}</p>
        </section>
      ))}
      <H2>Und wenn es trotzdem zu viel wird?</H2>
      <p>
        Dann lohnt sich ein Helfer, der die ersten Schritte übernimmt: Anfragen beantworten, fehlende Angaben und Fotos einsammeln, einen Termin vorschlagen – und Ihnen nur noch
        den fertig vorbereiteten Auftrag hinlegen. Genau das macht FallFlow, mit Ihren eigenen Texten. Preise und Sonderfälle beantworten weiterhin Sie selbst.
      </p>
    </Article>
  );
}

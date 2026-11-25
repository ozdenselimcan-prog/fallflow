import type { Metadata } from "next";
import Link from "next/link";
import { Article, H2 } from "@/components/landing/article";
import { INDUSTRY_PAGES } from "@/lib/config/industry-pages";
import { INDUSTRY_PRESETS } from "@/lib/config/industry-presets";

const PATH = "/ratgeber/angaben-fuer-angebot-checkliste";
const TITLE = "Welche Angaben brauchen Sie vom Kunden für ein Angebot? Checkliste je Gewerk";
const INTRO =
  "Wer gleich bei der ersten Antwort alles Nötige abfragt, spart Rückfragen, Telefonate und unnötige Besichtigungen. Hier die Checkliste – erst, was Sie immer brauchen, dann je Branche die typischen Angaben und Fotos.";

export const metadata: Metadata = {
  title: "Angaben für ein Angebot – Checkliste für Handwerker je Gewerk",
  description: INTRO,
  alternates: { canonical: PATH },
};

/** Branchen-Seite zur Vorlage (gleiche Branche), falls es eine gibt. */
const pageFor = (title: string) => INDUSTRY_PAGES.find((p) => p.audience.toLowerCase().startsWith(title.toLowerCase().slice(0, 5)));

export default function Page() {
  return (
    <Article path={PATH} title={TITLE} intro={INTRO} published="2026-11-25">
      <H2>Das brauchen Sie bei jeder Anfrage</H2>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong>Name und Kontakt</strong> – E-Mail und Telefonnummer für Rückfragen.
        </li>
        <li>
          <strong>Adresse</strong> – wo gearbeitet werden soll (bei Arbeiten vor Ort).
        </li>
        <li>
          <strong>Was genau gemacht werden soll</strong> – in den Worten des Kunden.
        </li>
        <li>
          <strong>Fotos</strong> – zwei, drei Bilder sagen oft mehr als eine lange Beschreibung.
        </li>
        <li>
          <strong>Zeitraum</strong> – ob es eilt oder ob der Kunde flexibel ist.
        </li>
      </ul>
      <p>
        Fragen Sie alles <strong>in einer Nachricht</strong> ab – als kurze Liste. Muster dafür finden Sie unter{" "}
        <Link href="/ratgeber/antwort-auf-kundenanfrage-muster" className="font-medium underline underline-offset-2">
          Antwort auf eine Kundenanfrage
        </Link>
        .
      </p>

      <H2>Checkliste je Branche</H2>
      {INDUSTRY_PRESETS.map((p) => {
        const page = pageFor(p.title);
        return (
          <section key={p.id} className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold">{p.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">Typische Anfragen: {p.services.join(", ")}</p>
            <p className="mt-3 text-sm font-medium">Zusätzlich abfragen:</p>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-[15px]">
              {p.fields.map((f) => (
                <li key={f.key}>
                  {f.label}
                  {f.services.length ? <span className="text-muted-foreground"> (bei {f.services.join(", ")})</span> : null}
                </li>
              ))}
              {p.documents.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            {page && (
              <Link href={`/branchen/${page.slug}`} className="mt-3 inline-block text-sm font-medium underline underline-offset-2">
                So fragt FallFlow das für {page.audience} automatisch ab →
              </Link>
            )}
          </section>
        );
      })}
    </Article>
  );
}

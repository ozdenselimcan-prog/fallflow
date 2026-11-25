import { Check, Phone } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { CaseFilm } from "@/components/landing/case-film";
import { SetupRequestForm } from "@/components/landing/setup-request-form";
import type { FilmScenario } from "@/components/landing/film-scenario";
import { buttonStyles } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";

/**
 * Zielseite für die Pilot-Briefe (QR-Code): 1 Monat kostenlos mit persönlicher Einrichtung. Mit Branche (/pilot/dachdecker …)
 * zusätzlich der Film mit einem typischen Fall dieser Branche. Selbst starten über /signup?trial=30 (siehe signup/page.tsx).
 */
const points = [
  "1 Monat kostenlos, ohne Kreditkarte, endet automatisch",
  "Wir richten alles persönlich mit Ihnen ein – am Telefon oder vor Ort",
  "Läuft über Ihr bestehendes E-Mail-Postfach, kein neues Programm",
  "Preise und Sonderfälle beantworten weiter Sie, nicht die KI",
];

export function PilotPage({ audience, film }: { audience?: string; film?: FilmScenario }) {
  const tel = siteConfig.phone.replace(/\s/g, "");
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold text-accent">Für {audience ?? "Betriebe"} aus der Region München</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Werden Sie einer von 10 Pilotbetrieben.</h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              FallFlow beantwortet Ihre Kundenanfragen in wenigen Minuten, fragt fehlende Angaben und Fotos ab und legt Ihnen den fertig vorbereiteten Auftrag hin – auch wenn Sie
              auf der Baustelle sind.
            </p>
            <ul className="mt-6 space-y-3">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-5 shrink-0 text-accent" />
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-muted-foreground">Dafür wünsche ich mir nur Ihr ehrliches Feedback.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a href={`tel:${tel}`} className={buttonStyles({ size: "lg" })}>
                <Phone className="size-4" /> {siteConfig.phone}
              </a>
              <Link href="/signup?trial=30" className={buttonStyles({ variant: "secondary", size: "lg" })}>
                Selbst starten – 1 Monat kostenlos
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Selimcan Özden, FallFlow · {siteConfig.supportEmail}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold">Lieber zurückrufen lassen?</h2>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">Kurz eintragen – ich melde mich in der Regel innerhalb eines Werktags.</p>
            <SetupRequestForm />
          </div>
        </div>
        {film && (
          <section className="mt-14" aria-label="So läuft ein Fall ab">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">So sieht ein Fall bei {audience} aus – in 25 Sekunden.</h2>
            <p className="mt-2 mb-6 text-muted-foreground">Links das Postfach, rechts die Übersicht zum Auftrag, die FallFlow dabei automatisch füllt.</p>
            <CaseFilm scenario={film} />
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}

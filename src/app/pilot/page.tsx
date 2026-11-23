import type { Metadata } from "next";
import { Check, Phone } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { SetupRequestForm } from "@/components/landing/setup-request-form";
import { buttonStyles } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";

/**
 * Zielseite für die Pilot-Briefe (QR-Code): 2 Monate kostenlos mit persönlicher Einrichtung. Nicht für Suchmaschinen –
 * das Angebot gilt nur für angeschriebene Betriebe. Selbst starten über /signup?trial=60 (siehe signup/page.tsx).
 */
export const metadata: Metadata = {
  title: "Pilotbetrieb werden",
  description: "2 Monate kostenlos testen – FallFlow beantwortet Ihre Kundenanfragen, die Einrichtung übernehmen wir persönlich.",
  robots: { index: false, follow: false },
};

const points = [
  "2 Monate kostenlos, ohne Kreditkarte, endet automatisch",
  "Wir richten alles persönlich mit Ihnen ein – am Telefon oder vor Ort",
  "Läuft über Ihr bestehendes E-Mail-Postfach, kein neues Programm",
  "Preise und Sonderfälle beantworten weiter Sie, nicht die KI",
];

export default function PilotPage() {
  const tel = siteConfig.phone.replace(/\s/g, "");
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold text-accent">Für Betriebe aus der Region München</p>
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
              <Link href="/signup?trial=60" className={buttonStyles({ variant: "secondary", size: "lg" })}>
                Selbst starten – 2 Monate kostenlos
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
      </main>
      <Footer />
    </>
  );
}

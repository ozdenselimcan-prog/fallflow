import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, Check, ClipboardCheck, MessageSquare } from "lucide-react";
import { CaseFilm } from "@/components/landing/case-film";
import { Logo } from "@/components/ui/logo";
import { buttonStyles } from "@/components/ui/button";
import { plans } from "@/lib/config/pricing";

/**
 * Zielseite für die Werbeanzeigen (Meta): knüpft direkt an die Anzeige an („22:14 Uhr – noch 23 Anfragen offen?“),
 * zeigt den Ablauf als Film und führt ohne Menü und Umwege zur Registrierung. Nicht für Suchmaschinen gedacht.
 */
export const metadata: Metadata = {
  title: "Anfragen erledigt. Feierabend gerettet.",
  description: "FallFlow beantwortet Kundenanfragen per E-Mail und WhatsApp, fragt fehlende Angaben ab und legt Ihnen den fertigen Auftrag hin. 7 Tage kostenlos testen.",
  robots: { index: false, follow: false },
};

const steps = [
  { icon: MessageSquare, title: "Kunde schreibt", text: "Per E-Mail oder WhatsApp – auch abends und am Wochenende." },
  { icon: ClipboardCheck, title: "KI fragt nach", text: "Adresse, Fotos, Formular: Was fehlt, fordert FallFlow freundlich an." },
  { icon: Bell, title: "Sie bekommen den Auftrag", text: "Fertig vorbereitet. Bei Dringendem bekommen Sie sofort Bescheid." },
];

const startPrice = Math.min(...plans.map((p) => p.priceEur));

function Cta({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Link href="/signup" className={buttonStyles({ size: "lg", className: "w-full sm:w-auto sm:px-10" })}>
        7 Tage kostenlos testen <ArrowRight className="size-4" />
      </Link>
      <p className="mt-2 text-sm text-muted-foreground">Ohne Kreditkarte · danach ab {startPrice} €/Monat · monatlich kündbar</p>
    </div>
  );
}

export default function StartPage() {
  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Logo imgClassName="h-8" />
          <Link href="/login" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            Login
          </Link>
        </div>
      </header>

      <main className="pb-28 lg:pb-0">
        <section className="mx-auto max-w-3xl px-4 pt-8 text-center sm:px-6 sm:pt-14">
          <p className="text-sm font-semibold text-accent">22:14 Uhr – und noch 23 Anfragen offen?</p>
          <h1 className="mt-3 text-balance text-[clamp(1.9rem,4.5vw+0.6rem,3.25rem)] font-black leading-[1.08] tracking-[-0.03em] text-zinc-900">
            Anfragen erledigt. Feierabend gerettet.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-zinc-600 sm:text-lg">
            FallFlow antwortet Ihren Kunden per E-Mail und WhatsApp, fragt Adresse und Fotos ab und legt Ihnen den fertigen Auftrag hin.
          </p>
          <Cta className="mt-6" />
        </section>

        <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6" aria-label="So läuft ein Fall ab">
          <p className="mb-3 text-center text-sm text-muted-foreground">So läuft ein echter Fall ab – in 25 Sekunden:</p>
          <CaseFilm />
        </section>

        <section className="mx-auto mt-12 max-w-5xl px-4 sm:px-6">
          <ol className="grid gap-4 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <s.icon className="size-4" />
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">Schritt {i + 1}</span>
                </div>
                <h2 className="mt-3 font-semibold">{s.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto mt-12 max-w-3xl px-4 text-center sm:px-6">
          <ul className="mx-auto inline-flex flex-col gap-2 text-left text-sm sm:text-base">
            {["Kein neues Programm lernen – läuft über Ihr Postfach und WhatsApp", "Ihre eigenen Texte und PDF-Formulare", "Preisfragen beantworten Sie selbst, nicht die KI", "Server in Deutschland · DSGVO-konform"].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                {t}
              </li>
            ))}
          </ul>
          <Cta className="mt-8" />
          <p className="mt-6 text-sm text-muted-foreground">
            Lieber erst ausprobieren?{" "}
            <Link href="/demo" className="font-medium text-zinc-900 underline underline-offset-2">
              Demo ohne Anmeldung
            </Link>
          </p>
        </section>

        <footer className="mx-auto mt-14 flex max-w-5xl justify-center gap-5 border-t border-border px-4 py-6 text-xs text-muted-foreground">
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/agb">AGB</Link>
          <Link href="/">Mehr über FallFlow</Link>
        </footer>
      </main>

      {/* Am Handy immer sichtbar: Wer aus der Anzeige kommt, soll nie scrollen müssen, um zu starten. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <Link href="/signup" className={buttonStyles({ size: "lg", className: "w-full" })}>
          7 Tage kostenlos testen
        </Link>
      </div>
    </>
  );
}

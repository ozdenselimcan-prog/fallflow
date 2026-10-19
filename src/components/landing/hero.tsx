import { ArrowRight, CheckCircle2, X, Star } from "lucide-react";
import Link from "next/link";
import { TRUSTPILOT_URL } from "@/components/landing/reviews";
import { TypedText } from "@/components/landing/typed-text";
import { Badge } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";

const checklist = [
  { label: "Kontaktdaten", ok: true },
  { label: "Gebäudetyp, Baujahr, Fläche", ok: true },
  { label: "Heizung", ok: true },
  { label: "Eigentümerstatus", ok: true },
  { label: "Energieausweis", ok: true },
  { label: "Grundriss", ok: false },
];

/**
 * Einzelne gefüllte Gitterzellen links und rechts der Überschrift: [Spalte ab Mitte, Zeile, Grauton, Verzögerung der
 * Animation in s, null = steht still]. Spalten in 40-px-Schritten, passend zu .hero-grid-bg.
 */
const cells: [number, number, string, number | null][] = [
  [-15, 2, "bg-black/[0.08]", null],
  [-12, 5, "bg-black/[0.18]", 0],
  [-15, 6, "bg-black/[0.11]", 2.5],
  [-11, 11, "bg-black/[0.13]", 4],
  [-14, 12, "bg-black/[0.08]", null],
  [-12, 13, "bg-black/[0.16]", 1.5],
  [11, 3, "bg-black/[0.22]", 1],
  [11, 5, "bg-black/[0.08]", null],
  [14, 8, "bg-black/[0.13]", 3.5],
  [11, 13, "bg-black/[0.11]", 5],
  [13, 15, "bg-black/[0.16]", null],
];

/** Hintergrund des Hero: Gitter mit einzelnen Zellen, aufgehellter Mitte und weichen Übergängen an den Rändern. */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="hidden lg:block">
        {cells.map(([col, row, shade, delay]) => (
          <span
            key={`${col}-${row}`}
            className={`absolute size-[33px] rounded-md ${shade} ${delay === null ? "" : "hero-cell-pulse"}`}
            style={{ left: `calc(50% + ${col * 40 + 4}px)`, top: row * 40 + 4, animationDelay: delay === null ? undefined : `${delay}s` }}
          />
        ))}
      </div>
      {/* Mitte aufhellen, damit die Überschrift ruhig steht */}
      <div className="absolute inset-0 bg-[radial-gradient(560px_at_50%_32%,rgba(255,255,255,0.85)_0%,rgba(255,255,255,0)_70%)]" />
      {/* Übergänge: links und rechts ins Weiße, oben leicht, unten ganz in den nächsten Abschnitt */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#fff_0%,rgba(255,255,255,0)_14%,rgba(255,255,255,0)_86%,#fff_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.8)_0%,rgba(255,255,255,0)_8%,rgba(255,255,255,0)_70%,#fff_100%)]" />
    </div>
  );
}

export function Hero() {
  return (
    <section id="produkt" className="hero-grid-bg relative overflow-hidden">
      <HeroBackdrop />
      <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-12 px-4 py-14 text-center sm:px-6 lg:py-20">
      <div className="flex flex-col items-center">
        <span className="hero-reveal mb-5 inline-flex items-center rounded-full border border-zinc-200 bg-white/80 px-4 py-1.5 text-[13px] font-medium text-zinc-600 shadow-sm">
          AI Intake &amp; Operations für Energieberater
        </span>
        <h1 className="hero-reveal text-balance text-[clamp(2rem,5vw+0.5rem,3.75rem)] font-black leading-[1.05] tracking-[-0.03em] text-zinc-900 [animation-delay:80ms]">
          Aus jeder Kundenanfrage
          <span className="mt-1 block text-zinc-400">
            <TypedText text="einen fertigen Beratungsfall." />
          </span>
        </h1>
        <p className="hero-reveal mt-6 max-w-2xl text-base leading-relaxed text-zinc-500 [animation-delay:160ms] sm:text-lg">
          Von der ersten E-Mail bis zur vollständigen Fallakte: FallFlow erledigt die Vorarbeit, damit Sie sich auf die Beratung konzentrieren können.
        </p>
        <div className="hero-reveal mt-8 flex w-full max-w-sm flex-col gap-3 [animation-delay:240ms] sm:max-w-none sm:flex-row sm:justify-center">
          <Link href="/demo" className={buttonStyles({ size: "lg" })}>
            Demo ansehen <ArrowRight className="size-4" />
          </Link>
          <Link href="/signup" className={buttonStyles({ variant: "ghost", size: "lg", className: "border border-zinc-200 bg-white hover:bg-zinc-50" })}>
            Kostenlos starten
          </Link>
        </div>
        <p className="hero-reveal mt-5 text-sm text-zinc-400 [animation-delay:320ms]">Kostenlos testen, ohne Kreditkarte. Kein weiteres CRM – Ihre gewohnten Abläufe bleiben erhalten.</p>
        <a href={TRUSTPILOT_URL} target="_blank" rel="noopener noreferrer" className="hero-reveal mt-3 inline-flex [animation-delay:320ms] items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Star className="size-3.5 fill-[#00b67a] text-[#00b67a]" aria-hidden /> Bewertungen von Testnutzern auf Trustpilot lesen
        </a>
      </div>

      <div className="hero-reveal relative w-full max-w-xl text-left [animation-delay:420ms]" aria-label="Vorschau einer Fallakte">
        <div className="rounded-lg border border-border bg-card p-2 shadow-[0_8px_28px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="ml-3 text-xs text-muted-foreground">Fallakte · Beispiel</span>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground">BERATUNGSFALL</span>
              <Badge tone="success">Bereit zur Prüfung</Badge>
            </div>
            <p className="mt-3 text-xl font-semibold">Max Mustermann</p>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {["EFH", "Baujahr 1987", "160 m²", "Gasheizung", "iSFP"].map((t) => (
                <li key={t} className="rounded-full bg-muted px-3 py-1">
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="text-muted-foreground">Vollständigkeit</span>
                <span className="font-semibold">92 %</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[92%] rounded-full bg-accent" />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Noch 1 Information fehlt</p>
            </div>
            <ul className="mt-4 grid gap-1.5 text-sm sm:grid-cols-2">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  {c.ok ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="vorhanden" /> : <X className="size-4 shrink-0 text-danger" aria-label="fehlt" />}
                  <span className={c.ok ? "" : "font-medium"}>{c.label}</span>
                  {!c.ok && <Badge tone="warning">angefordert</Badge>}
                </li>
              ))}
            </ul>
            <Link href="/demo" className={buttonStyles({ className: "mt-5 w-full" })}>
              Live ausprobieren
            </Link>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}

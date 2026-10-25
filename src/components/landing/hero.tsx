import { ArrowRight, CheckCircle2, X } from "lucide-react";
import Link from "next/link";
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

/** Feste Zufallsfolge (gleich auf Server und im Browser, damit nichts springt). */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 30 Gitterzellen auf einer 1520 × 800 px großen Fläche (38 × 20 Zellen à 40 px), mittig über dem Gitter. */
const SHADES = ["rgba(24,24,27,0.12)", "rgba(24,24,27,0.18)", "rgba(24,24,27,0.28)"];
const cells = (() => {
  const rnd = seeded(20261019);
  const used = new Set<string>();
  const out: { left: number; top: number; bg: string; delay: number; duration: number }[] = [];
  while (out.length < 30) {
    const col = Math.floor(rnd() * 38);
    const row = Math.floor(rnd() * 20);
    // Hinter Überschrift, Text und Buttons frei lassen (Spalte 19 liegt in der Mitte).
    if (row >= 2 && row <= 13 && Math.abs(col - 18.5) <= 10.5) continue;
    if (used.has(`${col}-${row}`)) continue;
    used.add(`${col}-${row}`);
    out.push({ left: col * 40 + 3, top: row * 40 + 3, bg: SHADES[Math.floor(rnd() * 3)], delay: rnd() * 28, duration: 5.5 + rnd() * 7.5 });
  }
  return out;
})();

/** Hintergrund des Hero: Gitter mit einzelnen Zellen, aufgehellter Mitte und weichen Übergängen an den Rändern. */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="hero-cells absolute inset-y-0 left-1/2 w-[1520px] -translate-x-1/2">
        {cells.map((c, i) => (
          <span
            key={i}
            className="hero-cell"
            style={{ left: c.left, top: c.top, background: c.bg, animationDelay: `${c.delay.toFixed(2)}s`, animationDuration: `${c.duration.toFixed(2)}s` }}
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
      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-12 px-4 py-14 text-center sm:px-6 lg:py-20">
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
          <Link href="/signup" className={buttonStyles({ size: "lg" })}>
            7 Tage kostenlos testen <ArrowRight className="size-4" />
          </Link>
          <Link href="/demo" className={buttonStyles({ variant: "ghost", size: "lg", className: "border border-zinc-200 bg-white hover:bg-zinc-50" })}>
            Demo ansehen
          </Link>
        </div>
        <p className="hero-reveal mt-5 text-sm text-zinc-400 [animation-delay:320ms]">Kostenlos testen, ohne Kreditkarte. Kein weiteres CRM – Ihre gewohnten Abläufe bleiben erhalten.</p>
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

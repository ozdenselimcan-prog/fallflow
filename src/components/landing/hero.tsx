import { ArrowRight, CheckCircle2, X } from "lucide-react";
import Link from "next/link";
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

export function Hero() {
  return (
    <section id="produkt" className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
      <div>
        <Badge tone="accent" className="mb-5">
          AI Intake &amp; Operations für Energieberater
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem] lg:leading-[1.08]">Aus jeder Kundenanfrage einen fertigen Beratungsfall.</h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
          FallFlow sammelt automatisch die fehlenden Informationen, fordert Dokumente an und bereitet neue Kundenfälle für Energieberater vor.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/demo" className={buttonStyles({ size: "lg" })}>
            Demo ansehen <ArrowRight className="size-4" />
          </Link>
          <Link href="/signup" className={buttonStyles({ variant: "secondary", size: "lg" })}>
            Kostenlos starten
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Kein weiteres CRM: Ihre bestehende Website und Ihre gewohnten Abläufe bleiben erhalten.</p>
      </div>

      <div className="relative" aria-label="Vorschau einer Fallakte">
        <div className="rounded-3xl border border-border bg-card p-2 shadow-xl shadow-black/5">
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
                <span className="text-muted-foreground">Completeness Score</span>
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
    </section>
  );
}

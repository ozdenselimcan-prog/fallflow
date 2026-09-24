import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";

export function Hero() {
  return (
    <section id="produkt" className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
      <div>
        <Badge tone="accent" className="mb-5">
          Für Energieberatungsbüros in Deutschland
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem] lg:leading-[1.08]">Aus jeder Anfrage einen fertigen Beratungsfall.</h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
          FallFlow sammelt fehlende Informationen automatisch, strukturiert Kundenanfragen und übergibt Ihrem Energieberatungsbüro vollständige Fälle.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className={buttonStyles({ size: "lg" })}>
            Kostenlos testen
          </Link>
          <Link href="/demo" className={buttonStyles({ variant: "secondary", size: "lg" })}>
            Demo ansehen <ArrowRight className="size-4" />
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Ihre bestehende Website und Ihre gewohnten Abläufe bleiben erhalten.</p>
      </div>

      <div className="relative" aria-label="Vorschau eines Beratungsfalls">
        <div className="rounded-3xl border border-border bg-card p-2 shadow-xl shadow-black/5">
          <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="ml-3 text-xs text-muted-foreground">Dashboard · Neue Beratungsfälle</span>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground">NEUER BERATUNGSFALL</span>
              <Badge tone="warning">Rückfrage offen</Badge>
            </div>
            <p className="mt-3 text-xl font-semibold">Max Mustermann</p>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {["Einfamilienhaus", "Baujahr 1982", "165 m²", "Gasheizung"].map((t) => (
                <li key={t} className="rounded-full bg-muted px-3 py-1">
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-xl bg-background px-4 py-3 text-sm">
              <span className="text-muted-foreground">Interesse: </span>
              <span className="font-medium">Sanierungsfahrplan</span>
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="text-muted-foreground">Vollständigkeit</span>
                <span className="font-semibold">92 %</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[92%] rounded-full bg-accent" />
              </div>
            </div>
            <Link href="/demo" className={buttonStyles({ className: "mt-5 w-full" })}>
              Fall öffnen
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

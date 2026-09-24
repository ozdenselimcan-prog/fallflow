import {
  CalendarCheck,
  Check,
  ClipboardCheck,
  Clock,
  FileQuestion,
  FileText,
  Globe,
  Inbox,
  Mail,
  MessageCircleQuestion,
  MessageSquare,
  Repeat,
  ScatterChart,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { DemoWorkbench } from "@/components/chat/demo-workbench";
import { buttonStyles } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { faqs } from "@/lib/config/faq";
import { plans } from "@/lib/config/pricing";
import { cn } from "@/lib/utils";

type Icon = ComponentType<{ className?: string }>;

function Section({ id, title, intro, children, tinted }: { id?: string; title: string; intro?: string; children: ReactNode; tinted?: boolean }) {
  return (
    <section id={id} className={cn("scroll-mt-16 py-16 sm:py-20", tinted && "border-y border-border bg-card/60")}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
        {intro && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{intro}</p>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

const problems: { icon: Icon; title: string }[] = [
  { icon: FileQuestion, title: "Unvollständige Anfragen" },
  { icon: Mail, title: "Rückfragen per E-Mail" },
  { icon: ClipboardCheck, title: "Fehlende Gebäudedaten" },
  { icon: ScatterChart, title: "Verstreute Informationen" },
  { icon: Repeat, title: "Manuelles Übertragen" },
  { icon: Clock, title: "Zeitverlust" },
];

export function ProblemSection() {
  return (
    <Section title="Die eigentliche Arbeit beginnt oft vor der Beratung." intro="Bevor ein Energieberater fachlich arbeiten kann, müssen erst die Grundlagen geklärt sein – meist in mehreren Runden.">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {problems.map(({ icon: I, title }) => (
          <li key={title}>
            <Card className="flex items-center gap-4 p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
                <I className="size-5" />
              </span>
              <span className="font-medium">{title}</span>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const steps = [
  { n: "01", title: "Anfrage kommt rein", text: "Über den Website-Chat oder – sobald verbunden – per E-Mail." },
  { n: "02", title: "KI erkennt fehlende Informationen", text: "FallFlow prüft die Anfrage und fragt gezielt nach, was für den Fall noch fehlt." },
  { n: "03", title: "Fertiger Beratungsfall", text: "Sie erhalten einen strukturierten Fall mit Kontakt-, Gebäude- und Technikdaten." },
];

export function SolutionSection() {
  return (
    <Section id="so-funktioniert-es" tinted title="FallFlow erledigt die Datensammlung vor dem ersten Gespräch." intro="FallFlow sammelt die Informationen, die Sie für einen vollständigen Beratungsfall benötigen.">
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n}>
            <Card className="h-full p-6">
              <span className="font-mono text-sm font-semibold text-accent">{s.n}</span>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </Card>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function DemoSection() {
  return (
    <Section id="demo" title="Probieren Sie den Ablauf selbst aus." intro="Links schreibt der Interessent, rechts entsteht live der Beratungsfall. Die Demo läuft ohne Anmeldung.">
      <DemoWorkbench compact />
      <div className="mt-6">
        <Link href="/demo" className={buttonStyles({ variant: "secondary" })}>
          Demo im Vollbild öffnen
        </Link>
      </div>
    </Section>
  );
}

const features: { icon: Icon; title: string; text: string; soon?: boolean }[] = [
  { icon: MessageCircleQuestion, title: "Automatische Rückfragen", text: "Fehlende Angaben werden im Gespräch nachgefragt – in Ihrer Reihenfolge." },
  { icon: FileText, title: "Strukturierte Beratungsfälle", text: "Kontakt, Gebäude, Technik und Anliegen an einem Ort statt in Postfächern." },
  { icon: ClipboardCheck, title: "Vollständigkeitsprüfung", text: "Jeder Fall zeigt, welche Pflichtangaben noch fehlen." },
  { icon: Globe, title: "Website-Chat", text: "Ein Script-Tag genügt, um das Widget in Ihre bestehende Website einzubinden." },
  { icon: Inbox, title: "E-Mail-Anfragen", text: "Anbindung an Gmail und Microsoft 365 ist vorbereitet.", soon: true },
  { icon: MessageSquare, title: "WhatsApp-ready", text: "Die Architektur für WhatsApp Business ist angelegt.", soon: true },
  { icon: CalendarCheck, title: "Terminübergabe", text: "Vollständige Fälle lassen sich direkt mit einem Terminvorschlag weitergeben." },
  { icon: Users, title: "Mitarbeiter-Dashboard", text: "Fälle übernehmen, Status pflegen und im Team zusammenarbeiten." },
];

export function FeaturesSection() {
  return (
    <Section id="funktionen" tinted title="Alles, was für den ersten Kontakt nötig ist.">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: I, title, text, soon }) => (
          <li key={title}>
            <Card className="h-full p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <I className="size-5" />
              </span>
              <h3 className="mt-4 flex flex-wrap items-center gap-2 font-semibold">
                {title}
                {soon && <Badge>in Vorbereitung</Badge>}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function NoCrmSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Kein kompliziertes neues System.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          FallFlow konzentriert sich auf einen einzigen Prozess: aus einer Anfrage einen vollständigen Beratungsfall machen.
        </p>
      </div>
    </section>
  );
}

const audiences = [
  { size: "1–2 Mitarbeiter", text: "Weniger Rückfragen-Ping-Pong, mehr Zeit für Beratungen." },
  { size: "3–5 Mitarbeiter", text: "Einheitlich erfasste Fälle, die sich im Team klar zuordnen lassen." },
  { size: "6–10 Mitarbeiter", text: "Gemeinsame Fragen, Rollen und ein zentraler Überblick über alle Anfragen." },
];

export function AudienceSection() {
  return (
    <Section tinted title="Für kleine Energieberatungsbüros">
      <ul className="grid gap-4 md:grid-cols-3">
        {audiences.map((a) => (
          <li key={a.size}>
            <Card className="h-full p-6">
              <h3 className="text-lg font-semibold">{a.size}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.text}</p>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function PricingSection() {
  return (
    <Section id="preise" title="Einfache, monatliche Preise." intro="Wählen Sie den Plan, der zur Größe Ihres Büros passt.">
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className={cn("flex flex-col p-6", p.highlighted && "border-accent ring-1 ring-accent")}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{p.name}</h3>
              {p.highlighted && <Badge tone="accent">Beliebt</Badge>}
            </div>
            <p className="mt-4">
              <span className="text-4xl font-semibold tracking-tight">{p.priceEur} €</span>
              <span className="text-muted-foreground">/Monat</span>
            </p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/signup" className={buttonStyles({ variant: p.highlighted ? "primary" : "secondary", className: "mt-6" })}>
              Kostenlos testen
            </Link>
          </Card>
        ))}
      </div>
    </Section>
  );
}

export function FaqSection() {
  return (
    <Section id="faq" tinted title="Häufige Fragen">
      <div className="max-w-3xl space-y-3">
        {faqs.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-border bg-card px-5 py-4 open:shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
              {f.q}
              <span className="text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function FinalCta() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-4xl rounded-3xl bg-foreground px-6 py-14 text-center text-background sm:px-12">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Verwandeln Sie Ihre nächste Kundenanfrage in einen fertigen Beratungsfall.</h2>
        <Link href="/signup" className={buttonStyles({ size: "lg", className: "mt-8" })}>
          Kostenlos starten
        </Link>
      </div>
    </section>
  );
}

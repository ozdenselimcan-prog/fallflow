import {
  ArrowDown,
  ArrowRight,
  CalendarCheck,
  Check,
  ClipboardCheck,
  Clock,
  FileQuestion,
  FileText,
  FileUp,
  Globe,
  Inbox,
  Mail,
  MessageCircleQuestion,
  MessageSquare,
  Repeat,
  ScatterChart,
  Sparkles,
  Workflow,
  BellRing,
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

const flow = [
  { title: "Kundenanfrage", text: "Website-Chat, E-Mail, WhatsApp oder Anruf" },
  { title: "KI-Qualifizierung", text: "Bekannte Angaben werden erkannt" },
  { title: "Fehlende Daten", text: "Nur relevante Fragen werden gestellt" },
  { title: "Dokumente", text: "Grundriss & Energieausweis per sicherem Upload" },
  { title: "Termin", text: "Terminvorschlag zum fertigen Fall" },
  { title: "Fertiger Beratungsfall", text: "Der Berater übernimmt nur noch den fertigen Fall" },
];

/** Der Ablauf von der Anfrage bis zum fertigen Beratungsfall (Desktop horizontal, mobil vertikal). */
export function FlowSection() {
  return (
    <section aria-labelledby="flow-title" className="border-y border-border bg-card/60 py-12 sm:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 id="flow-title" className="text-sm font-semibold tracking-wider text-muted-foreground">
          SO ENTSTEHT AUS EINER ANFRAGE EIN FERTIGER FALL
        </h2>
        <ol className="mt-6 grid gap-3 lg:grid-cols-6 lg:gap-2">
          {flow.map((step, i) => (
            <li key={step.title} className="relative">
              <div className={cn("h-full rounded-2xl border p-4", i === flow.length - 1 ? "border-accent bg-accent-soft" : "border-border bg-card")}>
                <span className="font-mono text-xs font-semibold text-accent">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-1.5 text-sm font-semibold">{step.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.text}</p>
              </div>
              {i < flow.length - 1 && (
                <>
                  <ArrowDown className="mx-auto mt-1 size-4 text-muted-foreground lg:hidden" aria-hidden />
                  <ArrowRight className="absolute -right-2.5 top-1/2 hidden size-4 -translate-y-1/2 text-muted-foreground lg:block" aria-hidden />
                </>
              )}
            </li>
          ))}
        </ol>
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
  { icon: Clock, title: "Zeitverlust vor dem ersten Gespräch" },
];

export function ProblemSection() {
  return (
    <Section title="Die eigentliche Arbeit beginnt oft vor der Beratung." intro="Bevor ein Energieberater fachlich arbeiten kann, müssen erst die Grundlagen geklärt sein – meist in mehreren Runden und über mehrere Kanäle.">
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
  { n: "01", title: "KI versteht die Anfrage", text: "„Einfamilienhaus von 1987, 160 qm, iSFP“ – Gebäudetyp, Baujahr, Fläche und Leistung werden sofort erkannt und übernommen." },
  { n: "02", title: "Nur Fehlendes wird gefragt", text: "Die KI arbeitet keinen starren Fragebogen ab, sondern fragt nur die für diesen Fall relevanten fehlenden Angaben." },
  { n: "03", title: "Dokumente kommen automatisch", text: "Fehlt der Grundriss oder Energieausweis, fordert FallFlow ihn an – mit sicherem Upload-Link – und fasst bei Bedarf nach." },
  { n: "04", title: "Fertige Fallakte", text: "Der Berater erhält eine geprüfte Fallakte mit Vollständigkeitswert, Dokumenten, Verlauf und Zusammenfassung." },
];

export function SolutionSection() {
  return (
    <Section id="so-funktioniert-es" tinted title="FallFlow erledigt die Datensammlung vor dem ersten Gespräch." intro="Vom ersten Kontakt bis zum vorbereiteten Fall – ohne dass jemand aus dem Büro Daten hinterhertelefonieren muss.">
      <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
    <Section id="demo" title="Probieren Sie den Ablauf selbst aus." intro="Links schreibt der Interessent, rechts entsteht live die Fallakte – inklusive Vollständigkeitswert und Dokumentenanforderung. Die Demo läuft ohne Anmeldung.">
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
  { icon: Workflow, title: "AI Intake", text: "Alle laufenden Qualifizierungen mit klarem Status von NEW bis READY_FOR_REVIEW." },
  { icon: MessageCircleQuestion, title: "Dynamischer Frage-Flow", text: "Erkennt Bekanntes, fragt nur relevantes Fehlendes nach." },
  { icon: ClipboardCheck, title: "Case Completeness Score", text: "Jeder Fall zeigt 0–100 %, was vorliegt und was fehlt." },
  { icon: FileText, title: "Fallakte", text: "Kunde, Gebäude, Anliegen, Dokumente, Kommunikation und Zusammenfassung an einem Ort." },
  { icon: FileUp, title: "Dokumenten-Upload", text: "Sicherer Link zum Hochladen von Grundriss, Energieausweis und Fotos – privat gespeichert." },
  { icon: BellRing, title: "Automatische Follow-ups", text: "Wenn der Kunde nicht liefert, wird nachgefasst – sichtbar im Dashboard." },
  { icon: Inbox, title: "Zentrale Inbox", text: "Website, E-Mail, WhatsApp und Telefonnotizen – automatisch dem richtigen Fall zugeordnet." },
  { icon: Globe, title: "Website-Chat", text: "Ein Script-Tag genügt, um das Widget in Ihre bestehende Website einzubinden." },
  { icon: Mail, title: "E-Mail-Anbindung", text: "Gmail und Microsoft 365 sind als Adapter vorbereitet.", soon: true },
  { icon: MessageSquare, title: "WhatsApp Business", text: "Adapter und Simulation sind vorhanden; produktive Anbindung mit Ihren Zugangsdaten.", soon: true },
  { icon: CalendarCheck, title: "Terminübergabe", text: "Vorbereitete Fälle lassen sich direkt mit einem Terminvorschlag weitergeben." },
  { icon: Sparkles, title: "KI-Zusammenfassung", text: "Kurze, sachliche Zusammenfassung – nur aus den erfassten Angaben, keine Beratung." },
];

export function FeaturesSection() {
  return (
    <Section id="funktionen" tinted title="Alles, was zwischen Anfrage und Beratungsfall liegt.">
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

const focus = ["Intake", "Qualifizierung", "Datensammlung", "Dokumente", "Follow-up", "Fallerstellung"];

export function NoCrmSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Kein CRM. Kein ERP. Kein Allzweck-Chatbot.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          FallFlow versucht nicht, Ihre Beratungssoftware zu ersetzen. Es übernimmt genau den Teil zwischen erster Kundenanfrage und fertigem Beratungsfall – und übergibt dann.
        </p>
        <ul className="mt-8 flex flex-wrap justify-center gap-2">
          {focus.map((f) => (
            <li key={f}>
              <Badge tone="accent" className="px-3.5 py-1 text-sm">
                {f}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const audiences = [
  { size: "1–2 Mitarbeiter", text: "Weniger Rückfragen-Ping-Pong, mehr Zeit für Beratungen." },
  { size: "3–5 Mitarbeiter", text: "Einheitlich vorbereitete Fälle, die sich im Team klar zuordnen lassen." },
  { size: "6–10 Mitarbeiter", text: "Gemeinsame Fragen, Rollen und ein zentraler Überblick über alle Anfragen und Dokumente." },
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
              Kostenlos starten
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
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className={buttonStyles({ size: "lg" })}>
            Kostenlos starten
          </Link>
          <Link href="/demo" className={buttonStyles({ variant: "secondary", size: "lg" })}>
            Demo ansehen
          </Link>
        </div>
      </div>
    </section>
  );
}

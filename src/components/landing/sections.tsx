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
  PiggyBank,
  Repeat,
  Ruler,
  ScatterChart,
  Sparkles,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { MailDemo } from "@/components/landing/mail-demo";
import { CaseFilm } from "@/components/landing/case-film";
import { buttonStyles } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { faqs } from "@/lib/config/faq";
import { plans, VAT_NOTE } from "@/lib/config/pricing";
import { cn } from "@/lib/utils";

type Icon = ComponentType<{ className?: string }>;

function Section({ id, title, intro, children, tinted }: { id?: string; title: string; intro?: string; children: ReactNode; tinted?: boolean }) {
  return (
    <section id={id} className={cn("scroll-mt-16 py-16 sm:py-20", tinted && "border-y border-border bg-muted/60")}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-3xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{title}</h2>
        {intro && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{intro}</p>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

const flow = [
  { title: "Kundenanfrage", text: "Per E-Mail – Fragen beantwortet der Website-Chat" },
  { title: "KI-Qualifizierung", text: "Bekannte Angaben werden erkannt" },
  { title: "Fehlende Daten", text: "Die KI fordert per Mail nur an, was noch fehlt" },
  { title: "Dokumente", text: "Formulare, Grundriss & Energieausweis kommen per Mail-Antwort" },
  { title: "Termin", text: "Terminvorschlag zum fertigen Fall" },
  { title: "Fertiger Beratungsfall", text: "Der Berater übernimmt nur noch den fertigen Fall" },
];

/** Der Ablauf von der Anfrage bis zum fertigen Beratungsfall (Desktop horizontal, mobil vertikal). */
export function FlowSection() {
  return (
    <section aria-labelledby="flow-title" className="border-y border-border bg-muted/60 py-12 sm:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 id="flow-title" className="text-sm font-semibold tracking-wider text-muted-foreground">
          SO ENTSTEHT AUS EINER ANFRAGE EIN FERTIGER FALL
        </h2>
        <ol className="mt-6 grid gap-3 lg:grid-cols-6 lg:gap-2">
          {flow.map((step, i) => (
            <li key={step.title} className="relative">
              <div className={cn("h-full rounded-lg border p-4", i === flow.length - 1 ? "border-accent bg-accent-soft" : "border-border bg-card")}>
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

/** Läuft automatisch ab (Mail rein → KI antwortet → Vorlage wird verschickt → vollständig) – als
 * selbsterklärendes "Kurzvideo" ohne echte Videodatei, direkt unter dem Hero. */
export function MailFlowSection() {
  return (
    <Section title="So sieht ein echter Fall aus – in Echtzeit." intro="Von der ersten Kundenmail bis zum bestätigten Termin – in 25 Sekunden. Links Ihr Postfach, rechts die Fallakte, die FallFlow dabei automatisch füllt.">
      <CaseFilm />
    </Section>
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
  { n: "02", title: "Ihre Antwort, automatisch", text: "Die KI schickt Ihre eigene Nachricht zur Leistung samt Ihren PDF-Formularen und sagt dem Kunden genau, welche Unterlagen noch fehlen." },
  { n: "03", title: "Unterlagen kommen per Mail", text: "Ausgefüllte Formulare, Grundriss und Energieausweis schickt der Kunde einfach als Antwort – FallFlow prüft sie, liest die Angaben aus und legt alles in der Fallakte ab." },
  { n: "04", title: "Fertige Fallakte", text: "Sie erhalten eine Fallakte mit Vollständigkeit, Dokumenten, Verlauf, Zusammenfassung und Terminvorschlag. Fragen von Kunden beantworten Sie selbst – die KI erfindet keine Antworten." },
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
    <Section id="demo" title="Probieren Sie den Ablauf selbst aus." intro="Links der E-Mail-Verlauf zwischen Kunde und KI, rechts entsteht die Fallakte – Schritt für Schritt. Die Demo läuft ohne Anmeldung.">
      <MailDemo />
      <div className="mt-6">
        <Link href="/demo" className={buttonStyles({ variant: "secondary" })}>
          Demo im Vollbild öffnen
        </Link>
      </div>
    </Section>
  );
}

const features: { icon: Icon; title: string; text: string; soon?: boolean }[] = [
  { icon: Workflow, title: "AI Intake", text: "Alle laufenden Anfragen mit klarem Status – von „Neu“ bis „Bereit zur Prüfung“." },
  { icon: MessageCircleQuestion, title: "Aufmerksamkeit benötigt", text: "Stellt ein Kunde eine Frage oder ist die Leistung unklar, antwortet nicht die KI, sondern Sie – FallFlow sagt Ihnen Bescheid." },
  { icon: ClipboardCheck, title: "Vollständigkeit in %", text: "Jeder Fall zeigt auf einen Blick, was vorliegt und was noch fehlt." },
  { icon: FileText, title: "Fallakte", text: "Kunde, Gebäude, Anliegen, Dokumente, Kommunikation und Zusammenfassung an einem Ort." },
  { icon: FileUp, title: "Ausgefüllte PDFs auslesen", text: "Was der Kunde ins Formular einträgt, landet automatisch in der Fallakte – die PDF selbst natürlich auch." },
  { icon: Inbox, title: "Posteingang", text: "Alle Mails und Telefonnotizen, automatisch dem richtigen Kunden und Fall zugeordnet." },
  { icon: Globe, title: "Website-Chat", text: "Die KI beantwortet Besucherfragen zu Ihren Leistungen – eingebunden mit einem Script-Tag." },
  { icon: Mail, title: "E-Mail-Anbindung", text: "Per IMAP/SMTP verbunden – funktioniert mit Gmail, Outlook, IONOS, Strato, T-Online und praktisch jedem Postfach." },
  { icon: CalendarCheck, title: "Terminübergabe", text: "Vorbereitete Fälle lassen sich direkt mit einem Terminvorschlag weitergeben." },
  { icon: Sparkles, title: "KI-Zusammenfassung", text: "Kurze, sachliche Zusammenfassung – nur aus den erfassten Angaben, keine Beratung." },
  { icon: FileText, title: "PDF-Vorlagen je Leistung", text: "Passende Vollmachten & Formulare gehen automatisch mit – zum Ausfüllen oder nur zur Info (z. B. Preisliste)." },
  { icon: Mail, title: "Testmail ausprobieren", text: "Sehen Sie vor dem Start genau, was Ihre Kunden bekommen – ohne dass etwas verschickt wird." },
  { icon: Sparkles, title: "KI-Voreinschätzung", text: "Erste fachliche Einordnung des Falls auf Basis der Fallakte – der Berater prüft und entscheidet." },
  { icon: PiggyBank, title: "Förderschätzung (BAFA/KfW)", text: "Grobe Förderquote als Entwurf – das Büro prüft und versendet erst nach Freigabe." },
  { icon: Ruler, title: "Bauteilwerte-Richtwerte", text: "U-Werte für Wand, Fenster & Dach nach Baualtersklasse, einzeln übernehmbar in die Fallakte." },
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

const focus = ["Intake", "Qualifizierung", "Datensammlung", "Dokumente", "Fallerstellung"];

export function NoCrmSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Kein CRM. Kein ERP. Kein Allzweck-Chatbot.</h2>
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
  { size: "6–10 Mitarbeiter", text: "Gemeinsame Vorlagen, Rollen und ein zentraler Überblick über alle Anfragen und Dokumente." },
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
            <p className="mt-1 text-xs text-muted-foreground">7 Tage kostenlos testen, ohne Kreditkarte – oder direkt starten. Monatlich kündbar. {VAT_NOTE}</p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm">
              {p.features.map((f) => (
                <li key={f} className={cn("flex items-start gap-2", p.extras.includes(f) && "font-semibold")}>
                  <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href={`/signup?plan=${p.id}`} className={buttonStyles({ variant: p.highlighted ? "primary" : "secondary", className: "mt-6" })}>
              7 Tage kostenlos testen
            </Link>
            <Link href={`/signup?plan=${p.id}&buy=1`} className={buttonStyles({ variant: "ghost", className: "mt-2 border border-border" })}>
              Direkt kaufen
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
          <details key={f.q} className="group rounded-lg border border-border bg-card px-5 py-4">
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
      <div className="mx-auto max-w-4xl rounded-lg bg-black px-6 py-14 text-center text-white sm:px-12">
        <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Verwandeln Sie Ihre nächste Kundenanfrage in einen fertigen Beratungsfall.</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className={buttonStyles({ size: "lg", className: "bg-white text-black hover:bg-white" })}>
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

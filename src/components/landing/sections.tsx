import {
  ArrowDown,
  ArrowRight,
  BellRing,
  Building2,
  CalendarCheck,
  Camera,
  Check,
  ClipboardCheck,
  Clock,
  FileQuestion,
  FileText,
  FileUp,
  Globe,
  Inbox,
  Languages,
  Mail,
  MessageCircle,
  MessageCircleQuestion,
  Phone,
  Repeat,
  ScatterChart,
  Siren,
  Sparkles,
  Star,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { MailDemo } from "@/components/landing/mail-demo";
import { IndustryFilm } from "@/components/landing/industry-film";
import { buttonStyles } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { faqs } from "@/lib/config/faq";
import { plans, VAT_NOTE } from "@/lib/config/pricing";
import { cn } from "@/lib/utils";

type Icon = ComponentType<{ className?: string }>;

/** h1 = Hauptüberschrift der Seite (auf Unterseiten, deren erster Abschnitt dieser ist). */
function Section({ id, title, intro, children, tinted, h1 }: { id?: string; title: string; intro?: string; children: ReactNode; tinted?: boolean; h1?: boolean }) {
  const Heading = h1 ? "h1" : "h2";
  return (
    <section id={id} className={cn("scroll-mt-16 py-16 sm:py-20", tinted && "border-y border-border bg-muted/60")}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Heading className="max-w-3xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{title}</Heading>
        {intro && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{intro}</p>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

const flow = [
  { title: "Kundenanfrage", text: "Per E-Mail, WhatsApp, Website-Chat oder Telefon" },
  { title: "KI-Qualifizierung", text: "Bekannte Angaben werden erkannt" },
  { title: "Fehlende Daten", text: "Die KI fordert per Mail nur an, was noch fehlt" },
  { title: "Unterlagen", text: "Formulare und Fotos kommen per Mail-Antwort" },
  { title: "Termin", text: "Terminvorschlag zum fertigen Fall" },
  { title: "Fertiger Auftrag", text: "Sie übernehmen nur noch den fertig vorbereiteten Fall" },
];

/** Der Ablauf von der Anfrage bis zum fertigen Auftrag (Desktop horizontal, mobil vertikal). */
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
export function MailFlowSection({ h1 = false }: { h1?: boolean } = {}) {
  return (
    <Section h1={h1} title="So sieht ein echter Fall aus – in Echtzeit." intro="Von der ersten Kundenmail bis zum bestätigten Termin – in 25 Sekunden. Links Ihr Postfach, rechts die Fallakte, die FallFlow dabei automatisch füllt.">
      <IndustryFilm />
    </Section>
  );
}

const problems: { icon: Icon; title: string }[] = [
  { icon: FileQuestion, title: "Unvollständige Anfragen" },
  { icon: Mail, title: "Rückfragen per E-Mail" },
  { icon: ClipboardCheck, title: "Fehlende Angaben zum Auftrag" },
  { icon: ScatterChart, title: "Verstreute Informationen" },
  { icon: Repeat, title: "Manuelles Übertragen" },
  { icon: Clock, title: "Zeitverlust vor dem ersten Gespräch" },
];

export function ProblemSection() {
  return (
    <Section title="Die eigentliche Arbeit beginnt oft vor dem Auftrag." intro="Bevor Sie ein Angebot machen oder einen Termin vergeben können, müssen erst die Grundlagen geklärt sein – meist in mehreren Runden und über mehrere Kanäle.">
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
  { n: "01", title: "KI versteht die Anfrage", text: "„Sturmschaden, Satteldach, ca. 10 m², Gräfelfing“ – Leistung, Angaben und Adresse werden sofort erkannt und übernommen." },
  { n: "02", title: "Ihre Antwort, automatisch", text: "Die KI schickt Ihre eigene Nachricht zur Leistung samt Ihren PDF-Formularen und sagt dem Kunden genau, welche Unterlagen noch fehlen." },
  { n: "03", title: "Unterlagen kommen per Mail", text: "Ausgefüllte Formulare, Fotos und andere Unterlagen schickt der Kunde einfach als Antwort – FallFlow prüft sie, liest die Angaben aus und legt alles in der Fallakte ab." },
  { n: "04", title: "Fertige Fallakte", text: "Sie erhalten eine Fallakte mit Vollständigkeit, Dokumenten, Verlauf, Zusammenfassung und Terminvorschlag. Fragen von Kunden beantworten Sie selbst – die KI erfindet keine Antworten." },
];

export function SolutionSection() {
  return (
    <Section id="so-funktioniert-es" tinted title="FallFlow erledigt die Datensammlung vor dem ersten Gespräch." intro="Vom ersten Kontakt bis zum vorbereiteten Fall – ohne dass jemand aus Ihrem Betrieb Angaben hinterhertelefonieren muss.">
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
    <Section id="demo" title="Probieren Sie den Ablauf selbst aus." intro="Links der Verlauf zwischen Kunde und KI – per E-Mail oder WhatsApp –, rechts entsteht die Fallakte. Schritt für Schritt, ohne Anmeldung.">
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
  { icon: Workflow, title: "Alle Anfragen im Blick", text: "Alle laufenden Anfragen mit klarem Status – von „Neu“ bis „Bereit zur Prüfung“." },
  { icon: MessageCircle, title: "WhatsApp", text: "Kunden schreiben Ihnen per WhatsApp – die KI fragt Schritt für Schritt nach, versteht auch Sprachnachrichten, Fotos landen in der Fallakte." },
  { icon: CalendarCheck, title: "Online-Terminbuchung", text: "Sind alle Angaben da, wählt der Kunde per Link selbst einen freien Termin – belegte Zeiten aus Ihrem Outlook-Kalender bleiben frei." },
  { icon: FileText, title: "Angebot per Klick", text: "Die KI entwirft den Kostenvoranschlag aus Anfrage und Ihrer Preisliste. Sie prüfen, ergänzen und senden ihn als PDF." },
  { icon: BellRing, title: "Automatische Erinnerungen", text: "Fehlen Angaben, erinnert FallFlow den Kunden. Am Vortag eines Termins kommt eine kurze Terminerinnerung." },
  { icon: Siren, title: "Notfälle sofort aufs Handy", text: "Notfälle und Reklamationen erkennt FallFlow, gibt sie an Sie weiter und meldet Notfälle sofort per Push-Nachricht." },
  { icon: Camera, title: "Foto-Einschätzung", text: "Die KI schaut sich die Fotos des Kunden an und notiert, was zu sehen ist – nur für Sie, als Vorbereitung für vor Ort." },
  { icon: Languages, title: "In der Sprache des Kunden", text: "Schreibt ein Kunde Englisch, Türkisch oder Polnisch, antwortet FallFlow in seiner Sprache. Sie lesen und schreiben weiter Deutsch." },
  { icon: Star, title: "Google-Bewertungen", text: "Nach dem Termin bittet FallFlow zufriedene Kunden um eine Bewertung – mit Ihrem Link, einmal und freundlich." },
  { icon: Phone, title: "Telefon-Assistent", text: "Geht niemand ran, nimmt die KI den Anruf an, fragt das Nötige ab und legt den Fall an – mit KI-Hinweis, ohne Aufzeichnung. Ab Tarif Pro.", soon: true },
  { icon: MessageCircleQuestion, title: "Aufmerksamkeit benötigt", text: "Stellt ein Kunde eine Frage oder ist die Leistung unklar, antwortet nicht die KI, sondern Sie – FallFlow sagt Ihnen Bescheid." },
  { icon: ClipboardCheck, title: "Vollständigkeit in %", text: "Jeder Fall zeigt auf einen Blick, was vorliegt und was noch fehlt." },
  { icon: FileText, title: "Fallakte", text: "Kunde, Angaben zum Auftrag, Unterlagen, Kommunikation und eine kurze KI-Zusammenfassung an einem Ort." },
  { icon: FileUp, title: "Ausgefüllte PDFs auslesen", text: "Was der Kunde ins Formular einträgt, landet automatisch in der Fallakte – die PDF selbst natürlich auch." },
  { icon: Inbox, title: "Posteingang", text: "Alle Mails und Telefonnotizen, automatisch dem richtigen Kunden und Fall zugeordnet." },
  { icon: Globe, title: "Website-Chat", text: "Die KI beantwortet Besucherfragen zu Ihren Leistungen – eingebunden mit einem Script-Tag." },
  { icon: Mail, title: "E-Mail-Anbindung", text: "Per IMAP/SMTP verbunden – funktioniert mit Gmail, Outlook, IONOS, Strato, T-Online und praktisch jedem Postfach." },
  { icon: Sparkles, title: "Wissen & Preise", text: "Hinterlegen Sie Preise und häufige Fragen – die KI beantwortet sie, erfindet aber nie selbst einen Preis." },
  { icon: Building2, title: "Für Ihre Branche eingerichtet", text: "Beschreiben Sie Ihren Betrieb in zwei Sätzen – die KI schlägt Leistungen, Angaben und Unterlagen vor. Sie entscheiden." },
  { icon: Mail, title: "Alles bearbeitbar", text: "Jeder Text, den FallFlow an Kunden schickt, lässt sich ändern. Mit der Testmail sehen Sie vorher genau, was ankommt." },
];

const MOBILE_FEATURES = 6;

function FeatureCard({ icon: I, title, text, soon }: (typeof features)[number]) {
  return (
    <Card className="h-full p-5">
      <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <I className="size-5" />
      </span>
      <h3 className="mt-4 flex flex-wrap items-center gap-2 font-semibold">
        {title}
        {soon && <Badge>bald verfügbar</Badge>}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </Card>
  );
}

export function FeaturesSection({ h1 = false }: { h1?: boolean } = {}) {
  return (
    <Section id="funktionen" h1={h1} tinted title="Alles, was zwischen Anfrage und Auftrag liegt.">
      {/* Am Handy erst die 6 wichtigsten, der Rest aufklappbar – sonst wird die Seite sehr lang. */}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <li key={f.title} className={i >= MOBILE_FEATURES ? "hidden sm:block" : undefined}>
            <FeatureCard {...f} />
          </li>
        ))}
      </ul>
      <details className="group mt-4 sm:hidden">
        <summary className="flex h-11 cursor-pointer list-none items-center justify-center rounded-full border border-border bg-card text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Alle {features.length} Funktionen anzeigen</span>
          <span className="hidden group-open:inline">Weniger anzeigen</span>
        </summary>
        <ul className="mt-4 grid gap-4">
          {features.slice(MOBILE_FEATURES).map((f) => (
            <li key={f.title}>
              <FeatureCard {...f} />
            </li>
          ))}
        </ul>
      </details>
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
          FallFlow versucht nicht, Ihre Branchensoftware zu ersetzen. Es übernimmt genau den Teil zwischen erster Kundenanfrage und fertig vorbereitetem Auftrag – und übergibt dann.
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
  { size: "Handwerk", text: "Dachdecker, Elektriker, Maler, Sanitär & Heizung, Tischler, Fliesenleger, Photovoltaik – Anfragen mit Fotos und allen Angaben, bevor Sie losfahren." },
  { size: "Dienstleister & Beratung", text: "Hausverwaltungen, Reinigung, Gartenbau, Umzug, Energieberater – Schadensmeldungen, Aufträge und Beratungsanfragen sauber erfasst." },
  { size: "Betriebe mit Terminen", text: "Werkstätten, Friseure, Kosmetikstudios, Tierarztpraxen, Fotografen – die KI sammelt die Angaben, der Kunde bucht seinen Termin selbst." },
];

export function AudienceSection() {
  return (
    <Section tinted title="Für kleine Betriebe jeder Branche" intro="Mit fertigen Vorlagen für 17 Branchen – von Dachdecker, Elektriker, Maler und SHK über Photovoltaik, Fliesenleger und Energieberater bis zu Hausverwaltungen, Werkstätten, Friseuren und Fotografen.">
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
      <Link href="/branchen" className={buttonStyles({ variant: "secondary", className: "mt-6" })}>
        Alle Branchen ansehen <ArrowRight className="size-4" />
      </Link>
    </Section>
  );
}

export function PricingSection({ h1 = false }: { h1?: boolean } = {}) {
  return (
    <Section id="preise" h1={h1} title="Einfache, monatliche Preise." intro="Wählen Sie den Plan, der zur Größe Ihres Betriebs passt.">
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

export function FaqSection({ h1 = false }: { h1?: boolean } = {}) {
  return (
    <Section id="faq" h1={h1} tinted title="Häufige Fragen">
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
        <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Verwandeln Sie Ihre nächste Kundenanfrage in einen fertig vorbereiteten Auftrag.</h2>
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

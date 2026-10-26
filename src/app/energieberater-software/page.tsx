import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Clock, FileCheck2, MessageSquareReply, ShieldCheck, UserCheck } from "lucide-react";
import { CaseFilm } from "@/components/landing/case-film";
import { Footer } from "@/components/landing/footer";
import { MobileCta } from "@/components/landing/mobile-cta";
import { Navbar } from "@/components/landing/navbar";
import { ReviewsSection } from "@/components/landing/reviews";
import { FaqSection, PricingSection } from "@/components/landing/sections";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SetupVideoButton } from "@/components/ui/setup-video";

/**
 * Zielseite für Google-Ads-Anzeigen ("Software für Energieberater"): kurz, greift die Suchworte auf und hat nur ein Ziel –
 * die kostenlose Testphase. Nicht im Suchindex, damit sie der Startseite keine Konkurrenz macht.
 */
export const metadata: Metadata = {
  title: "Software für Energieberater – Kundenanfragen automatisch beantworten",
  description:
    "FallFlow beantwortet Kundenanfragen automatisch mit Ihren Texten und PDF-Formularen, fordert fehlende Unterlagen an und bereitet jeden Fall vor. 7 Tage kostenlos testen.",
  alternates: { canonical: "/energieberater-software" },
  robots: { index: false, follow: true },
};

const benefits = [
  {
    icon: MessageSquareReply,
    title: "Antwort in Minuten statt Tagen",
    text: "Jede neue Anfrage bekommt sofort Ihre passende Antwort – mit Ihrem Text und Ihren Formularen zur gewünschten Leistung.",
  },
  {
    icon: FileCheck2,
    title: "Unterlagen kommen vollständig",
    text: "FallFlow fordert Grundriss, Energieausweis und Ihr Datenerfassungsblatt an, prüft sie und fragt nach, wenn etwas fehlt.",
  },
  {
    icon: UserCheck,
    title: "Sie behalten die Kontrolle",
    text: "Fragen zu Preisen oder Sonderwünsche beantwortet nicht die KI, sondern Sie. Sie bekommen nur fertig vorbereitete Fälle.",
  },
];

const trust = ["7 Tage kostenlos", "Ohne Kreditkarte", "Monatlich kündbar", "Server in der EU"];

export default function EnergieberaterSoftwarePage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="hero-grid-bg relative overflow-hidden">
          <div className="relative mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 lg:py-20">
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white/80 px-4 py-1.5 text-[13px] font-medium text-zinc-600 shadow-sm">
              Software für Energieberater
            </span>
            <h1 className="mt-5 text-balance text-[clamp(2rem,5vw+0.5rem,3.5rem)] font-black leading-[1.05] tracking-[-0.03em] text-zinc-900">
              Kundenanfragen automatisch beantworten.
              <span className="mt-1 block text-zinc-400">Mit Ihren Texten und Formularen.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-500 sm:text-lg">
              FallFlow liest Ihre Anfragen per E-Mail, antwortet mit Ihrer Nachricht zur passenden Leistung, fordert fehlende Unterlagen an und legt jeden Fall
              fertig vorbereitet für Sie ab.
            </p>
            <div className="mx-auto mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
              <Link href="/signup" className={buttonStyles({ size: "lg" })}>
                7 Tage kostenlos testen <ArrowRight className="size-4" />
              </Link>
              <Link href="#so-sieht-es-aus" className={buttonStyles({ variant: "ghost", size: "lg", className: "border border-zinc-200 bg-white hover:bg-zinc-50" })}>
                So sieht es aus
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-zinc-500">
              {trust.map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-success" aria-hidden /> {t}
                </li>
              ))}
            </ul>
            <p className="mx-auto mt-8 flex max-w-2xl items-start gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />
              <span>
                <span className="font-semibold text-foreground">Kein Berechnungsprogramm:</span> FallFlow ergänzt Ihre Software für Energieausweise und iSFP
                (z. B. Hottgenroth oder ZUB) und übernimmt die Arbeit davor – Anfragen, Unterlagen, Termine.
              </span>
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <ul className="grid gap-4 md:grid-cols-3">
            {benefits.map(({ icon: I, title, text }) => (
              <li key={title}>
                <Card className="h-full p-6">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <I className="size-5" aria-hidden />
                  </span>
                  <h2 className="mt-4 font-semibold">{title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <section id="so-sieht-es-aus" className="scroll-mt-20 border-y border-border bg-muted/60 py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">So sieht ein Fall in FallFlow aus</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">Von der ersten Kundenmail bis zum Terminvorschlag – in 25 Sekunden.</p>
            <div className="mt-8">
              <CaseFilm />
            </div>
            <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" aria-hidden /> Einrichtung in etwa 10 Minuten –
              <SetupVideoButton label="So geht's" className="text-foreground" />
            </p>
          </div>
        </section>

        <ReviewsSection />
        <PricingSection />
        <FaqSection />

        <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Weniger Büroarbeit ab der nächsten Anfrage.</h2>
          <p className="mt-3 text-muted-foreground">7 Tage kostenlos testen – ohne Kreditkarte, monatlich kündbar.</p>
          <Link href="/signup" className={buttonStyles({ size: "lg", className: "mt-8" })}>
            Jetzt kostenlos testen <ArrowRight className="size-4" />
          </Link>
        </section>
      </main>
      <Footer />
      <MobileCta />
    </>
  );
}

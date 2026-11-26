import { Footer } from "@/components/landing/footer";
import { MobileCta } from "@/components/landing/mobile-cta";
import { Hero } from "@/components/landing/hero";
import { Navbar } from "@/components/landing/navbar";
import type { Metadata } from "next";
import { faqs } from "@/lib/config/faq";
import { faqLd, ldJson, organizationLd, softwareLd } from "@/lib/seo";
import { AnswersSection, ControlSection, FaqSection, FinalCta, MailFlowSection, PersonalSection, PricingSection, SimpleStepsSection } from "@/components/landing/sections";

export const metadata: Metadata = {
  title: { absolute: "FallFlow – Kundenanfragen automatisch beantworten für Handwerker" },
  description: "Keine Anfrage geht mehr verloren: FallFlow beantwortet Kundenanfragen per E-Mail und WhatsApp in wenigen Minuten, fragt fehlende Angaben und Fotos ab und legt Ihnen den fertigen Auftrag hin. Wir richten alles für Sie ein – 7 Tage kostenlos.",
  alternates: { canonical: "/" },
};

const HOME_FAQS = [
  "Wie aufwendig ist die Einrichtung?",
  "Schreibt die KI meinen Kunden eigene Texte?",
  "Erfindet die KI Preise?",
  "Funktioniert das auch mit WhatsApp und Telefon?",
  "Für welche Betriebe ist FallFlow geeignet?",
  "Wo werden Kundendaten gespeichert?",
];

/** Startseite bewusst kurz: ein Versprechen, der Film als Beweis, drei Schritte, ein persönlicher Ansprechpartner – Details stehen auf /funktionen und /branchen. */
export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <MailFlowSection />
        <AnswersSection />
        <SimpleStepsSection />
        <ControlSection />
        <PersonalSection />
        <PricingSection />
        <FaqSection only={HOME_FAQS} />
        <FinalCta />
      </main>
      <Footer />
      <MobileCta />
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(organizationLd())} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(softwareLd())} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(faqLd(faqs.filter((f) => HOME_FAQS.includes(f.q))))} />
    </>
  );
}

import { Footer } from "@/components/landing/footer";
import { MobileCta } from "@/components/landing/mobile-cta";
import { Hero } from "@/components/landing/hero";
import { Navbar } from "@/components/landing/navbar";
import { ControlSection, FaqSection, FinalCta, MailFlowSection, PersonalSection, PricingSection, SimpleStepsSection } from "@/components/landing/sections";

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
        <SimpleStepsSection />
        <ControlSection />
        <PersonalSection />
        <PricingSection />
        <FaqSection only={HOME_FAQS} />
        <FinalCta />
      </main>
      <Footer />
      <MobileCta />
    </>
  );
}

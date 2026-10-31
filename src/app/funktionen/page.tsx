import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { MobileCta } from "@/components/landing/mobile-cta";
import { Navbar } from "@/components/landing/navbar";
import { FeaturesSection, FinalCta, NoCrmSection, PricingSection } from "@/components/landing/sections";

/** Eigene Seite (z. B. als Ziel für Google-Ads-Sitelinks), mit denselben Abschnitten wie auf der Startseite. */
export const metadata: Metadata = {
  title: "Funktionen",
  description: "Alle Funktionen von FallFlow für Betriebe jeder Branche: automatische Antworten per E-Mail und WhatsApp, Online-Terminbuchung, Angebote als PDF, Erinnerungen, Fallakte und Website-Chat.",
  alternates: { canonical: "/funktionen" },
};

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <FeaturesSection h1 />
        <NoCrmSection />
        <PricingSection />
        <FinalCta />
      </main>
      <Footer />
      <MobileCta />
    </>
  );
}

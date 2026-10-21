import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { FeaturesSection, FinalCta, NoCrmSection, PricingSection } from "@/components/landing/sections";

/** Eigene Seite (z. B. als Ziel für Google-Ads-Sitelinks), mit denselben Abschnitten wie auf der Startseite. */
export const metadata: Metadata = {
  title: "Funktionen",
  description: "Alle Funktionen von FallFlow für Energieberater: automatische Antworten, Formulare, Fallakte, Website-Chat und Termine.",
  alternates: { canonical: "/funktionen" },
};

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <FeaturesSection />
        <NoCrmSection />
        <PricingSection />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}

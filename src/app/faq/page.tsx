import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { MobileCta } from "@/components/landing/mobile-cta";
import { Navbar } from "@/components/landing/navbar";
import { FaqSection, FinalCta, PricingSection } from "@/components/landing/sections";

/** Eigene Seite (z. B. als Ziel für Google-Ads-Sitelinks), mit denselben Abschnitten wie auf der Startseite. */
export const metadata: Metadata = {
  title: "Häufige Fragen",
  description: "Antworten auf häufige Fragen zu FallFlow: Datenschutz, Einrichtung, Kosten und Ablauf.",
  alternates: { canonical: "/faq" },
};

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <FaqSection h1 />
        <PricingSection />
        <FinalCta />
      </main>
      <Footer />
      <MobileCta />
    </>
  );
}

import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { FaqSection, FinalCta, PricingSection } from "@/components/landing/sections";

/** Eigene Seite (z. B. als Ziel für Google-Ads-Sitelinks), mit denselben Abschnitten wie auf der Startseite. */
export const metadata: Metadata = {
  title: "Preise",
  description: "Preise von FallFlow: Starter, Pro und Business – monatlich kündbar, 7 Tage kostenlos testen.",
  alternates: { canonical: "/preise" },
};

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}

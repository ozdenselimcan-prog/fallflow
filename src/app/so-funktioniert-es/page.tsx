import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { MobileCta } from "@/components/landing/mobile-cta";
import { Navbar } from "@/components/landing/navbar";
import { DemoSection, FinalCta, FlowSection, MailFlowSection, SolutionSection } from "@/components/landing/sections";

/** Eigene Seite (z. B. als Ziel für Google-Ads-Sitelinks), mit denselben Abschnitten wie auf der Startseite. */
export const metadata: Metadata = {
  title: "So funktioniert es",
  description: "So funktioniert FallFlow: Von der ersten Kundenanfrage per E-Mail bis zum fertig vorbereiteten Auftrag.",
  alternates: { canonical: "/so-funktioniert-es" },
};

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <MailFlowSection h1 />
        <FlowSection />
        <SolutionSection />
        <DemoSection />
        <FinalCta />
      </main>
      <Footer />
      <MobileCta />
    </>
  );
}

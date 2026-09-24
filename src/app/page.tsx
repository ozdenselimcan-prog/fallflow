import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { Navbar } from "@/components/landing/navbar";
import {
  AudienceSection,
  DemoSection,
  FaqSection,
  FeaturesSection,
  FinalCta,
  NoCrmSection,
  PricingSection,
  ProblemSection,
  SolutionSection,
} from "@/components/landing/sections";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ProblemSection />
        <SolutionSection />
        <DemoSection />
        <FeaturesSection />
        <NoCrmSection />
        <AudienceSection />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}

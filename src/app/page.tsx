import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { Navbar } from "@/components/landing/navbar";
import { ReviewsSection } from "@/components/landing/reviews";
import {
  AudienceSection,
  DemoSection,
  FaqSection,
  FeaturesSection,
  FinalCta,
  FlowSection,
  MailFlowSection,
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
        <MailFlowSection />
        <FlowSection />
        <ProblemSection />
        <SolutionSection />
        <DemoSection />
        <FeaturesSection />
        <NoCrmSection />
        <AudienceSection />
        <ReviewsSection />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}

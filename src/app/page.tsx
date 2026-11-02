import { Footer } from "@/components/landing/footer";
import { MobileCta } from "@/components/landing/mobile-cta";
import { Hero } from "@/components/landing/hero";
import { Navbar } from "@/components/landing/navbar";
import { ReviewsSection } from "@/components/landing/reviews";
import { UsageStats } from "@/components/landing/usage-stats";
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
        <div className="-mt-6 px-4 pb-16 text-center sm:px-6">
          <UsageStats />
        </div>
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
      <MobileCta />
    </>
  );
}

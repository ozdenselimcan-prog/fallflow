import { plans } from "@/lib/config/pricing";
import { siteConfig } from "@/lib/config/site";

/**
 * Strukturierte Daten (schema.org) für Google: wer hinter FallFlow steht, was es kostet und häufige Fragen.
 * Nur Angaben, die auch sichtbar auf der Seite bzw. im Impressum stehen – keine Bewertungen o. Ä.
 */
export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.appUrl,
    logo: `${siteConfig.appUrl}/brand/logo-full.png`,
    email: siteConfig.supportEmail,
    telephone: siteConfig.phone,
    address: { "@type": "PostalAddress", streetAddress: "Karlsteinstraße 2", postalCode: "80937", addressLocality: "München", addressCountry: "DE" },
  };
}

export function softwareLd() {
  const prices = plans.map((p) => p.priceEur);
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: siteConfig.description,
    url: siteConfig.appUrl,
    offers: { "@type": "AggregateOffer", priceCurrency: "EUR", lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: prices.length },
  };
}

export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** <script type="application/ld+json"> – JSON so maskiert, dass kein "</script>" im Inhalt die Seite aufbrechen kann. */
export const ldJson = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });

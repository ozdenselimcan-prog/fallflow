export const siteConfig = {
  name: "FallFlow",
  description:
    "FallFlow sammelt fehlende Informationen automatisch, strukturiert Kundenanfragen und übergibt Energieberatungsbüros vollständige Fälle.",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

export const navLinks = [
  { label: "Produkt", href: "/#produkt" },
  { label: "Funktionen", href: "/#funktionen" },
  { label: "So funktioniert's", href: "/#so-funktioniert-es" },
  { label: "Preise", href: "/#preise" },
  { label: "FAQ", href: "/#faq" },
];

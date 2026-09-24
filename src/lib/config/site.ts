export const siteConfig = {
  name: "FallFlow",
  description:
    "FallFlow sammelt automatisch die fehlenden Informationen, fordert Dokumente an und bereitet neue Kundenfälle für Energieberater vor.",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

export const navLinks = [
  { label: "Produkt", href: "/#produkt" },
  { label: "Funktionen", href: "/#funktionen" },
  { label: "So funktioniert's", href: "/#so-funktioniert-es" },
  { label: "Preise", href: "/#preise" },
  { label: "FAQ", href: "/#faq" },
];

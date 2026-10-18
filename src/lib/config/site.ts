export const siteConfig = {
  name: "FallFlow",
  description:
    "FallFlow beantwortet E-Mail-Anfragen an Energieberater mit Ihren eigenen Texten und Vorlagen, sammelt Unterlagen ein und bereitet fertige Beratungsfälle samt Terminvorschlag vor.",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supportEmail: "support@fallflow.xyz",
};

export const navLinks = [
  { label: "Produkt", href: "/#produkt" },
  { label: "Funktionen", href: "/#funktionen" },
  { label: "So funktioniert's", href: "/#so-funktioniert-es" },
  { label: "Preise", href: "/#preise" },
  { label: "FAQ", href: "/#faq" },
];

export const siteConfig = {
  name: "FallFlow",
  description:
    "FallFlow beantwortet Kundenanfragen für Ihren Betrieb automatisch mit Ihren eigenen Texten und Vorlagen, sammelt Unterlagen ein und bereitet fertige Aufträge samt Terminvorschlag vor.",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supportEmail: "support@fallflow.xyz",
  phone: "+49 176 21546311",
};

/** Nur die echte Domain darf bei Google erscheinen – Test-Adressen (z. B. *.vercel.app) nicht, sonst gilt die echte Seite später als Kopie. */
export const indexable = /^https:\/\/(www\.)?fallflow\.xyz/.test(siteConfig.appUrl);

export const navLinks = [
  { label: "Produkt", href: "/#produkt" },
  { label: "Funktionen", href: "/#funktionen" },
  { label: "So funktioniert's", href: "/#so-funktioniert-es" },
  { label: "Branchen", href: "/branchen" },
  { label: "Preise", href: "/#preise" },
  { label: "FAQ", href: "/#faq" },
];

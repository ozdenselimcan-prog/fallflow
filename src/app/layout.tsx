import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { ConsentBanner } from "@/components/consent/consent-banner";
import { indexable, siteConfig } from "@/lib/config/site";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${siteConfig.name} – Kundenanfragen automatisch bearbeiten`, template: `%s · ${siteConfig.name}` },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.appUrl),
  robots: indexable ? undefined : { index: false, follow: false },
  keywords: ["Kundenanfragen automatisieren", "KI E-Mail Assistent", "Anfragen automatisch beantworten", "KI für Handwerker", "KI für kleine Unternehmen", "Fallakte", "E-Mail-Automatisierung", "Kundenservice automatisieren"],
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: siteConfig.name,
    title: `${siteConfig.name} – Kundenanfragen automatisch bearbeiten`,
    description: siteConfig.description,
  },
  twitter: { card: "summary_large_image", title: `${siteConfig.name} – Kundenanfragen automatisch bearbeiten`, description: siteConfig.description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${geist.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        {children}
        <ConsentBanner />
        {/* Besucherstatistik ohne Cookies und ohne persönliche Profile (siehe Datenschutzerklärung). */}
        <Analytics />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { ConsentBanner } from "@/components/consent/consent-banner";
import { siteConfig } from "@/lib/config/site";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${siteConfig.name} – Aus jeder Kundenanfrage einen fertigen Beratungsfall`, template: `%s · ${siteConfig.name}` },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.appUrl),
  keywords: ["Energieberater Software", "Energieberatung Kundenanfragen", "iSFP", "Energieausweis", "KI für Energieberater", "Fallakte", "E-Mail-Automatisierung", "Fördermittelberatung"],
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: siteConfig.name,
    title: `${siteConfig.name} – Aus jeder Kundenanfrage einen fertigen Beratungsfall`,
    description: siteConfig.description,
  },
  twitter: { card: "summary_large_image", title: `${siteConfig.name} – Aus jeder Kundenanfrage einen fertigen Beratungsfall`, description: siteConfig.description },
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

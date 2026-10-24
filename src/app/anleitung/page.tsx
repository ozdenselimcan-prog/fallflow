import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { buttonStyles } from "@/components/ui/button";
import { SetupVideoPlayer } from "@/components/ui/setup-video";

export const metadata: Metadata = {
  title: "Anleitung: FallFlow einrichten",
  description: "Im Video: So richten Sie FallFlow in wenigen Minuten ein – Konto, Leistungen, Vorlagen & Nachrichten, Termine und E-Mail-Postfach.",
  alternates: { canonical: "/anleitung" },
};

const steps = [
  ["Konto erstellen", "7 Tage kostenlos testen, ohne Kreditkarte. Danach E-Mail-Adresse bestätigen."],
  ["Firmendaten und Leistungen", "Name, Website und Adresse Ihres Büros – und welche Leistungen Sie anbieten."],
  ["Vorlagen & Nachrichten", "Pro Leistung Ihr eigener Text und Ihre PDF-Formulare, die automatisch an den Kunden gehen."],
  ["Termine und Website-Chat", "Wann Sie Termine anbieten; den Chat-Code schicken Sie bei Bedarf Ihrem Webdesigner."],
  ["E-Mail-Postfach verbinden", "Outlook / Microsoft 365 mit einem Klick, Gmail, GMX, IONOS & Co. mit (App-)Passwort."],
  ["Testmail ausprobieren", "Sehen Sie genau, was Ihre Kunden bekommen – ohne dass etwas verschickt wird."],
];

export default function AnleitungPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">So richten Sie FallFlow ein</h1>
        <p className="mt-3 text-muted-foreground">In etwa 10 Minuten startklar – hier sehen Sie jeden Schritt in 90 Sekunden.</p>
        <SetupVideoPlayer className="mt-8" />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2">
          {steps.map(([title, text], i) => (
            <li key={title} className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-muted-foreground">Schritt {i + 1}</p>
              <p className="mt-1 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link href="/signup" className={buttonStyles({ size: "lg" })}>
            7 Tage kostenlos testen
          </Link>
          <span className="text-sm text-muted-foreground">Fragen? support@fallflow.xyz</span>
        </div>
      </main>
      <Footer />
    </>
  );
}

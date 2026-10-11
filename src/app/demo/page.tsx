import type { Metadata } from "next";
import Link from "next/link";
import { MailDemo } from "@/components/landing/mail-demo";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { buttonStyles } from "@/components/ui/button";

export const metadata: Metadata = { title: "Demo" };

export default function DemoPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Demo: von der Kundenanfrage zum fertigen Beratungsfall</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          So läuft eine Anfrage per E-Mail: Der Kunde schreibt, die KI antwortet mit Ihrer Nachricht und Ihren PDF-Vorlagen, fordert fehlende Unterlagen an und baut die Fallakte auf – bis zum fertigen Beratungsfall mit Terminvorschlag. Fragen von Kunden und Mails ohne Bezug (Rechnungen, Werbung) behandelt sie anders – probieren Sie die Beispiele aus.
        </p>
        <div className="mt-8">
          <MailDemo />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className={buttonStyles()}>
            Kostenlos starten
          </Link>
          <Link href="/dashboard" className={buttonStyles({ variant: "secondary" })}>
            Beispiel-Dashboard ansehen
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}

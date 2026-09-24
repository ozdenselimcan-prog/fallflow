import type { Metadata } from "next";
import Link from "next/link";
import { DemoWorkbench } from "@/components/chat/demo-workbench";
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
          Schreiben Sie als Interessent eine natürliche Anfrage – oder tippen Sie auf die Beispielantworten. Rechts entsteht live die Fallakte: erkannte Angaben, steigender Vollständigkeitswert, angefordertes Dokument und am Ende der fertige Beratungsfall im Dashboard.
        </p>
        <div className="mt-8">
          <DemoWorkbench />
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

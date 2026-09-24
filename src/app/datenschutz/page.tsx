import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";

export const metadata: Metadata = { title: "Datenschutzerklärung" };

export default function DatenschutzPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Datenschutzerklärung</h1>
        <p className="mt-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          Platzhaltertext: Diese Seite ist eine Vorlage und ersetzt keine rechtliche Prüfung. Bitte lassen Sie die Datenschutzerklärung vor dem Livebetrieb von einer fachkundigen Stelle erstellen bzw. prüfen.
        </p>
        <div className="prose-sm mt-8 space-y-6 leading-relaxed [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold">
          <section>
            <h2>1. Verantwortlicher</h2>
            <p>
              [FIRMENNAME]
              <br />
              [ADRESSE]
              <br />
              E-Mail: [E-MAIL]
            </p>
          </section>
          <section>
            <h2>2. Verarbeitete Daten</h2>
            <p>
              Bei der Nutzung des Chat-Widgets und der Anwendung werden insbesondere Kontaktdaten (Name, E-Mail, Telefon), Angaben zum Gebäude (z. B. Gebäudeart, Baujahr, Wohnfläche, PLZ, Heizung) sowie der Inhalt der Chat-Nachrichten verarbeitet. Für Konten der Büros werden zusätzlich Anmelde- und Firmendaten verarbeitet.
            </p>
          </section>
          <section>
            <h2>3. Zweck und Rechtsgrundlagen</h2>
            <p>[Zwecke und Rechtsgrundlagen der Verarbeitung nach Art. 6 DSGVO ergänzen.]</p>
          </section>
          <section>
            <h2>4. Dienstleister und Auftragsverarbeitung</h2>
            <p>
              Zur Bereitstellung werden Dienstleister eingesetzt, z. B. für Datenbank und Authentifizierung (Supabase), Hosting [HOSTING-ANBIETER] und – sofern aktiviert – für die KI-gestützte Auswertung von Anfragen [KI-ANBIETER]. [Angaben zu Auftragsverarbeitungsverträgen, Speicherorten und Drittlandübermittlungen ergänzen.]
            </p>
          </section>
          <section>
            <h2>5. Speicherdauer</h2>
            <p>[Speicher- und Löschfristen ergänzen.]</p>
          </section>
          <section>
            <h2>6. Ihre Rechte</h2>
            <p>Sie haben nach Maßgabe der gesetzlichen Vorschriften das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde.</p>
          </section>
          <section>
            <h2>7. Kontakt zum Datenschutz</h2>
            <p>[Kontakt des Datenschutzbeauftragten bzw. der zuständigen Stelle ergänzen.]</p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";

export const metadata: Metadata = { title: "Datenschutzerklärung" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

const List = ({ items }: { items: string[] }) => (
  <ul className="list-disc space-y-1 pl-5">
    {items.map((i) => (
      <li key={i}>{i}</li>
    ))}
  </ul>
);

/**
 * Entwurf der Datenschutzerklärung mit den tatsächlich eingesetzten Diensten.
 * Eckige Klammern sind Angaben des Betreibers, die noch fehlen. Der Text ersetzt keine Rechtsberatung.
 */
export default function DatenschutzPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Datenschutzerklärung</h1>
        <p className="mt-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          Entwurf: Bitte ergänzen Sie die Angaben in eckigen Klammern und lassen Sie die Erklärung vor dem Livebetrieb rechtlich prüfen. Sie ersetzt keine Rechtsberatung.
        </p>
        <div className="prose-sm mt-8 space-y-8 leading-relaxed [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-medium">
          <Section title="1. Verantwortlicher">
            <p>
              [FIRMENNAME / NAME]
              <br />
              [STRASSE UND HAUSNUMMER]
              <br />
              [PLZ ORT]
              <br />
              E-Mail: [E-MAIL] · Telefon: [TELEFON]
            </p>
            <p>
              Für die Daten, die Endkunden in das Chat-Widget eines Energieberatungsbüros eingeben, ist grundsätzlich das jeweilige Büro verantwortlich (Art. 4 Nr. 7 DSGVO). Der Betreiber von FallFlow verarbeitet diese Daten in dessen Auftrag (Art. 28 DSGVO).
            </p>
          </Section>

          <Section title="2. Welche Daten wir verarbeiten">
            <h3>Nutzer der Anwendung (Mitarbeiter der Büros)</h3>
            <List items={["Name, E-Mail-Adresse, Passwort (nur als Hash bei unserem Authentifizierungsdienst)", "Firmendaten des Büros, Rollen und Einstellungen", "Technische Zugriffsdaten (IP-Adresse, Zeitstempel) in Server-Logs"]} />
            <h3>Anfragende Personen (Endkunden eines Büros)</h3>
            <List
              items={[
                "Kontaktdaten: Name, E-Mail-Adresse, Telefonnummer, Adresse",
                "Gebäudeangaben: Gebäudetyp, Baujahr, Wohnfläche, Etagen, Heizung, Eigentümerstatus",
                "Anliegen, Inhalt der Chat-, E-Mail-, WhatsApp-Nachrichten und Telefonnotizen",
                "Hochgeladene Dokumente (z. B. Grundriss, Energieausweis, Fotos)",
              ]}
            />
          </Section>

          <Section title="3. Zwecke und Rechtsgrundlagen">
            <List
              items={[
                "Bereitstellung der Anwendung und Vertragserfüllung mit den Büros – Art. 6 Abs. 1 lit. b DSGVO",
                "Bearbeitung von Anfragen durch das jeweilige Büro (Vorbereitung eines Beratungsverhältnisses) – Art. 6 Abs. 1 lit. b DSGVO, im Auftrag des Büros",
                "Erfassung fehlender Angaben, Erinnerungen und Nachfassen zu einer offenen Anfrage – Art. 6 Abs. 1 lit. b bzw. f DSGVO (Interesse an einer zügigen Bearbeitung)",
                "Sicherheit, Missbrauchsabwehr und Fehleranalyse (Rate-Limits, Logs) – Art. 6 Abs. 1 lit. f DSGVO",
                "Erfüllung gesetzlicher Pflichten – Art. 6 Abs. 1 lit. c DSGVO",
              ]}
            />
          </Section>

          <Section title="4. Empfänger und Dienstleister">
            <p>Wir setzen folgende Dienstleister als Auftragsverarbeiter ein. Mit ihnen bestehen bzw. schließen wir Verträge zur Auftragsverarbeitung.</p>
            <List
              items={[
                "Supabase (Datenbank, Authentifizierung, Dateispeicher). Speicherort/Region des Projekts: [REGION, z. B. Frankfurt (EU)].",
                "Vercel Inc. (Hosting und Auslieferung der Anwendung, Server-Logs).",
                "OpenAI (nur wenn die KI-Auswertung aktiviert ist): Chat-Texte werden zur Erkennung von Angaben (z. B. Baujahr, Heizung) und zur Erstellung einer Kurzzusammenfassung an die OpenAI-Schnittstelle übermittelt. Die Daten werden nach den Vertragsbedingungen von OpenAI nicht zum Training genutzt [bitte anhand Ihres OpenAI-Vertrags prüfen].",
              ]}
            />
            <p>Weitere Kanäle (E-Mail-Postfächer, WhatsApp Business) werden nur genutzt, wenn ein Büro sie aktiv verbindet; dann kommen deren Anbieter als weitere Empfänger hinzu.</p>
          </Section>

          <Section title="5. Übermittlung in Drittländer">
            <p>
              Einzelne Dienstleister (z. B. Vercel, OpenAI) haben ihren Sitz in den USA oder verarbeiten Daten dort. Die Übermittlung stützt sich auf Angemessenheitsbeschlüsse (EU-US Data Privacy Framework, soweit der Anbieter zertifiziert ist) bzw. Standardvertragsklauseln der EU-Kommission. [Bitte den aktuellen Zertifizierungsstatus der Anbieter prüfen.]
            </p>
          </Section>

          <Section title="6. Chat-Widget, Cookies und Speicherung im Browser">
            <p>
              Das Chat-Widget legt keine Werbe- oder Tracking-Cookies an. Für die Anmeldung in der Anwendung setzt unser Authentifizierungsdienst technisch notwendige Cookies (Sitzung). Diese sind für den Betrieb erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG).
            </p>
          </Section>

          <Section title="7. Dokumenten-Upload">
            <p>
              Dokumente werden über einen persönlichen, zeitlich befristeten Link hochgeladen, der nur das Hochladen erlaubt. Zulässig sind PDF, JPG, PNG und WebP bis 10 MB. Die Dateien liegen in einem privaten Speicher ohne öffentliche Adresse und sind nur für Mitarbeiter des jeweiligen Büros abrufbar. Der Transport ist verschlüsselt (HTTPS).
            </p>
          </Section>

          <Section title="8. Speicherdauer">
            <p>
              Anfragen und zugehörige Dokumente werden gespeichert, solange das Büro sie zur Bearbeitung benötigt und die Löschung nicht verlangt wird; das Büro kann Fälle jederzeit löschen. Konten und Büro-Daten werden nach Beendigung des Vertrags gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten bestehen. [Konkrete Fristen ergänzen.]
            </p>
          </Section>

          <Section title="9. Ihre Rechte">
            <p>
              Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO). Erteilte Einwilligungen können Sie jederzeit mit Wirkung für die Zukunft widerrufen. Bei Anfragen an ein Büro wenden Sie sich bitte an dieses Büro; wir unterstützen es bei der Beantwortung. Sie haben außerdem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
            </p>
          </Section>

          <Section title="10. Keine automatisierte Entscheidung">
            <p>
              Die KI erkennt und sammelt Angaben und fasst sie zusammen. Sie trifft keine Entscheidungen mit rechtlicher Wirkung und gibt keine Energie-, Förder- oder Rechtsberatung. Über die Bearbeitung einer Anfrage entscheidet stets ein Mitarbeiter des Büros.
            </p>
          </Section>

          <Section title="11. Kontakt zum Datenschutz">
            <p>[E-MAIL bzw. Kontakt der für den Datenschutz zuständigen Stelle / des Datenschutzbeauftragten]</p>
          </Section>
        </div>
      </main>
      <Footer />
    </>
  );
}

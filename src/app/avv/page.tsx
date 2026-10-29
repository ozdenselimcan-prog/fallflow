import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, List, Paragraphs, Section } from "@/components/legal/legal-page";
import { LEGAL_VERSION } from "@/lib/config/legal";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = { title: "Auftragsverarbeitungsvertrag (AVV)" };

/** Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO – wird bei der Registrierung akzeptiert. */
export default function AvvPage() {
  return (
    <LegalPage
      title="Auftragsverarbeitungsvertrag (AVV)"
      updated={LEGAL_VERSION}
      intro={
        <p>
          Vertrag nach Art. 28 DSGVO zwischen dem Kunden (Verantwortlicher, nachfolgend „Auftraggeber“) und Selimcan Özden, Karlsteinstraße 2, 80937 München (Auftragsverarbeiter, nachfolgend „Auftragnehmer“). Er ist Bestandteil des Vertrags über die Nutzung von {siteConfig.name} (siehe{" "}
          <Link href="/agb" className="underline">
            AGB
          </Link>
          ) und wird bei der Registrierung akzeptiert.
        </p>
      }
    >
      <Section title="§ 1 Gegenstand und Dauer">
        <Paragraphs
          items={[
            "Der Auftragnehmer verarbeitet personenbezogene Daten im Auftrag des Auftraggebers, um die Software FallFlow bereitzustellen: Auswertung und Beantwortung eingehender Kundenanfragen per E-Mail, Führung von Fallakten mit Angaben und Dokumenten, Terminvorschläge sowie Beantwortung von Fragen im Website-Chat.",
            "Die Dauer entspricht der Laufzeit des Hauptvertrags.",
          ]}
        />
      </Section>

      <Section title="§ 2 Art der Daten und betroffene Personen">
        <p>Betroffene Personen:</p>
        <List items={["Interessenten und Kunden des Auftraggebers (Absender von Anfragen, Website-Besucher im Chat)", "Mitarbeiter des Auftraggebers, die FallFlow nutzen"]} />
        <p>Arten von Daten:</p>
        <List
          items={[
            "Kontaktdaten (Name, E-Mail-Adresse, Telefonnummer, Anschrift)",
            "Angaben zum Anliegen und zum Auftrag (z. B. gewünschte Leistung, Art und Größe des Objekts, Fahrzeugdaten, Adresse des Einsatzorts)",
            "Inhalte von E-Mails und Chat-Nachrichten, Anhänge und hochgeladene Dokumente (z. B. ausgefüllte Formulare, Fotos, Pläne)",
            "Termindaten sowie Verlaufs- und Protokolldaten zur Bearbeitung",
          ]}
        />
        <p>Besondere Kategorien personenbezogener Daten (Art. 9 DSGVO) sind für die Verarbeitung nicht vorgesehen.</p>
      </Section>

      <Section title="§ 3 Weisungen">
        <Paragraphs
          items={[
            "Der Auftragnehmer verarbeitet die Daten ausschließlich auf dokumentierte Weisung des Auftraggebers. Die Weisungen ergeben sich aus diesem Vertrag, dem Hauptvertrag und den Einstellungen, die der Auftraggeber in FallFlow vornimmt (z. B. Nachrichtentexte, Vorlagen, automatische Antworten). Weitere Weisungen erteilt der Auftraggeber in Textform.",
            "Ist der Auftragnehmer der Ansicht, dass eine Weisung gegen Datenschutzvorschriften verstößt, weist er den Auftraggeber unverzüglich darauf hin.",
            "Der Auftragnehmer verwendet die Daten nicht für eigene Zwecke und nicht zum Training von KI-Modellen.",
          ]}
        />
      </Section>

      <Section title="§ 4 Vertraulichkeit">
        <p>
          Der Auftragnehmer setzt nur Personen ein, die zur Vertraulichkeit verpflichtet sind. Zugriff auf Daten des Auftraggebers erfolgt nur, soweit dies für den Betrieb, die Fehlerbehebung oder auf Wunsch des Auftraggebers (Support) erforderlich ist. Auf die verbundenen Postfächer des Auftraggebers greift ausschließlich das System automatisiert zu; ein manueller Zugriff durch den Auftragnehmer findet nicht statt.
        </p>
      </Section>

      <Section title="§ 5 Technische und organisatorische Maßnahmen">
        <p>Der Auftragnehmer trifft angemessene Maßnahmen nach Art. 32 DSGVO, insbesondere:</p>
        <List
          items={[
            "Verschlüsselte Übertragung aller Daten (HTTPS/TLS), auch beim Abruf und Versand von E-Mails",
            "Verschlüsselte Speicherung der Postfach-Zugangsdaten; sie sind im Browser und für andere Kunden nicht einsehbar",
            "Strikte Mandantentrennung: Jeder Kunde sieht ausschließlich seine eigenen Daten (Zugriffsregeln auf Datenbankebene)",
            "Dokumente in einem privaten Speicher ohne öffentliche Adresse; Upload-Links sind persönlich und zeitlich befristet, Dateitypen werden am Inhalt geprüft",
            "Rollen- und Rechtekonzept für Mitarbeiter des Auftraggebers, Anmeldung mit Passwort",
            "Hosting in Rechenzentren mit anerkannten Sicherheitszertifizierungen, regelmäßige Datensicherung durch den Hosting-Anbieter",
            "Automatische Löschung nicht übernommener Anfragen nach 12 Monaten ohne Aktivität",
          ]}
        />
        <p>Der Auftragnehmer darf die Maßnahmen weiterentwickeln, solange das Schutzniveau nicht unterschritten wird.</p>
      </Section>

      <Section title="§ 6 Unterauftragsverarbeiter">
        <Paragraphs
          items={[
            "Der Auftraggeber stimmt dem Einsatz folgender Unterauftragsverarbeiter zu:",
          ]}
        />
        <List
          items={[
            "Supabase Inc. – Datenbank, Authentifizierung, Dateispeicher; Speicherort EU (Irland)",
            "Vercel Inc. – Hosting und Auslieferung der Anwendung",
            "OpenAI, L.L.C. – KI-Auswertung von Texten (Erkennung von Angaben, Zusammenfassungen, Prüfung zurückgeschickter Vorlagen, Antworten im Website-Chat); nach den API-Bedingungen von OpenAI keine Nutzung zum Training, Speicherung höchstens 30 Tage zur Missbrauchserkennung",
            "Functional Software Inc. (Sentry) – Fehlerüberwachung; Verarbeitung in der EU (Frankfurt)",
            "Twilio Inc. – Telefonie, Spracherkennung und Sprachausgabe für den Telefon-Assistenten (nur wenn der Auftraggeber ihn nutzt); keine Aufzeichnung der Gespräche als Audiodatei",
            "Meta Platforms Ireland Ltd. – WhatsApp Business Platform (nur wenn der Auftraggeber WhatsApp verbindet): Empfang und Versand der WhatsApp-Nachrichten",
          ]}
        />
        <Paragraphs
          items={[
            "Soweit Unterauftragsverarbeiter Daten außerhalb der EU verarbeiten, erfolgt dies auf Grundlage eines Angemessenheitsbeschlusses (EU-US Data Privacy Framework, soweit der Anbieter zertifiziert ist) oder der EU-Standardvertragsklauseln.",
            "Der Auftragnehmer informiert den Auftraggeber über beabsichtigte Änderungen (Hinzuziehung oder Ersetzung) per E-Mail mindestens vier Wochen im Voraus. Der Auftraggeber kann aus wichtigem datenschutzrechtlichem Grund widersprechen; kann keine Einigung erzielt werden, kann er den Hauptvertrag außerordentlich kündigen.",
            "Der Auftragnehmer verpflichtet Unterauftragsverarbeiter vertraglich auf ein diesem Vertrag entsprechendes Schutzniveau.",
          ]}
        />
      </Section>

      <Section title="§ 7 Unterstützung des Auftraggebers">
        <Paragraphs
          items={[
            "Der Auftragnehmer unterstützt den Auftraggeber im zumutbaren Umfang bei der Erfüllung der Rechte betroffener Personen (Art. 15–22 DSGVO), insbesondere bei Auskunft, Berichtigung und Löschung. Viele dieser Schritte kann der Auftraggeber selbst in FallFlow vornehmen (z. B. Fälle bearbeiten oder löschen). Wendet sich eine betroffene Person direkt an den Auftragnehmer, leitet er die Anfrage an den Auftraggeber weiter.",
            "Der Auftragnehmer unterstützt den Auftraggeber bei Datenschutz-Folgenabschätzungen und der Zusammenarbeit mit Aufsichtsbehörden, soweit dies die Verarbeitung im Auftrag betrifft.",
          ]}
        />
      </Section>

      <Section title="§ 8 Meldung von Datenschutzverletzungen">
        <p>
          Der Auftragnehmer meldet dem Auftraggeber Verletzungen des Schutzes personenbezogener Daten unverzüglich, möglichst innerhalb von 48 Stunden nach Kenntnis, mit den ihm vorliegenden Informationen (Art und Umfang, betroffene Daten, wahrscheinliche Folgen, ergriffene Maßnahmen).
        </p>
      </Section>

      <Section title="§ 9 Löschung und Rückgabe nach Vertragsende">
        <p>
          Nach Ende des Hauptvertrags löscht der Auftragnehmer die im Auftrag verarbeiteten Daten innerhalb von 30 Tagen, sofern keine gesetzliche Pflicht zur Aufbewahrung besteht. Bis zum Vertragsende kann der Auftraggeber seine Fälle und Dokumente in FallFlow einsehen und herunterladen. Datensicherungen des Hosting-Anbieters werden im Rahmen der üblichen Rotationszyklen überschrieben.
        </p>
      </Section>

      <Section title="§ 10 Nachweise und Kontrollen">
        <p>
          Der Auftragnehmer stellt dem Auftraggeber auf Anfrage die zum Nachweis der Einhaltung dieses Vertrags erforderlichen Informationen zur Verfügung (z. B. Beschreibung der Maßnahmen, Zertifikate der Unterauftragsverarbeiter). Kontrollen vor Ort sind nach rechtzeitiger Anmeldung während der Geschäftszeiten möglich, soweit schriftliche Nachweise nicht ausreichen; sie dürfen den Betrieb nicht unangemessen stören.
        </p>
      </Section>

      <Section title="§ 11 Haftung und Schlussbestimmungen">
        <Paragraphs
          items={[
            "Für die Haftung gilt Art. 82 DSGVO; im Übrigen gelten die Haftungsregeln der AGB.",
            "Bei Widersprüchen zwischen diesem Vertrag und dem Hauptvertrag gehen die Regelungen dieses Vertrags zum Datenschutz vor.",
            `Ansprechpartner für den Datenschutz beim Auftragnehmer: ${siteConfig.supportEmail}`,
          ]}
        />
      </Section>
    </LegalPage>
  );
}

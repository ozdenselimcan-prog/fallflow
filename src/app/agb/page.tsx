import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Paragraphs, Section } from "@/components/legal/legal-page";
import { LEGAL_VERSION } from "@/lib/config/legal";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = { title: "AGB" };

/** Allgemeine Geschäftsbedingungen für die Nutzung von FallFlow (nur für Unternehmer, B2B). */
export default function AgbPage() {
  return (
    <LegalPage title="Allgemeine Geschäftsbedingungen (AGB)" updated={LEGAL_VERSION}>
      <Section title="§ 1 Geltungsbereich, Anbieter">
        <Paragraphs
          items={[
            <>
              Diese AGB gelten für alle Verträge über die Nutzung der Software „{siteConfig.name}“ (nachfolgend „FallFlow“) zwischen Selimcan Özden, Karlsteinstraße 2, 80937 München (nachfolgend „Anbieter“) und dem Kunden.
            </>,
            "FallFlow richtet sich ausschließlich an Unternehmer im Sinne von § 14 BGB, insbesondere Handwerks- und Dienstleistungsbetriebe, sowie an juristische Personen des öffentlichen Rechts. Mit der Registrierung bestätigt der Kunde, als Unternehmer zu handeln. Verträge mit Verbrauchern werden nicht geschlossen.",
            "Abweichende oder ergänzende Geschäftsbedingungen des Kunden gelten nur, wenn der Anbieter ihnen ausdrücklich schriftlich zustimmt.",
          ]}
        />
      </Section>

      <Section title="§ 2 Leistungen">
        <Paragraphs
          items={[
            "FallFlow ist eine webbasierte Software (Software as a Service), die Kundenanfragen von Unternehmen und Betrieben vorbereitet: Sie wertet eingehende E-Mails aus dem vom Kunden verbundenen Postfach aus, beantwortet sie nach den Vorgaben des Kunden (Nachrichtentexte, PDF-Vorlagen), legt Fallakten mit Angaben und Dokumenten an, schlägt Termine vor und stellt einen Website-Chat bereit, der Fragen von Website-Besuchern beantwortet. Optional beantwortet FallFlow auch WhatsApp-Nachrichten über die vom Kunden verbundene WhatsApp-Business-Nummer und nimmt Anrufe über eine FallFlow-Telefonnummer an (Telefon-Assistent). Der jeweils aktuelle Funktionsumfang ergibt sich aus der Beschreibung auf der Website und dem gewählten Tarif.",
            "FallFlow nutzt Verfahren der künstlichen Intelligenz. Automatisch erzeugte Inhalte (z. B. erkannte Angaben, Zusammenfassungen, Einschätzungen, Antworten im Website-Chat) können fehlerhaft oder unvollständig sein. FallFlow erbringt keine Fach-, Steuer- oder Rechtsberatung und gibt keine verbindlichen Preisauskünfte. Fachliche Entscheidungen und die Prüfung der Fälle obliegen dem Kunden.",
            "Der Anbieter stellt FallFlow mit einer marktüblichen Verfügbarkeit bereit. Ausgenommen sind Zeiten der Wartung sowie Störungen, die der Anbieter nicht zu vertreten hat (z. B. Ausfälle von Internet, E-Mail-Anbietern des Kunden oder höhere Gewalt). Ein Anspruch auf eine bestimmte Verfügbarkeit besteht nicht.",
            "Der Anbieter darf FallFlow weiterentwickeln und Funktionen ändern, soweit der vertraglich vereinbarte Kern der Leistung erhalten bleibt und die Änderung für den Kunden zumutbar ist.",
          ]}
        />
      </Section>

      <Section title="§ 3 Registrierung und Vertragsschluss">
        <Paragraphs
          items={[
            "Der Vertrag kommt zustande, indem der Kunde ein Konto anlegt, diese AGB und den Auftragsverarbeitungsvertrag akzeptiert und – sofern angeboten – die Zahlungsmethode hinterlegt.",
            "Der Kunde hat bei der Registrierung wahre und vollständige Angaben zu machen und diese aktuell zu halten. Zugangsdaten sind geheim zu halten; der Kunde haftet für Handlungen, die über sein Konto oder die Konten seiner Mitarbeiter vorgenommen werden.",
          ]}
        />
      </Section>

      <Section title="§ 4 Kostenlose Testphase">
        <Paragraphs
          items={[
            "Neue Kunden können FallFlow zunächst kostenlos testen. Die Dauer der Testphase wird bei der Registrierung angezeigt (in der Regel 7 Tage).",
            "Für die Testphase wird eine Zahlungsmethode hinterlegt. Kündigt der Kunde bis zum Ende der Testphase, entstehen keine Kosten. Andernfalls geht der Vertrag mit Ablauf der Testphase automatisch in den gewählten kostenpflichtigen Tarif über.",
          ]}
        />
      </Section>

      <Section title="§ 5 Preise und Zahlung">
        <Paragraphs
          items={[
            <>
              Es gelten die bei Vertragsschluss auf der <Link href="/#preise" className="underline">Preisseite</Link> angegebenen Preise des gewählten Tarifs. Der Anbieter ist Kleinunternehmer im Sinne von § 19 UStG; es wird keine Umsatzsteuer berechnet. Entfällt die Kleinunternehmerregelung, verstehen sich die Preise zuzüglich der gesetzlichen Umsatzsteuer.
            </>,
            "Die Vergütung ist monatlich im Voraus fällig und wird über den Zahlungsdienstleister Stripe eingezogen. Rechnungen werden elektronisch bereitgestellt.",
            "Gerät der Kunde mit einer Zahlung in Verzug, darf der Anbieter den Zugang nach vorheriger Ankündigung sperren, bis die offenen Beträge beglichen sind.",
            "Der Anbieter kann die Preise mit einer Ankündigungsfrist von mindestens sechs Wochen zum Beginn eines Abrechnungszeitraums ändern. Der Kunde kann in diesem Fall bis zum Inkrafttreten der Änderung zu diesem Zeitpunkt kündigen; hierauf wird er in der Ankündigung hingewiesen.",
          ]}
        />
      </Section>

      <Section title="§ 6 Laufzeit und Kündigung">
        <Paragraphs
          items={[
            "Der Vertrag läuft auf unbestimmte Zeit und kann von beiden Seiten jederzeit zum Ende des laufenden monatlichen Abrechnungszeitraums gekündigt werden. Die Kündigung erfolgt in den Einstellungen unter „Abrechnung“ oder per E-Mail.",
            "Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt für den Anbieter insbesondere vor, wenn der Kunde FallFlow missbräuchlich oder rechtswidrig nutzt.",
            "Nach Vertragsende werden die Daten des Kunden gemäß dem Auftragsverarbeitungsvertrag gelöscht. Der Kunde ist dafür verantwortlich, benötigte Daten und Dokumente vor Vertragsende herunterzuladen.",
          ]}
        />
      </Section>

      <Section title="§ 7 Pflichten des Kunden">
        <Paragraphs
          items={[
            "Der Kunde ist für die Inhalte verantwortlich, die er in FallFlow hinterlegt oder über FallFlow versendet, insbesondere Nachrichtentexte, PDF-Vorlagen, Terminbestätigungen und eigene Antworten. Er prüft die automatischen Antworten vor dem Einsatz (z. B. über „Testmail ausprobieren“).",
            "Der Kunde verbindet nur Postfächer, über die er verfügen darf, und stellt sicher, dass er die Daten seiner Interessenten und Kunden rechtmäßig über FallFlow verarbeiten darf. Er informiert diese in seiner eigenen Datenschutzerklärung über die Verarbeitung (auch über den Website-Chat, sofern eingebunden).",
            "Der Kunde nutzt FallFlow nicht missbräuchlich, insbesondere nicht zum Versand von Werbung oder Spam, nicht für rechtswidrige Inhalte und nicht in einer Weise, die den Betrieb beeinträchtigt (z. B. automatisierte Massenabfragen).",
          ]}
        />
      </Section>

      <Section title="§ 8 Datenschutz und Auftragsverarbeitung">
        <Paragraphs
          items={[
            <>
              Soweit der Anbieter personenbezogene Daten im Auftrag des Kunden verarbeitet, gilt der <Link href="/avv" className="underline">Auftragsverarbeitungsvertrag (AVV)</Link>, der Bestandteil dieses Vertrags ist.
            </>,
            <>
              Für die Verarbeitung der eigenen Konto- und Abrechnungsdaten des Kunden gilt die <Link href="/datenschutz" className="underline">Datenschutzerklärung</Link>.
            </>,
          ]}
        />
      </Section>

      <Section title="§ 9 Rechte an Software und Daten">
        <Paragraphs
          items={[
            "Der Kunde erhält für die Vertragsdauer das einfache, nicht übertragbare Recht, FallFlow im Rahmen dieser AGB für eigene geschäftliche Zwecke zu nutzen. Alle Rechte an der Software verbleiben beim Anbieter.",
            "Die vom Kunden eingegebenen oder über FallFlow empfangenen Daten bleiben Daten des Kunden. Der Anbieter nutzt sie ausschließlich zur Erbringung der Leistung und nicht zum Training eigener oder fremder KI-Modelle.",
          ]}
        />
      </Section>

      <Section title="§ 10 Haftung">
        <Paragraphs
          items={[
            "Der Anbieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei der Verletzung von Leben, Körper oder Gesundheit, nach dem Produkthaftungsgesetz sowie im Umfang einer übernommenen Garantie.",
            "Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht (einer Pflicht, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung der Kunde regelmäßig vertrauen darf) ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt, höchstens jedoch auf die vom Kunden in den zwölf Monaten vor dem Schadensereignis gezahlte Vergütung. Im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen.",
            "Der Anbieter haftet nicht für Inhalte, die auf Vorgaben des Kunden beruhen, und nicht für fachliche Entscheidungen, die der Kunde auf Grundlage automatisch erzeugter Inhalte trifft (§ 2 Abs. 2).",
          ]}
        />
      </Section>

      <Section title="§ 11 Änderungen dieser AGB">
        <p>
          Der Anbieter kann diese AGB mit Wirkung für die Zukunft ändern, soweit dies aus sachlichen Gründen (z. B. neue Funktionen oder geänderte Rechtslage) erforderlich ist und den Kunden nicht unangemessen benachteiligt. Änderungen werden mindestens sechs Wochen vor Inkrafttreten per E-Mail angekündigt. Widerspricht der Kunde nicht bis zum Inkrafttreten, gelten sie als angenommen; auf diese Folge wird in der Ankündigung hingewiesen. Im Fall des Widerspruchs können beide Seiten den Vertrag zum Inkrafttreten der Änderung kündigen.
        </p>
      </Section>

      <Section title="§ 12 Schlussbestimmungen">
        <Paragraphs
          items={[
            "Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.",
            "Ist der Kunde Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen, ist Gerichtsstand München.",
            "Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.",
          ]}
        />
      </Section>
    </LegalPage>
  );
}

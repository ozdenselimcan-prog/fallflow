import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = { title: "Datenschutzerklärung" };

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2>{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

const List = ({ items }: { items: ReactNode[] }) => (
  <ul className="list-disc space-y-1 pl-5">
    {items.map((i, k) => (
      <li key={k}>{i}</li>
    ))}
  </ul>
);

const sections = [
  ["verantwortlicher", "1. Verantwortlicher"],
  ["rollen", "2. Wer ist wofür verantwortlich?"],
  ["website", "3. Besuch der Website und Server-Logs"],
  ["cookies", "4. Cookies und Speicherung im Browser"],
  ["google-ads", "5. Google Ads Conversion-Tracking"],
  ["schriften", "6. Schriftarten und externe Links"],
  ["kontakt", "7. Kontakt per E-Mail"],
  ["registrierung", "8. Registrierung und Benutzerkonto"],
  ["zahlung", "9. Testphase, Abonnement und Zahlung"],
  ["empfehlung", "10. Empfehlungsprogramm"],
  ["anwendung", "11. Nutzung von FallFlow durch Betriebe"],
  ["endkunden", "12. Daten von Endkunden der Büros"],
  ["ki", "13. KI-Funktionen (OpenAI)"],
  ["chat", "14. Website-Chat, Telefon-Assistent und WhatsApp der Büros"],
  ["systemmails", "15. System-E-Mails von FallFlow"],
  ["sentry", "16. Fehlerüberwachung"],
  ["empfaenger", "17. Empfänger und Auftragsverarbeiter"],
  ["drittland", "18. Übermittlung in Drittländer"],
  ["speicherdauer", "19. Speicherdauer"],
  ["pflicht", "20. Pflicht zur Bereitstellung"],
  ["automatisiert", "21. Keine automatisierte Entscheidung, kein Profiling"],
  ["sicherheit", "22. Datensicherheit"],
  ["rechte", "23. Ihre Rechte"],
  ["widerspruch", "24. Widerspruchsrecht"],
  ["beschwerde", "25. Beschwerderecht bei einer Aufsichtsbehörde"],
  ["sonstiges", "26. Minderjährige, Änderungen dieser Erklärung"],
] as const;

/**
 * Datenschutzerklärung nach Art. 13 und 14 DSGVO mit den tatsächlich eingesetzten Diensten. Bei neuen Diensten oder
 * Funktionen hier ergänzen. Der Text ersetzt keine Rechtsberatung.
 */
export default function DatenschutzPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Datenschutzerklärung</h1>
        <p className="mt-2 text-sm text-muted-foreground">Stand: Oktober 2026</p>
        <p className="mt-4 text-sm leading-relaxed">
          Mit dieser Datenschutzerklärung informieren wir Sie nach Art. 13 und 14 der Datenschutz-Grundverordnung (DSGVO) darüber, welche personenbezogenen Daten wir beim Besuch
          unserer Website und bei der Nutzung von FallFlow verarbeiten, zu welchen Zwecken, auf welcher Rechtsgrundlage, wie lange und an wen sie weitergegeben werden – und welche
          Rechte Sie haben. „Personenbezogene Daten“ sind alle Informationen, die sich auf eine identifizierte oder identifizierbare Person beziehen (Art. 4 Nr. 1 DSGVO).
        </p>

        <nav aria-label="Inhalt" className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <p className="mb-2 font-semibold">Inhalt</p>
          <ol className="grid gap-1 sm:grid-cols-2">
            {sections.map(([id, title]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-muted-foreground hover:text-foreground hover:underline">
                  {title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="prose-sm mt-10 space-y-8 leading-relaxed [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-medium">
          <Section id="verantwortlicher" title="1. Verantwortlicher">
            <p>Verantwortlich für die Datenverarbeitung auf dieser Website und für FallFlow im Sinne von Art. 4 Nr. 7 DSGVO ist:</p>
            <p>
              Selimcan Özden
              <br />
              Karlsteinstraße 2
              <br />
              80937 München
              <br />
              Deutschland
              <br />
              Telefon: {siteConfig.phone}
              <br />
              E-Mail: {siteConfig.supportEmail}
            </p>
            <p>
              Ein Datenschutzbeauftragter ist nicht bestellt, da die gesetzlichen Voraussetzungen dafür (Art. 37 DSGVO, § 38 BDSG) nicht vorliegen. Bei allen Fragen zum Datenschutz
              erreichen Sie uns unter der oben genannten E-Mail-Adresse.
            </p>
          </Section>

          <Section id="rollen" title="2. Wer ist wofür verantwortlich?">
            <p>FallFlow ist eine Software für Unternehmen und Betriebe aller Branchen, die Kundenanfragen bearbeiten (im Folgenden „Büros“). Dabei gibt es zwei unterschiedliche Rollen:</p>
            <List
              items={[
                <>
                  <strong>Wir als Verantwortlicher:</strong> für den Besuch dieser Website, für Anfragen an uns, für die Benutzerkonten der Büros und ihrer Mitarbeiter sowie für die
                  Abrechnung der Abonnements.
                </>,
                <>
                  <strong>Wir als Auftragsverarbeiter (Art. 28 DSGVO):</strong> für alle Daten, die ein Büro mit FallFlow über seine eigenen Kunden („Endkunden“) verarbeitet – z. B.
                  Anfragen, E-Mails, Angaben zum Auftrag, Dokumente und Termine. Verantwortlich ist dafür das jeweilige Büro. Wir verarbeiten diese Daten nur nach dessen Weisung und auf
                  Grundlage unseres <Link href="/avv" className="underline">Auftragsverarbeitungsvertrags (AVV)</Link>.
                </>,
              ]}
            />
            <p>
              Als Endkunde eines Büros wenden Sie sich mit Fragen zu Ihren Daten und zur Ausübung Ihrer Rechte bitte in erster Linie an das Büro, bei dem Sie angefragt haben. Wir
              unterstützen das Büro dabei.
            </p>
          </Section>

          <Section id="website" title="3. Besuch der Website und Server-Logs">
            <p>
              Beim Aufruf unserer Website übermittelt Ihr Browser automatisch technische Informationen an den Server unseres Hosting-Anbieters. Verarbeitet werden dabei insbesondere:
            </p>
            <List items={["IP-Adresse", "Datum und Uhrzeit des Zugriffs", "aufgerufene Seite bzw. Datei und übertragene Datenmenge", "HTTP-Statuscode", "Browser, Betriebssystem und ggf. die zuvor besuchte Seite (Referrer)"]} />
            <p>
              <strong>Zweck:</strong> Auslieferung der Website, Stabilität, Sicherheit und Abwehr von Angriffen sowie Fehleranalyse. Zum Schutz vor Missbrauch (z. B. massenhaften
              Anmeldeversuchen) begrenzen wir außerdem die Zahl der Anfragen je IP-Adresse; die dafür genutzten Zähler liegen nur kurzzeitig im Arbeitsspeicher.
            </p>
            <p>
              <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse liegt im sicheren und fehlerfreien Betrieb der Website.
            </p>
            <p>
              <strong>Hosting:</strong> Die Website und die Anwendung werden von Vercel Inc. (USA) betrieben; die Anwendung läuft in einem Rechenzentrum in der EU (Dublin, Irland).
              Server-Logs werden nach den Vorgaben des Hosting-Anbieters nur kurz – in der Regel wenige Tage – gespeichert und danach gelöscht.
            </p>
            <p>
              <strong>Besucherstatistik:</strong> Um zu verstehen, wie unsere Website genutzt wird (z. B. welche Seiten aufgerufen werden, von welcher Website
              Besucher kommen, Gerätetyp und Land), nutzen wir Vercel Web Analytics. Dabei werden <strong>keine Cookies</strong> gesetzt und keine Daten im Browser
              gespeichert; Besucher werden nicht seitenübergreifend verfolgt. Zur Unterscheidung von Besuchen wird aus der Anfrage ein Kennwert gebildet, der nach
              24 Stunden verworfen wird. Wir erhalten nur zusammengefasste Zahlen. Rechtsgrundlage ist unser berechtigtes Interesse an der Verbesserung unseres
              Angebots (Art. 6 Abs. 1 lit. f DSGVO).
            </p>
          </Section>

          <Section id="cookies" title="4. Cookies und Speicherung im Browser">
            <p>
              Cookies sind kleine Textdateien, die Ihr Browser speichert. Ähnlich funktioniert der „lokale Speicher“ (localStorage) des Browsers. Wir setzen nur ein, was unbedingt nötig
              ist – alles andere nur mit Ihrer Einwilligung.
            </p>
            <h3>Technisch notwendig (ohne Einwilligung, § 25 Abs. 2 Nr. 2 TDDDG)</h3>
            <List
              items={[
                "Anmelde-Cookies unseres Authentifizierungsdienstes (Supabase, Namen beginnend mit „sb-“): halten Sie nach dem Login angemeldet. Sie werden beim Abmelden bzw. nach Ablauf der Sitzung gelöscht.",
                "Ihre Auswahl im Cookie-Hinweis (localStorage-Eintrag „ff_consent_v1“): damit der Hinweis nicht bei jedem Besuch erneut erscheint. Er bleibt gespeichert, bis Sie ihn in Ihrem Browser löschen oder Ihre Wahl über „Cookie-Einstellungen“ ändern.",
                "Empfehlungscode (Cookie „ff_ref“): nur wenn Sie einen Empfehlungslink eines Kollegen öffnen. Es speichert ausschließlich den Code aus dem Link, damit Sie die zugesagten 14 Tage Testphase auch erhalten, wenn Sie sich später ohne den Link registrieren. Es wird nach 30 Tagen gelöscht.",
              ]}
            />
            <p>Rechtsgrundlage für die damit verbundene Verarbeitung ist Art. 6 Abs. 1 lit. b DSGVO (Login) bzw. Art. 6 Abs. 1 lit. f DSGVO (Speichern Ihrer Auswahl).</p>
            <h3>Nur mit Einwilligung (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO)</h3>
            <List items={["Cookies von Google Ads für das Conversion-Tracking (siehe Abschnitt 5), z. B. „_gcl_au“, sowie ein localStorage-Eintrag, der verhindert, dass eine Registrierung doppelt gezählt wird."]} />
            <p>
              Das Chat-Widget, das Büros auf ihren Websites einbinden, setzt keine Cookies und speichert nichts im Browser. Sie können Cookies außerdem jederzeit in Ihrem Browser
              ansehen, löschen oder blockieren; ohne die notwendigen Cookies ist eine Anmeldung allerdings nicht möglich.
            </p>
          </Section>

          <Section id="google-ads" title="5. Google Ads Conversion-Tracking">
            <p>
              Nur wenn Sie im Cookie-Hinweis auf „Akzeptieren“ klicken, nutzen wir das Conversion-Tracking von Google Ads. Anbieter ist Google Ireland Limited, Gordon House, Barrow
              Street, Dublin 4, Irland („Google“).
            </p>
            <p>
              <strong>Zweck:</strong> Wir messen, ob Besucher, die über eine unserer Anzeigen zu uns gekommen sind, sich registrieren oder ein Abonnement abschließen. So erkennen wir,
              welche Anzeigen sich lohnen. Dazu setzt Google Cookies und verarbeitet u. a. Ihre IP-Adresse, Informationen zu Browser und Gerät, den Anzeigenklick und den Zeitpunkt der
              Conversion. Wir erhalten nur zusammengefasste Zahlen und können Sie darüber nicht persönlich identifizieren. Personalisierte Werbung (Remarketing) nutzen wir nicht.
            </p>
            <p>
              <strong>Rechtsgrundlage:</strong> Ihre Einwilligung (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO). Ohne Einwilligung wird kein Google-Code geladen.
            </p>
            <p>
              <strong>Widerruf:</strong> Sie können Ihre Einwilligung jederzeit mit Wirkung für die Zukunft über „Cookie-Einstellungen“ im Fußbereich der Website widerrufen; die
              Google-Cookies werden dann gelöscht.
            </p>
            <p>
              <strong>Speicherdauer und Drittland:</strong> Die Google-Ads-Cookies werden in der Regel nach 90 Tagen ungültig. Google kann Daten auch in die USA übermitteln; Google
              ist nach dem EU-US Data Privacy Framework zertifiziert. Weitere Informationen: policies.google.com/privacy.
            </p>
          </Section>

          <Section id="schriften" title="6. Schriftarten und externe Links">
            <p>
              Die auf dieser Website verwendeten Schriftarten sind lokal auf unserem Server eingebunden. Beim Seitenaufruf wird keine Verbindung zu Servern von Google oder anderen
              Schriftanbietern aufgebaut.
            </p>
            <p>
              Unsere Website enthält Links zu anderen Websites, z. B. zu sozialen Netzwerken. Dabei handelt es sich um einfache Links:
              Daten werden erst übertragen, wenn Sie einen Link anklicken und die andere Website aufrufen. Für die Datenverarbeitung dort ist der jeweilige Anbieter verantwortlich.
              Die auf unserer Website gezeigten Bewertungen haben wir als Text übernommen; es wird dafür kein Inhalt von Trustpilot nachgeladen.
            </p>
          </Section>

          <Section id="kontakt" title="7. Kontakt per E-Mail">
            <p>
              Wenn Sie uns per E-Mail schreiben, verarbeiten wir Ihre E-Mail-Adresse, Ihren Namen (sofern angegeben) und den Inhalt Ihrer Nachricht, um Ihre Anfrage zu beantworten.
            </p>
            <p>
              <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO, wenn Ihre Anfrage mit einem Vertrag oder dessen Anbahnung zusammenhängt; sonst Art. 6 Abs. 1 lit. f DSGVO
              (unser berechtigtes Interesse, Anfragen zu beantworten).
            </p>
            <p>
              Unser E-Mail-Postfach wird von Zoho Corporation B.V. (Niederlande) in einem Rechenzentrum in der EU betrieben. Wir löschen Ihre Nachrichten, sobald die Anfrage
              abschließend erledigt ist und keine gesetzlichen Aufbewahrungspflichten (z. B. für Geschäftsbriefe) entgegenstehen.
            </p>
          </Section>

          <Section id="registrierung" title="8. Registrierung und Benutzerkonto">
            <p>Für die Nutzung von FallFlow legen Sie ein Benutzerkonto an. Dabei verarbeiten wir:</p>
            <List
              items={[
                "Vor- und Nachname, Name des Unternehmens, E-Mail-Adresse",
                "Passwort – ausschließlich als verschlüsselter Hash bei unserem Authentifizierungsdienst, wir kennen es nicht",
                "Zeitpunkt und Fassung Ihrer Zustimmung zu AGB und Auftragsverarbeitungsvertrag (als Nachweis)",
                "gewählter Tarif und Länge der Testphase, ggf. der Empfehlungscode, über den Sie sich registriert haben",
                "später: Firmendaten des Büros, angebotene Leistungen, Verfügbarkeiten für Termine, Einstellungen, Rollen von Team-Mitgliedern",
              ]}
            />
            <p>
              Nach der Registrierung senden wir Ihnen eine E-Mail mit einem Bestätigungslink (Double-Opt-in). So stellen wir sicher, dass niemand ein Konto mit einer fremden
              E-Mail-Adresse anlegen kann. Erst nach der Bestätigung ist das Konto nutzbar.
            </p>
            <p>
              <strong>Zweck und Rechtsgrundlage:</strong> Bereitstellung des Kontos und Erfüllung des Vertrags (Art. 6 Abs. 1 lit. b DSGVO); Nachweis der Zustimmung zu AGB und AVV
              (Art. 6 Abs. 1 lit. c und f DSGVO).
            </p>
            <p>
              <strong>Einmalige Testphase:</strong> Damit die kostenlose Testphase je E-Mail-Adresse nur einmal genutzt werden kann, speichern wir bei der Registrierung einen
              pseudonymisierten Prüfwert (SHA-256-Hash) der E-Mail-Adresse. Aus dem Prüfwert lässt sich die Adresse nicht direkt ablesen. Er bleibt auch nach Löschung des Kontos
              erhalten und wird nach drei Jahren gelöscht. Rechtsgrundlage ist unser berechtigtes Interesse an der Verhinderung von Missbrauch (Art. 6 Abs. 1 lit. f DSGVO).
            </p>
            <p>Die Konto- und Büro-Daten speichert unser Datenbank-Anbieter Supabase Inc. (USA) in einem Rechenzentrum in der EU (Region eu-west-1, Irland).</p>
          </Section>

          <Section id="zahlung" title="9. Testphase, Abonnement und Zahlung">
            <p>
              Die Testphase ist ohne Angabe einer Zahlungsmethode möglich. Wenn Sie ein Abonnement abschließen, erfolgt die Zahlungsabwicklung über Stripe Payments Europe, Ltd., 1
              Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Irland („Stripe“). Sie geben Ihre Zahlungsdaten direkt auf der Bezahlseite von Stripe ein.
            </p>
            <p>
              Verarbeitet werden Name, E-Mail-Adresse, Rechnungsanschrift, Zahlungsmethode und Transaktionsdaten. FallFlow selbst speichert keine vollständigen Zahlungsdaten (z. B.
              Kartennummern); wir erhalten von Stripe nur eine Kunden- und Abo-Kennung, den Status des Abonnements und die Rechnungsdaten.
            </p>
            <p>
              <strong>Rechtsgrundlage:</strong> Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) sowie gesetzliche Aufbewahrungspflichten (Art. 6 Abs. 1 lit. c DSGVO). Stripe ist für
              bestimmte Verarbeitungen (z. B. Betrugsprävention, Erfüllung eigener gesetzlicher Pflichten) selbst verantwortlich; Stripe kann Daten auch in die USA übermitteln. Weitere
              Informationen: stripe.com/de/privacy.
            </p>
          </Section>

          <Section id="empfehlung" title="10. Empfehlungsprogramm">
            <p>
              Jedes Büro erhält einen persönlichen Empfehlungslink. Registriert sich ein anderes Büro über diesen Link – oder gibt es den Empfehlungscode bei der Registrierung selbst ein bzw. registriert sich innerhalb von 30 Tagen nach dem Öffnen des Links im selben Browser –, speichern wir, welches Büro es empfohlen hat. Wird das
              geworbene Büro zahlender Kunde, schreiben wir dem empfehlenden Büro bei Stripe ein Guthaben gut. Das empfehlende Büro sieht dabei nur die Zahl seiner erfolgreichen
              Empfehlungen, keine Daten des geworbenen Büros.
            </p>
            <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Durchführung des Empfehlungsprogramms als Teil des Vertrags).</p>
          </Section>

          <Section id="anwendung" title="11. Nutzung von FallFlow durch Betriebe">
            <p>
              FallFlow bearbeitet für das Büro eingehende Kundenanfragen: Es ruft E-Mails aus dem Postfach des Büros ab, ordnet sie Fällen zu, beantwortet sie mit den Texten und
              Formularen des Büros, nimmt zurückgeschickte Unterlagen in die Fallakte auf und schlägt Termine vor. Diese Verarbeitung erfolgt im Auftrag des Büros (Art. 28 DSGVO).
            </p>
            <h3>Verbindung mit dem E-Mail-Postfach</h3>
            <p>
              Das Büro kann sein eigenes Postfach verbinden – per IMAP/SMTP (z. B. Gmail oder das Postfach der eigenen Domain) oder per Anmeldung mit einem Microsoft-Konto (Outlook /
              Microsoft 365). Bei der Microsoft-Anmeldung erhält FallFlow nur die Berechtigung, E-Mails zu lesen und zu senden; das Passwort des Kontos erfahren wir dabei nicht. Die
              Zugangsdaten jedes Büros werden verschlüsselt gespeichert, sind ausschließlich diesem Büro zugeordnet und weder für andere Büros noch im Browser einsehbar. Abruf und
              Versand erfolgen automatisiert; der Betreiber von FallFlow hat keinen manuellen Zugriff auf die Postfächer.
            </p>
            <p>
              Beim Abruf prüft FallFlow neue E-Mails (auch im Spam-/Junk-Ordner) darauf, ob es sich um eine Kundenanfrage handelt. Nur Kundenanfragen und Nachrichten zu bestehenden
              Fällen werden übernommen; der Inhalt anderer E-Mails (z. B. Newsletter oder Rechnungen von Lieferanten) wird nicht gespeichert – nur eine technische Kennung, damit dieselbe E-Mail nicht erneut geprüft wird.
            </p>
            <h3>Dokumente</h3>
            <p>
              Dokumente (z. B. ausgefüllte Formulare, Fotos, Pläne) erhält das Büro als Anhang einer E-Mail; FallFlow übernimmt PDF, JPG, PNG und WebP bis 10 MB
              in die Fallakte. Die Dateien liegen in einem privaten Speicher ohne öffentliche Adresse und sind nur für Mitarbeiter des jeweiligen Büros abrufbar.
            </p>
            <h3>Zugriff durch uns</h3>
            <p>
              Wir greifen auf die Daten der Büros nur zu, soweit das für den Betrieb, die Fehlerbehebung oder auf Anfrage des Büros (Support) erforderlich ist, und nur im Rahmen des
              Auftragsverarbeitungsvertrags. Für die Verwaltung sehen wir eine Übersicht der Büro-Konten (z. B. Name, Tarif, Status des Abonnements).
            </p>
          </Section>

          <Section id="endkunden" title="12. Daten von Endkunden der Büros">
            <p>
              Diese Informationen richten sich an Personen, die bei einem Betrieb angefragt haben, der FallFlow nutzt (Art. 14 DSGVO). Verantwortlich ist das jeweilige
              Büro; wir verarbeiten die Daten in dessen Auftrag.
            </p>
            <p>
              <strong>Herkunft der Daten:</strong> Die Daten stammen aus Ihren E-Mails an das Büro, aus Ihren Angaben im Website-Chat des Büros, aus zurückgeschickten Dokumenten
              sowie aus Notizen der Mitarbeiter des Büros (z. B. nach einem Telefonat).
            </p>
            <p>
              <strong>Kategorien von Daten:</strong>
            </p>
            <List
              items={[
                "Kontaktdaten: Name, E-Mail-Adresse, Telefonnummer, Adresse",
                "Angaben zum Auftrag, die das Büro für seine Leistung abfragt (z. B. Art und Größe des Objekts, Fahrzeugdaten, Wunschtermin), Adresse des Einsatzorts",
                "Anliegen und gewünschte Leistung, Inhalt der E-Mails, Chat-Nachrichten und Telefonnotizen",
                "Dokumente, z. B. Fotos, Pläne, ausgefüllte Formulare des Büros (diese können weitere Angaben enthalten, etwa Geburtsdatum oder Steuer-Identifikationsnummer, wenn das Formular des Büros danach fragt)",
                "Terminwünsche sowie vorgeschlagene bzw. vereinbarte Beratungstermine",
              ]}
            />
            <p>
              <strong>Zwecke und Rechtsgrundlage:</strong> Bearbeitung Ihrer Anfrage und Vorbereitung des Auftrags durch das Büro (Art. 6 Abs. 1 lit. b DSGVO – vorvertragliche
              Maßnahmen auf Ihre Anfrage hin); Nachfragen zu fehlenden Angaben und Unterlagen sowie Terminabstimmung (Art. 6 Abs. 1 lit. b bzw. f DSGVO, Interesse an einer zügigen
              Bearbeitung).
            </p>
            <p>
              <strong>Empfänger:</strong> die Mitarbeiter des Büros, unsere Auftragsverarbeiter (Abschnitt 17) und – nur für die KI-Funktionen – OpenAI (Abschnitt 13).
            </p>
            <p>
              <strong>Speicherdauer:</strong> siehe Abschnitt 19. Anfragen, die das Büro nicht übernimmt, löschen wir automatisch nach 12 Monaten ohne Aktivität.
            </p>
          </Section>

          <Section id="ki" title="13. KI-Funktionen (OpenAI)">
            <p>
              Für die automatische Bearbeitung nutzt FallFlow KI-Modelle von OpenAI (USA) über deren Programmierschnittstelle (API). Dabei werden – nur soweit für die jeweilige
              Funktion nötig – Inhalte an OpenAI übermittelt:
            </p>
            <List
              items={[
                "Text eingehender E-Mails: um zu erkennen, ob es eine Kundenanfrage ist, welche Leistung gewünscht ist und welche Angaben (z. B. Adresse, Art des Auftrags) bereits enthalten sind, und ob der Kunde eine Frage stellt, die das Büro selbst beantworten sollte",
                "zurückgeschickte Formulare und Dokumente (Text sowie bei Scans und Fotos die Seiten als Bild): um ausgefüllte Angaben auszulesen und zu prüfen, ob das Formular vollständig ist",
                "Fragen im Website-Chat eines Büros zusammen mit den Angaben des Büros zu seinen Leistungen: um die Frage zu beantworten",
                "Angaben aus der Fallakte: um eine Kurzzusammenfassung für das Büro zu erstellen",
                "Sprachnachrichten, die Kunden per WhatsApp schicken: um sie in Text umzuwandeln (abzutippen), damit sie wie eine Textnachricht bearbeitet werden können",
                "Fotos, die Kunden schicken: um für das Büro eine kurze, unverbindliche Einschätzung zu erstellen, was darauf zu sehen ist (nur für das Büro, nicht für den Kunden)",
                "Nachrichten von Kunden, die in einer anderen Sprache als Deutsch schreiben, sowie die Antworten an sie: um die Sprache zu erkennen und die Nachrichten zu übersetzen",
                "Angaben aus der Fallakte und die Preisliste des Büros: um auf Wunsch des Büros Entwürfe für persönliche Antworten und Angebote (Kostenvoranschläge) zu erstellen, die das Büro vor dem Versand prüft",
              ]}
            />
            <p>
              Über die API übermittelte Daten werden nach den Bedingungen von OpenAI nicht zum Training von KI-Modellen verwendet und höchstens 30 Tage zur Missbrauchserkennung
              gespeichert. Die Ergebnisse der KI sind Hilfen für das Büro; über die Bearbeitung entscheidet immer ein Mensch (Abschnitt 21).
            </p>
            <p>
              Schaltet ein Mitarbeiter des Büros Push-Benachrichtigungen ein (z. B. bei Notfällen), speichern wir die vom Browser erzeugte Empfangsadresse seines Geräts. Die
              Benachrichtigungen (z. B. Name des Kunden und Anlass) werden verschlüsselt über den Push-Dienst des jeweiligen Browserherstellers (z. B. Google, Apple, Mozilla)
              zugestellt; dieser kann den Inhalt nicht lesen. Die Benachrichtigungen lassen sich jederzeit im Dashboard oder in den Browser-Einstellungen abschalten.
            </p>
            <p>
              Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Erbringung der vereinbarten Leistung gegenüber dem Büro bzw. Bearbeitung der Anfrage des Endkunden) im Rahmen der
              Auftragsverarbeitung.
            </p>
          </Section>

          <Section id="chat" title="14. Website-Chat, Telefon-Assistent und WhatsApp der Büros">
            <p>
              Büros können ein Chat-Fenster von FallFlow auf ihrer eigenen Website einbinden. Darin beantwortet die KI allgemeine Fragen zu den Leistungen des Büros. Ihre Fragen werden
              dafür an FallFlow und an OpenAI (Abschnitt 13) übermittelt. Bitte geben Sie im Chat keine sensiblen Daten ein. Verantwortlich für den Chat auf seiner Website ist das jeweilige Büro. Das Chat-Widget setzt keine Cookies.
            </p>
            <p>
              Büros können außerdem Anrufe an eine FallFlow-Telefonnummer weiterleiten. Dann nimmt eine KI den Anruf an – darauf wird zu Beginn jedes Gesprächs hingewiesen – und fragt
              die Angaben zu Ihrem Anliegen ab. Verarbeitet werden Ihre Telefonnummer (sofern übermittelt), Zeitpunkt und Dauer des Anrufs sowie das Gesagte als Text; daraus entsteht
              eine Anfrage in der Fallakte des Büros (Abschnitt 12). Das Gespräch wird nicht als Audiodatei aufgezeichnet. Für die Telefonie und die Spracherkennung bzw. Sprachausgabe
              nutzen wir Twilio (Abschnitt 17), für das Verstehen der Angaben OpenAI (Abschnitt 13). Verantwortlich ist das jeweilige Büro; wir verarbeiten die Daten in dessen Auftrag.
            </p>
            <p>
              Verbindet ein Büro sein WhatsApp-Business-Konto, beantwortet die KI auch Nachrichten, die Sie dem Büro per WhatsApp schicken. Verarbeitet werden Ihre
              WhatsApp-Nummer, Ihr Profilname, Ihre Nachrichten sowie Fotos und Dokumente, die Sie schicken; daraus entsteht eine Anfrage in der Fallakte des Büros (Abschnitt 12).
              Die Nachrichten laufen über die WhatsApp Business Platform von Meta (Abschnitt 17). Verantwortlich ist das jeweilige Büro; wir verarbeiten die Daten in dessen Auftrag.
            </p>
          </Section>

          <Section id="systemmails" title="15. System-E-Mails von FallFlow">
            <p>
              E-Mails, die FallFlow selbst verschickt – z. B. die Bestätigung Ihrer E-Mail-Adresse oder „Passwort vergessen“ –, versenden wir über den Dienst
              Resend (Plus Five Five, Inc., USA) über einen Server in der EU (Irland). Verarbeitet werden Ihre E-Mail-Adresse, der Inhalt der Nachricht und technische Versanddaten
              (z. B. Zustellstatus). Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
            </p>
            <p>E-Mails an die Kunden eines Büros versendet FallFlow nicht über diesen Dienst, sondern immer über das verbundene Postfach des Büros selbst.</p>
          </Section>

          <Section id="sentry" title="16. Fehlerüberwachung">
            <p>
              Um technische Fehler schnell zu erkennen und zu beheben, nutzen wir – soweit aktiviert – den Dienst Sentry (Functional Software, Inc., USA). Bei einem Fehler werden
              Diagnosedaten übermittelt, z. B. Fehlermeldung, technischer Ablauf (Stacktrace), aufgerufene Seite, Browser und Betriebssystem. Die Verarbeitung erfolgt in einer
              EU-Region (Frankfurt). Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem fehlerfreien Betrieb).
            </p>
          </Section>

          <Section id="empfaenger" title="17. Empfänger und Auftragsverarbeiter">
            <p>
              Wir geben personenbezogene Daten nur weiter, wenn das für die genannten Zwecke erforderlich ist. Wir verkaufen keine Daten. Wir setzen folgende Dienstleister ein; mit
              den Auftragsverarbeitern bestehen Verträge nach Art. 28 DSGVO:
            </p>
            <List
              items={[
                "Vercel Inc. (USA) – Hosting der Website und Anwendung, Rechenzentrum in der EU (Dublin)",
                "Supabase Inc. (USA) – Datenbank, Anmeldung und Dateispeicher, Rechenzentrum in der EU (Irland)",
                "OpenAI (USA) – KI-Funktionen (Abschnitt 13)",
                "Twilio Inc. (USA) – Telefonie, Spracherkennung und Sprachausgabe für den Telefon-Assistenten (Abschnitt 14)",
                "Meta Platforms Ireland Ltd. (Irland) – WhatsApp Business Platform, nur wenn ein Büro WhatsApp verbindet (Abschnitt 14)",
                "Resend / Plus Five Five, Inc. (USA) – Versand von System-E-Mails, Server in der EU (Irland)",
                "Zoho Corporation B.V. (Niederlande) – unser eigenes E-Mail-Postfach, Rechenzentrum in der EU",
                "Functional Software, Inc. / Sentry (USA) – Fehlerüberwachung, EU-Region (Frankfurt)",
                "Stripe Payments Europe, Ltd. (Irland) – Zahlungsabwicklung (für eigene Zwecke teilweise eigenständig verantwortlich)",
                "Google Ireland Limited (Irland) – Conversion-Tracking, nur mit Ihrer Einwilligung",
              ]}
            />
            <p>
              Darüber hinaus geben wir Daten nur weiter, wenn wir gesetzlich dazu verpflichtet sind (z. B. an Behörden oder Gerichte) oder wenn dies zur Durchsetzung unserer Rechte
              erforderlich ist (z. B. an Steuerberater oder Rechtsanwälte, die zur Verschwiegenheit verpflichtet sind).
            </p>
          </Section>

          <Section id="drittland" title="18. Übermittlung in Drittländer">
            <p>
              Mehrere Dienstleister haben ihren Sitz in den USA. Auch wenn die Daten in Rechenzentren in der EU gespeichert werden, kann ein Zugriff aus den USA (z. B. für Wartung oder
              Support) nicht ausgeschlossen werden; bei OpenAI und Twilio (und ggf. Meta) werden Daten auch in den USA verarbeitet.
            </p>
            <p>
              Die Übermittlung stützt sich auf den Angemessenheitsbeschluss der EU-Kommission zum EU-US Data Privacy Framework (Art. 45 DSGVO), soweit der jeweilige Anbieter danach
              zertifiziert ist, und im Übrigen auf die Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO), die Bestandteil der Verträge mit den Anbietern sind.
              Eine Kopie der Garantien erhalten Sie auf Anfrage unter {siteConfig.supportEmail}.
            </p>
          </Section>

          <Section id="speicherdauer" title="19. Speicherdauer">
            <p>Wir speichern personenbezogene Daten nur so lange, wie es für den jeweiligen Zweck erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen:</p>
            <List
              items={[
                "Server-Logs: nach den Vorgaben des Hosting-Anbieters, in der Regel wenige Tage",
                "Anfragen, die ein Büro nicht übernimmt: automatische Löschung nach 12 Monaten ohne Aktivität (samt Dokumenten, Nachrichten und Verlauf)",
                "Vom Büro übernommene Fälle: bis das Büro sie löscht – das Büro entscheidet nach seinen eigenen Aufbewahrungspflichten",
                "Benutzerkonto und alle Daten eines Büros: 30 Tage nach Ende des Abonnements werden sie vollständig gelöscht (7 Tage vorher erhält das Büro einen Hinweis und kann seine Daten exportieren)",
                "Prüfwert zur einmaligen Testphase: drei Jahre",
                "Rechnungen und buchungsrelevante Unterlagen: zehn Jahre (§ 147 AO, § 257 HGB)",
                "Geschäftliche E-Mails: sechs bzw. zehn Jahre, soweit sie Handels- oder Geschäftsbriefe sind; sonst Löschung nach Erledigung",
                "Ihre Auswahl im Cookie-Hinweis: bis Sie sie im Browser löschen; Google-Ads-Cookies: in der Regel 90 Tage",
              ]}
            />
            <p>Sind Daten wegen gesetzlicher Pflichten aufzubewahren, schränken wir ihre Verarbeitung ein und löschen sie nach Ablauf der Frist.</p>
          </Section>

          <Section id="pflicht" title="20. Pflicht zur Bereitstellung">
            <p>
              Der Besuch dieser Website ist ohne Angabe persönlicher Daten möglich. Für die Registrierung und Nutzung von FallFlow sind Name, Unternehmen und E-Mail-Adresse
              erforderlich; ohne diese Angaben können wir kein Konto anlegen und den Vertrag nicht erfüllen. Für ein Abonnement ist zusätzlich eine Zahlungsmethode nötig. Weitere
              Angaben sind freiwillig. Eine gesetzliche Pflicht, uns Daten bereitzustellen, besteht nicht.
            </p>
          </Section>

          <Section id="automatisiert" title="21. Keine automatisierte Entscheidung, kein Profiling">
            <p>
              Die KI erkennt und sammelt Angaben, fasst sie zusammen und bereitet Antworten mit den Texten des Büros vor. Sie trifft keine Entscheidungen, die Ihnen gegenüber
              rechtliche Wirkung entfalten oder Sie in ähnlicher Weise erheblich beeinträchtigen (Art. 22 DSGVO), und gibt keine verbindlichen Preis-, Fach- oder Rechtsauskünfte. Über die
              Bearbeitung einer Anfrage und die Beratung entscheidet stets ein Mitarbeiter des Büros. Wir erstellen keine Persönlichkeits- oder Werbeprofile.
            </p>
          </Section>

          <Section id="sicherheit" title="22. Datensicherheit">
            <p>Wir schützen Ihre Daten durch technische und organisatorische Maßnahmen nach Art. 32 DSGVO, unter anderem:</p>
            <List
              items={[
                "verschlüsselte Übertragung aller Seiten und Schnittstellen (HTTPS/TLS)",
                "strikte Trennung der Daten verschiedener Büros auf Datenbankebene; jedes Büro sieht nur seine eigenen Daten",
                "verschlüsselte Speicherung von Postfach-Zugangsdaten",
                "Dokumente in einem privaten Speicher ohne öffentliche Adresse",
                "Passwörter nur als Hash, Bestätigung neuer Konten per E-Mail, Begrenzung von Anmeldeversuchen",
                "Rollen und Berechtigungen innerhalb eines Büros (z. B. Inhaber, Admin, Mitarbeiter)",
                "Hosting und Datenbank in Rechenzentren in der EU",
              ]}
            />
            <p>Eine absolut sichere Übertragung über das Internet kann niemand garantieren; wir passen unsere Maßnahmen laufend dem Stand der Technik an.</p>
          </Section>

          <Section id="rechte" title="23. Ihre Rechte">
            <p>Sie haben gegenüber uns folgende Rechte hinsichtlich Ihrer personenbezogenen Daten:</p>
            <List
              items={[
                <>
                  <strong>Auskunft (Art. 15 DSGVO):</strong> ob und welche Daten wir über Sie verarbeiten, zu welchem Zweck, an wen sie gehen und wie lange sie gespeichert werden;
                  auf Wunsch erhalten Sie eine Kopie.
                </>,
                <>
                  <strong>Berichtigung (Art. 16 DSGVO):</strong> unrichtige Daten zu korrigieren und unvollständige zu ergänzen.
                </>,
                <>
                  <strong>Löschung (Art. 17 DSGVO):</strong> Ihre Daten zu löschen, soweit keine gesetzlichen Aufbewahrungspflichten oder andere Gründe entgegenstehen.
                </>,
                <>
                  <strong>Einschränkung der Verarbeitung (Art. 18 DSGVO):</strong> z. B. solange die Richtigkeit Ihrer Daten geprüft wird.
                </>,
                <>
                  <strong>Datenübertragbarkeit (Art. 20 DSGVO):</strong> Daten, die Sie uns bereitgestellt haben, in einem gängigen, maschinenlesbaren Format zu erhalten oder an
                  einen anderen Verantwortlichen übermitteln zu lassen. Büros können ihre Daten dafür jederzeit selbst exportieren.
                </>,
                <>
                  <strong>Widerspruch (Art. 21 DSGVO):</strong> siehe Abschnitt 24.
                </>,
                <>
                  <strong>Widerruf einer Einwilligung (Art. 7 Abs. 3 DSGVO):</strong> jederzeit mit Wirkung für die Zukunft; die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung
                  bleibt unberührt. Die Einwilligung in das Google-Ads-Tracking widerrufen Sie über „Cookie-Einstellungen“ im Fußbereich der Website.
                </>,
              ]}
            />
            <p>
              Zur Ausübung Ihrer Rechte genügt eine E-Mail an {siteConfig.supportEmail}. Wir antworten in der Regel innerhalb eines Monats (Art. 12 Abs. 3 DSGVO). Um Missbrauch zu
              vermeiden, können wir Sie bitten, Ihre Identität nachzuweisen. Betreffen Ihre Rechte Daten, die ein Büro mit FallFlow über Sie verarbeitet, wenden Sie sich bitte an
              dieses Büro; leiten Sie Ihr Anliegen an uns weiter, geben wir es an das Büro weiter.
            </p>
          </Section>

          <Section id="widerspruch" title="24. Widerspruchsrecht">
            <p className="font-medium">
              Verarbeiten wir Ihre Daten auf Grundlage unseres berechtigten Interesses (Art. 6 Abs. 1 lit. f DSGVO), haben Sie das Recht, aus Gründen, die sich aus Ihrer besonderen
              Situation ergeben, jederzeit Widerspruch gegen diese Verarbeitung einzulegen (Art. 21 Abs. 1 DSGVO). Wir verarbeiten die Daten dann nicht mehr, es sei denn, wir können
              zwingende schutzwürdige Gründe nachweisen, die Ihre Interessen, Rechte und Freiheiten überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder
              Verteidigung von Rechtsansprüchen.
            </p>
            <p className="font-medium">
              Sollten wir Ihre Daten jemals für Direktwerbung verarbeiten, können Sie dem jederzeit ohne Angabe von Gründen widersprechen (Art. 21 Abs. 2 DSGVO). Der Widerspruch ist
              formlos möglich, z. B. per E-Mail an {siteConfig.supportEmail}.
            </p>
          </Section>

          <Section id="beschwerde" title="25. Beschwerderecht bei einer Aufsichtsbehörde">
            <p>
              Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, wenn Sie der Ansicht sind, dass die Verarbeitung Ihrer Daten gegen die DSGVO verstößt
              (Art. 77 DSGVO) – insbesondere in dem Mitgliedstaat Ihres Aufenthaltsorts, Ihres Arbeitsplatzes oder des mutmaßlichen Verstoßes. Für uns zuständig ist:
            </p>
            <p>
              Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)
              <br />
              Promenade 18
              <br />
              91522 Ansbach
              <br />
              www.lda.bayern.de
            </p>
          </Section>

          <Section id="sonstiges" title="26. Minderjährige, Änderungen dieser Erklärung">
            <p>
              FallFlow richtet sich ausschließlich an Unternehmen. Wir verarbeiten nicht wissentlich Daten von Personen unter 16 Jahren.
            </p>
            <p>
              Wir passen diese Datenschutzerklärung an, wenn sich unsere Dienste, die eingesetzten Anbieter oder die Rechtslage ändern. Es gilt die jeweils auf dieser Seite
              veröffentlichte Fassung.
            </p>
          </Section>
        </div>
      </main>
      <Footer />
    </>
  );
}

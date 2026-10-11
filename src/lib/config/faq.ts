export const faqs = [
  {
    q: "Brauche ich ein neues CRM?",
    a: "Nein. FallFlow ersetzt weder ein CRM noch Ihre Beratungssoftware. Es konzentriert sich auf einen Schritt: aus einer Kundenanfrage einen vollständig vorbereiteten Beratungsfall zu machen, den Sie anschließend in Ihrem gewohnten Ablauf weiterbearbeiten.",
  },
  {
    q: "Was unterscheidet FallFlow von einem KI-Chatbot?",
    a: "Ein Chatbot beantwortet nur Fragen – das macht bei FallFlow der Website-Chat. Der Kern ist aber die E-Mail-Bearbeitung: FallFlow erkennt Angaben in der Anfrage, fordert nur Fehlendes an, fordert Dokumente an, prüft die Vollständigkeit und legt die fertige Fallakte an. Es berät nicht und erfindet keine Angaben.",
  },
  {
    q: "Kann ich meine bestehende Website weiterverwenden?",
    a: "Ja. Das Chat-Widget wird mit einem kleinen Script-Tag in Ihre bestehende Website eingebunden. Ihre Seite muss dafür nicht neu aufgebaut werden.",
  },
  {
    q: "Was passiert mit den Dokumenten der Kunden?",
    a: "Kunden schicken ausgefüllte Formulare, Grundriss, Energieausweis oder Fotos einfach als Antwort auf die E-Mail. FallFlow ordnet sie dem richtigen Fall zu, prüft ausgefüllte Formulare und übernimmt die eingetragenen Angaben in die Fallakte. Übernommen werden PDF, JPG, PNG und WebP bis 10 MB; bei anderen Dateien (z. B. iPhone-Fotos im HEIC-Format) zeigt die Fallakte einen Hinweis. Die Dateien liegen in einem privaten Speicher und sind nur für Mitarbeiter Ihres Büros abrufbar – es gibt keine öffentlichen Datei-Links.",
  },
  {
    q: "Kann FallFlow automatisch antworten?",
    a: "Ja. Auf E-Mail-Anfragen schickt FallFlow die von Ihnen hinterlegte Nachricht je Leistung inklusive passender PDF-Vorlage – damit es sich wie eine echte Antwort aus Ihrem Büro liest. Im Website-Chat beantwortet die KI Fragen von Besuchern zu Ihren Leistungen und zur Energieberatung; für Anfragen und Termine verweist sie auf Ihre E-Mail-Adresse und Telefonnummer. Ist bei einer E-Mail die gewünschte Leistung unklar oder stellt der Kunde eine Frage, antwortet die KI bewusst nicht automatisch – die Mail erscheint im Posteingang unter „Aufmerksamkeit benötigt“, und Sie antworten selbst. Es gibt keine verbindliche Energie-, Förder- oder Rechtsberatung. Bei Unsicherheit oder auf Wunsch wird die Anfrage an einen Mitarbeiter übergeben. Automatische Antworten lassen sich jederzeit abschalten.",
  },
  {
    q: "Kann ich festlegen, welche Angaben und Unterlagen ich brauche?",
    a: "Ja. Unter „Vorlagen & Nachrichten“ legen Sie je Leistung Ihren Nachrichtentext, PDF-Vorlagen und benötigte Dokumente (z. B. Grundriss, Energieausweis) fest. Angaben, die Sie in der Nachricht anfordern (z. B. Telefonnummer), zählen automatisch zur Vollständigkeit des Falls.",
  },
  {
    q: "Wo werden Kundendaten gespeichert?",
    a: "Die Daten werden in einer PostgreSQL-Datenbank (Supabase) gespeichert, jedes Büro sieht ausschließlich die eigenen Daten. Den konkreten Speicherort und die Auftragsverarbeitung legen Sie beim Betrieb über Ihre Supabase-Region und die entsprechenden Verträge fest. Details stehen in der Datenschutzerklärung.",
  },
];

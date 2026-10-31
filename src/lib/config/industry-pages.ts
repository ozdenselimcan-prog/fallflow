/**
 * Inhalte der Branchenseiten (/branchen/…): je Branche eigene Texte für Google und für Besucher aus der Branche.
 * Leistungen und abgefragte Angaben kommen aus den Branchen-Vorlagen (industry-presets.ts), damit Seite und Produkt
 * zusammenpassen.
 */

export interface IndustryPage {
  slug: string;
  /** id der Branchen-Vorlage */
  preset: string;
  /** Name im Plural für Überschriften, z. B. "Dachdecker" */
  audience: string;
  metaTitle: string;
  metaDescription: string;
  headline: string;
  intro: string;
  pains: { title: string; text: string }[];
  /** Beispiel-Nachricht eines Kunden */
  example: string;
  /** Was der Betrieb am Ende in der Fallakte hat */
  result: string;
  faq: { q: string; a: string }[];
}

export const INDUSTRY_PAGES: IndustryPage[] = [
  {
    slug: "dachdecker",
    preset: "dachdecker",
    audience: "Dachdecker",
    metaTitle: "KI für Dachdecker: Anfragen automatisch beantworten",
    metaDescription: "Sturmschaden, Reparatur, Neueindeckung: Die KI beantwortet Kundenanfragen per E-Mail und WhatsApp, fragt Dachart, Fläche und Fotos ab und bereitet den Auftrag vor.",
    headline: "Weniger Telefon, mehr Dach.",
    intro: "Nach jedem Sturm stehen Postfach und Telefon nicht mehr still. Die KI nimmt die Anfragen an, fragt nach Dachart, betroffener Fläche und Fotos vom Schaden – und echte Notfälle landen sofort bei Ihnen.",
    pains: [
      { title: "Nach dem Sturm kommt alles auf einmal", text: "Dutzende Anfragen in wenigen Stunden – und jede braucht erst Rückfragen, bevor Sie einschätzen können, wie dringend es ist." },
      { title: "Ohne Fotos keine Einschätzung", text: "„Unser Dach ist undicht“ reicht nicht. Fotos, Dachart und Fläche müssen Sie meist mehrfach nachfragen." },
      { title: "Sie stehen auf dem Dach, nicht am Schreibtisch", text: "Rückrufe und Mails bleiben bis abends liegen – manche Kunden fragen inzwischen woanders an." },
    ],
    example: "Hallo, nach dem Sturm fehlen bei uns Ziegel, es tropft schon in den Dachboden. Können Sie vorbeikommen?",
    result: "Fallakte mit Adresse, Dachart, ungefährer Fläche, Fotos vom Schaden – und als Notfall markiert, weil Wasser eintritt.",
    faq: [
      { q: "Erkennt die KI echte Notfälle?", a: "Ja. Dringt Wasser ein oder ist das Dach offen, antwortet die KI nicht automatisch, sondern markiert die Anfrage sofort als „Aufmerksamkeit benötigt“ – Sie entscheiden, wie es weitergeht." },
      { q: "Nennt die KI Preise?", a: "Nein. Preis- und Kostenfragen beantworten immer Sie selbst. Die KI sammelt nur die Angaben, die Sie für ein Angebot brauchen." },
      { q: "Können Kunden Fotos schicken?", a: "Ja – per E-Mail-Anhang oder direkt im WhatsApp-Chat. Die Fotos landen automatisch in der Fallakte." },
    ],
  },
  {
    slug: "elektriker",
    preset: "elektriker",
    audience: "Elektriker",
    metaTitle: "KI für Elektriker: Wallbox-, E-Check- und Reparatur-Anfragen automatisch",
    metaDescription: "Die KI beantwortet Anfragen für Elektriker per E-Mail und WhatsApp, fragt Gebäude, Ladeleistung oder Fehlerbild ab, sammelt Fotos vom Zählerschrank und erkennt Notfälle.",
    headline: "Anfragen vorbereitet, bevor Sie anrufen.",
    intro: "Wallbox, Zählerschrank, E-Check oder Störung – für jede Anfrage brauchen Sie andere Angaben. Die KI fragt genau die richtigen ab und schickt Ihnen den fertigen Fall. Brandgeruch oder Stromausfall gehen sofort an Sie.",
    pains: [
      { title: "„Was kostet eine Wallbox?“", text: "Ohne Gebäude, Ladeleistung und ein Foto vom Zählerschrank kann niemand seriös antworten – trotzdem kommen solche Anfragen jeden Tag." },
      { title: "Fotos vom Zählerschrank fehlen immer", text: "Erst beim Termin stellt sich heraus, dass der Zählerschrank erneuert werden muss. Das hätte man vorher sehen können." },
      { title: "Störungen kommen zur falschen Zeit", text: "Zwischen zwei Baustellen fehlt die Zeit, Mails zu sortieren und Dringendes von Anfragen zu trennen." },
    ],
    example: "Guten Tag, wir möchten eine Wallbox in unserer Garage installieren lassen, 11 kW. Was brauchen Sie von uns?",
    result: "Fallakte mit Gebäude, gewünschter Ladeleistung, Adresse und Fotos von Zählerschrank und Installationsort.",
    faq: [
      { q: "Was passiert bei Stromausfall oder Brandgeruch?", a: "Solche Anfragen beantwortet die KI nicht selbst. Sie werden sofort als „Aufmerksamkeit benötigt“ markiert, damit Sie direkt reagieren können." },
      { q: "Fragt die KI bei jeder Leistung dasselbe?", a: "Nein. Sie legen fest, welche Angaben für welche Leistung gebraucht werden – zum Beispiel Ladeleistung nur bei der Wallbox." },
      { q: "Funktioniert das mit meinem bestehenden Postfach?", a: "Ja, mit Outlook/Microsoft 365, Gmail, IONOS, Strato und praktisch jedem anderen Postfach." },
    ],
  },
  {
    slug: "maler",
    preset: "maler",
    audience: "Maler",
    metaTitle: "KI für Maler: Anfragen mit Fläche und Fotos automatisch vorbereitet",
    metaDescription: "Innenanstrich, Fassade, Tapezieren: Die KI beantwortet Anfragen für Malerbetriebe, fragt Fläche, Räume und Zustand ab und sammelt Fotos – für schnelle Angebote.",
    headline: "Angebote schreiben statt Angaben jagen.",
    intro: "Für ein Angebot brauchen Sie Fläche, Räume, den Zustand der Wände und am besten ein paar Fotos. Die KI fragt das ab, sobald die Anfrage reinkommt – Sie bekommen eine Fallakte, mit der Sie direkt kalkulieren können.",
    pains: [
      { title: "„Was kostet das Streichen?“", text: "Ohne Quadratmeter und Zustand der Wände lässt sich nichts sagen. Bis die Angaben da sind, vergehen Tage." },
      { title: "Besichtigungstermine für Kleinigkeiten", text: "Viele Termine vor Ort wären mit guten Fotos überflüssig." },
      { title: "Anfragen kommen abends und am Wochenende", text: "Wer am Montag antwortet, ist oft schon zu spät." },
    ],
    example: "Hallo, wir möchten Wohnzimmer und Flur neu streichen lassen, zusammen ungefähr 45 m² Wandfläche.",
    result: "Fallakte mit Fläche, Räumen, Zustand der Wände, Adresse und Fotos der Räume.",
    faq: [
      { q: "Kann ich die Fragen selbst festlegen?", a: "Ja. Die KI schlägt typische Angaben für Malerbetriebe vor, Sie ändern, löschen oder ergänzen sie." },
      { q: "Beantwortet die KI Preisfragen?", a: "Nein, Preise nennen immer Sie. Die KI sorgt nur dafür, dass Sie alle Angaben fürs Angebot haben." },
      { q: "Brauche ich dafür eine neue Website?", a: "Nein. FallFlow arbeitet mit Ihrem bestehenden Postfach; Website-Chat und WhatsApp-Button lassen sich optional einbinden." },
    ],
  },
  {
    slug: "heizung-sanitaer",
    preset: "shk",
    audience: "SHK-Betriebe",
    metaTitle: "KI für Heizung & Sanitär: Anfragen und Notfälle automatisch sortieren",
    metaDescription: "Heizungswartung, Heizungstausch, Wärmepumpe, Badsanierung: Die KI beantwortet Anfragen für SHK-Betriebe, fragt Heizungsart und Fotos ab und erkennt Heizungsausfall und Rohrbruch sofort.",
    headline: "Notfälle sofort, Wartungen automatisch.",
    intro: "Wartung, Heizungstausch, Wärmepumpe oder Badsanierung – die KI fragt pro Leistung genau die Angaben ab, die Sie brauchen. Heizungsausfall und Rohrbruch erkennt sie und gibt sie direkt an Sie weiter.",
    pains: [
      { title: "Notfall oder Wartung?", text: "Zwischen vielen Routineanfragen geht der Heizungsausfall mit Baby im Haus schnell unter." },
      { title: "„Welche Heizung haben Sie denn?“", text: "Typenschild, Alter, Heizungsart – ohne diese Angaben ist jeder Termin ein Blindflug." },
      { title: "Badanfragen ohne Grundriss", text: "Für ein Bad-Angebot brauchen Sie Größe, Fotos und Wünsche – meist in mehreren Runden." },
    ],
    example: "Unsere Gasheizung müsste mal wieder gewartet werden, Baujahr 2009. Wann hätten Sie Zeit?",
    result: "Fallakte mit Heizungsart, Alter, Adresse, Foto vom Typenschild – und ein Terminvorschlag zur Freigabe.",
    faq: [
      { q: "Wie erkennt die KI einen Notfall?", a: "Heizungsausfall, kein Warmwasser, Rohrbruch oder Gasgeruch werden erkannt und nicht automatisch beantwortet, sondern sofort Ihnen gemeldet." },
      { q: "Fragt die KI bei der Badsanierung nach der Heizung?", a: "Nein. Jede Angabe gilt nur für die Leistungen, bei denen Sie sie wirklich brauchen." },
      { q: "Kann die KI Termine vergeben?", a: "Sie schlägt passende Termine aus Ihren Arbeitszeiten vor. Verbindlich wird ein Termin erst, wenn Sie ihn bestätigen." },
    ],
  },
  {
    slug: "tischler",
    preset: "tischler",
    audience: "Tischler und Schreiner",
    metaTitle: "KI für Tischler und Schreiner: Anfragen mit Maßen und Fotos",
    metaDescription: "Möbel nach Maß, Einbauschrank, Küche, Treppe: Die KI beantwortet Anfragen für Tischlereien, fragt Maße, Material und Fotos der Einbausituation ab.",
    headline: "Maße und Fotos schon da, wenn Sie die Anfrage lesen.",
    intro: "Für Maßanfertigungen brauchen Sie Maße, Wünsche zum Material und am besten Fotos der Einbausituation. Die KI holt das ein, bevor Sie sich mit der Anfrage beschäftigen.",
    pains: [
      { title: "Anfragen ohne Maße", text: "„Wir hätten gern einen Einbauschrank“ – und dann beginnt das Nachfragen." },
      { title: "Unklare Wünsche", text: "Material, Oberfläche, Budget – vieles klärt sich erst im dritten Telefonat." },
      { title: "Zeit in der Werkstatt", text: "Jede Unterbrechung für Rückfragen kostet Zeit an der Maschine." },
    ],
    example: "Hallo, wir suchen einen Einbauschrank für unsere Dachschräge im Schlafzimmer.",
    result: "Fallakte mit Maßen, Material- und Oberflächenwünschen, Adresse und Fotos der Einbausituation.",
    faq: [
      { q: "Kann ich eigene Formulare verwenden?", a: "Ja. Ihre PDF-Formulare gehen per E-Mail automatisch mit; im WhatsApp-Chat fragt die KI die Angaben daraus einzeln ab." },
      { q: "Was ist mit Preisfragen?", a: "Die beantworten Sie selbst – die KI markiert solche Fragen für Sie." },
      { q: "Wie lange dauert die Einrichtung?", a: "Etwa 10 Minuten. Mit der Branchen-Vorlage für Tischlereien sind Leistungen und Angaben schon vorbereitet." },
    ],
  },
  {
    slug: "garten-landschaftsbau",
    preset: "garten",
    audience: "Garten- und Landschaftsbauer",
    metaTitle: "KI für Garten- und Landschaftsbau: Anfragen automatisch vorbereitet",
    metaDescription: "Gartenpflege, Heckenschnitt, Baumfällung, Pflasterarbeiten: Die KI beantwortet Anfragen für GaLaBau-Betriebe, fragt Fläche, Zufahrt und Fotos ab.",
    headline: "Der Garten wartet nicht – Ihre Kunden auch nicht.",
    intro: "Im Frühjahr kommen die Anfragen in Wellen. Die KI fragt Fläche, Heckenlänge oder Baumhöhe, Zufahrt und Fotos ab – und meldet gefährliche Situationen wie umsturzgefährdete Bäume sofort.",
    pains: [
      { title: "Saisonspitzen", text: "Im Frühjahr kommen mehr Anfragen, als Sie beantworten können." },
      { title: "„Wie groß ist der Garten?“", text: "Ohne Fläche, Fotos und Zufahrt ist jede Schätzung geraten." },
      { title: "Gefährliche Bäume", text: "Ein angebrochener Ast über dem Carport muss schneller erkannt werden als eine Rasenanfrage." },
    ],
    example: "Guten Tag, unsere Hecke ist etwa 30 Meter lang und 2 Meter hoch und müsste geschnitten werden.",
    result: "Fallakte mit Heckenlänge und -höhe, Zufahrt, Adresse, Fotos – und ein Terminvorschlag.",
    faq: [
      { q: "Werden Gefahrensituationen erkannt?", a: "Ja. Umsturzgefährdete Bäume oder herabgefallene Äste werden als Notfall markiert und Ihnen direkt gemeldet." },
      { q: "Kann ich Angaben pro Leistung festlegen?", a: "Ja – Baumhöhe zum Beispiel nur bei Baumfällung, Fläche bei Pflasterarbeiten." },
      { q: "Funktioniert das auch per WhatsApp?", a: "Ja. Viele Kunden schicken Fotos lieber per WhatsApp – die KI fragt dort Schritt für Schritt nach." },
    ],
  },
  {
    slug: "reinigung",
    preset: "reinigung",
    audience: "Reinigungsfirmen",
    metaTitle: "KI für Reinigungsfirmen: Anfragen für Büro-, Fenster- und Endreinigung",
    metaDescription: "Büroreinigung, Treppenhaus, Fenster, Endreinigung: Die KI beantwortet Anfragen für Reinigungsfirmen, fragt Fläche, Häufigkeit und Wunschtermin ab.",
    headline: "Jede Anfrage angebotsfertig.",
    intro: "Für ein Reinigungsangebot brauchen Sie Fläche, Häufigkeit und oft einen Wunschtermin. Die KI fragt das ab – bei der Fensterreinigung die Anzahl der Fenster, bei der Endreinigung den Auszugstermin.",
    pains: [
      { title: "Unvollständige Anfragen", text: "„Was kostet eine Büroreinigung?“ – ohne Fläche und Rhythmus keine Antwort möglich." },
      { title: "Kurzfristige Endreinigungen", text: "Umzugskunden brauchen schnell eine Zusage – Rückfragen kosten Tage." },
      { title: "Viele kleine Anfragen", text: "Jede einzelne braucht Zeit, bevor klar ist, ob sie sich lohnt." },
    ],
    example: "Hallo, wir suchen eine Büroreinigung für etwa 250 m², zweimal pro Woche abends.",
    result: "Fallakte mit Fläche, Reinigungsrhythmus, Adresse und Fotos der Räume – bereit für Ihr Angebot.",
    faq: [
      { q: "Nennt die KI Preise?", a: "Nein. Die KI sammelt die Angaben, Ihr Angebot schreiben Sie selbst." },
      { q: "Kann ich auf meine bestehende Preisliste verweisen?", a: "Ja. Eine Preisliste können Sie als „nur zur Info“-PDF automatisch mitschicken lassen." },
      { q: "Wie schnell antwortet die KI?", a: "In der Regel innerhalb weniger Minuten – auch abends und am Wochenende." },
    ],
  },
  {
    slug: "hausverwaltung",
    preset: "hausverwaltung",
    audience: "Hausverwaltungen",
    metaTitle: "KI für Hausverwaltungen: Schadensmeldungen automatisch erfassen",
    metaDescription: "Schadensmeldungen, Fragen zur Nebenkostenabrechnung, Mietinteressenten: Die KI erfasst Meldungen von Mietern per E-Mail und WhatsApp vollständig und erkennt Notfälle wie Wasserschäden.",
    headline: "Schadensmeldungen vollständig – beim ersten Mal.",
    intro: "Welche Wohnung, welche Etage, was genau ist kaputt? Die KI fragt bei jeder Meldung nach, sammelt Fotos und legt eine saubere Fallakte an. Wasserschäden und Heizungsausfälle gehen sofort an Sie.",
    pains: [
      { title: "„Bei mir tropft es“", text: "Welches Objekt, welche Wohnung, seit wann? Die Hälfte der Meldungen braucht Rückfragen." },
      { title: "Notfälle zwischen Routine", text: "Ein Rohrbruch im Keller darf nicht hinter zehn Fragen zur Nebenkostenabrechnung landen." },
      { title: "Viele Kanäle", text: "Mieter schreiben per Mail, WhatsApp und rufen an – alles muss irgendwo landen." },
    ],
    example: "Guten Tag, in meiner Wohnung im 2. OG tropft seit gestern der Wasserhahn in der Küche ununterbrochen.",
    result: "Fallakte mit Objekt, Wohnung, Beschreibung des Schadens und Fotos – bereit zur Beauftragung des Handwerkers.",
    faq: [
      { q: "Werden Notfälle erkannt?", a: "Ja. Wasser im Keller, Rohrbruch, Heizungs- oder Stromausfall werden nicht automatisch beantwortet, sondern sofort Ihnen gemeldet." },
      { q: "Beantwortet die KI Fragen zur Nebenkostenabrechnung?", a: "Nein. Solche Fragen markiert die KI für Sie – die Antwort kommt von Ihrem Team." },
      { q: "Brauchen Mieter eine Adresse anzugeben?", a: "Sie legen fest, was gefragt wird – bei Hausverwaltungen typischerweise Objekt und Wohnung statt der Postanschrift." },
    ],
  },
  {
    slug: "umzug",
    preset: "umzug",
    audience: "Umzugsunternehmen",
    metaTitle: "KI für Umzugsunternehmen: Umzugsanfragen automatisch erfassen",
    metaDescription: "Privatumzug, Firmenumzug, Entrümpelung: Die KI beantwortet Anfragen für Umzugsunternehmen, fragt Termin, Etagen, Aufzug und Umfang ab und sammelt Fotos der Möbel.",
    headline: "Umzugsanfragen kalkulierbar machen.",
    intro: "Wann, von wo nach wo, welche Etage, mit oder ohne Aufzug, wie viele Möbel? Die KI fragt alles ab, was Sie für ein Angebot brauchen – Schäden und Reklamationen gehen direkt an Sie.",
    pains: [
      { title: "Angebote ohne Umfang", text: "Zimmerzahl allein sagt wenig. Etagen, Aufzug und große Möbel entscheiden über den Preis." },
      { title: "Kurzfristige Anfragen", text: "Wer am Wochenende umziehen will, sucht unter der Woche – und nimmt das erste Angebot." },
      { title: "Reklamationen", text: "Beschädigte Möbel brauchen eine schnelle, persönliche Antwort." },
    ],
    example: "Hallo, wir ziehen am 15. November von Neukölln nach Potsdam, 2-Zimmer-Wohnung im 3. OG ohne Aufzug.",
    result: "Fallakte mit Termin, Start- und Zieladresse, Etagen, Aufzug, Umfang und Fotos der Möbel.",
    faq: [
      { q: "Was passiert bei Schadensmeldungen?", a: "Reklamationen beantwortet die KI nicht selbst – sie werden Ihnen sofort gemeldet." },
      { q: "Kann ich eine Inventarliste anfordern?", a: "Ja. Legen Sie die Liste als Unterlage fest, die KI bittet den Kunden darum." },
      { q: "Schlägt die KI Termine vor?", a: "Sie kann Besichtigungstermine aus Ihren Zeiten vorschlagen; verbindlich wird es erst mit Ihrer Bestätigung." },
    ],
  },
  {
    slug: "kfz-werkstatt",
    preset: "werkstatt",
    audience: "Kfz-Werkstätten",
    metaTitle: "KI für Kfz-Werkstätten: Werkstattanfragen automatisch vorbereitet",
    metaDescription: "Inspektion, HU/AU, Bremsen, Reifen, Unfallreparatur: Die KI beantwortet Anfragen für Kfz-Werkstätten, fragt Fahrzeug, Kilometerstand und Fotos ab und schlägt Termine vor.",
    headline: "Fahrzeugdaten da, bevor der Kunde da ist.",
    intro: "Marke, Modell, Baujahr, Kilometerstand – die KI fragt alles ab, was Sie für Inspektion oder Reparatur brauchen, und schlägt einen Termin vor. Reklamationen gehen direkt an Sie.",
    pains: [
      { title: "„Was kostet die Inspektion?“", text: "Ohne Fahrzeug und Kilometerstand keine Antwort – und der Kunde fragt woanders." },
      { title: "Telefon während der Arbeit", text: "Jeder Anruf unterbricht die Arbeit am Fahrzeug." },
      { title: "Unfallschäden ohne Fotos", text: "Für eine erste Einschätzung fehlen fast immer die Bilder." },
    ],
    example: "Hallo, mein VW Golf 7, Baujahr 2016, 120.000 km, braucht die große Inspektion.",
    result: "Fallakte mit Fahrzeug, Kilometerstand, Kontakt und einem Terminvorschlag zur Freigabe.",
    faq: [
      { q: "Muss der Kunde seine Adresse angeben?", a: "Nein. Bei Werkstätten kommt der Kunde zu Ihnen – Sie legen fest, dass keine Adresse gefragt wird." },
      { q: "Was ist mit Reklamationen?", a: "Die beantwortet die KI nicht selbst, sondern meldet sie Ihnen sofort." },
      { q: "Kann ich Termine im Kalender bestätigen?", a: "Ja. Die KI schlägt Termine aus Ihren Arbeitszeiten vor, Sie bestätigen mit einem Klick." },
    ],
  },
  {
    slug: "friseur",
    preset: "friseur",
    audience: "Friseursalons",
    metaTitle: "KI für Friseure: Terminanfragen per WhatsApp und E-Mail automatisch",
    metaDescription: "Haarschnitt, Färben, Strähnen, Brautstyling: Die KI beantwortet Terminanfragen für Friseursalons per WhatsApp und E-Mail und schlägt passende Termine vor.",
    headline: "Terminanfragen, während Sie schneiden.",
    intro: "Kundinnen schreiben per WhatsApp, wann sie können und was sie möchten. Die KI fragt Haarlänge und Wunschtermin ab und schlägt einen freien Termin vor – Preisfragen und Sonderwünsche beantworten Sie selbst.",
    pains: [
      { title: "Hände voll, Handy klingelt", text: "Während des Schneidens können Sie keine Nachrichten beantworten." },
      { title: "Hin und her bei Terminen", text: "„Geht Samstag?“ – „Nein, aber Freitag?“ – jede Terminabsprache braucht fünf Nachrichten." },
      { title: "Brautstyling braucht Vorlauf", text: "Probetermin, Datum, Wünsche – das muss früh und vollständig geklärt sein." },
    ],
    example: "Hallo, ich hätte gern einen Termin für Schneiden und Strähnen, lange Haare, am liebsten Samstag.",
    result: "Anfrage mit Leistung, Haarlänge, Wunschtag und einem Terminvorschlag, den Sie nur noch bestätigen.",
    faq: [
      { q: "Muss ich dafür ein Buchungssystem wechseln?", a: "Nein. FallFlow ersetzt kein Kassensystem – es beantwortet Anfragen und schlägt Termine vor." },
      { q: "Beantwortet die KI Preisfragen?", a: "Nein, Preise nennen Sie selbst. Die KI markiert solche Fragen für Sie." },
      { q: "Funktioniert das mit meiner WhatsApp-Nummer?", a: "Ja, Sie verbinden Ihre WhatsApp-Business-Nummer – Kundinnen schreiben wie gewohnt." },
    ],
  },
  {
    slug: "kosmetikstudio",
    preset: "kosmetik",
    audience: "Kosmetikstudios",
    metaTitle: "KI für Kosmetikstudios: Terminanfragen automatisch beantworten",
    metaDescription: "Gesichtsbehandlung, Wimpern, Maniküre, Pediküre: Die KI beantwortet Anfragen für Kosmetikstudios per WhatsApp und E-Mail und schlägt freie Termine vor.",
    headline: "Mehr Behandlungen, weniger Nachrichten.",
    intro: "Die KI nimmt Terminwünsche per WhatsApp und E-Mail an, fragt ab, ob es der erste Besuch ist, und schlägt einen freien Termin vor. Fragen zu Allergien oder Hautproblemen gehen an Sie.",
    pains: [
      { title: "Nachrichten während der Behandlung", text: "Wer gerade Wimpern macht, kann nicht auf WhatsApp antworten." },
      { title: "Terminabsprachen dauern", text: "Jede Buchung braucht mehrere Nachrichten." },
      { title: "Sensible Fragen", text: "Allergien und Hautprobleme dürfen nicht von einer KI beantwortet werden." },
    ],
    example: "Hallo, ich hätte gern einen Termin für eine Wimpernverlängerung, nächste Woche nachmittags.",
    result: "Anfrage mit Behandlung, Wunschzeit und Terminvorschlag zur Bestätigung.",
    faq: [
      { q: "Was passiert bei Fragen zu Allergien?", a: "Solche Fragen beantwortet die KI nicht – sie meldet sie Ihnen, damit Sie persönlich antworten." },
      { q: "Kann die KI Preise nennen?", a: "Nein. Preisfragen beantworten Sie selbst." },
      { q: "Ist das datenschutzkonform?", a: "Die Daten liegen in einem Rechenzentrum in der EU; einen Auftragsverarbeitungsvertrag gibt es online." },
    ],
  },
  {
    slug: "tierarzt",
    preset: "tierarzt",
    audience: "Tierarztpraxen",
    metaTitle: "KI für Tierarztpraxen: Terminanfragen automatisch, Notfälle sofort",
    metaDescription: "Impfung, Vorsorge, Kastration, Zahnbehandlung: Die KI beantwortet Terminanfragen für Tierarztpraxen, fragt Tierart und Beschwerden ab und meldet Notfälle sofort.",
    headline: "Routine automatisch, Notfälle sofort.",
    intro: "Impfung, Vorsorge oder Kastration – die KI fragt Tierart, Alter und Wunschtermin ab. Klingt eine Nachricht nach einem Notfall, antwortet sie nicht selbst, sondern meldet sie sofort der Praxis.",
    pains: [
      { title: "Das Telefon steht nicht still", text: "Zwischen Behandlungen bleibt kaum Zeit für Terminanfragen." },
      { title: "Notfälle zwischen Routine", text: "Ein Tier, das nicht frisst und erbricht, braucht sofort Aufmerksamkeit." },
      { title: "Fehlende Angaben", text: "Tierart, Alter, Impfpass – vieles muss vor dem Termin geklärt werden." },
    ],
    example: "Guten Tag, unser Labrador, 3 Jahre, braucht die jährliche Impfung. Haben Sie nächste Woche einen Termin?",
    result: "Anfrage mit Tierart, Alter, Leistung und Terminvorschlag – den Impfpass bringt der Halter mit.",
    faq: [
      { q: "Gibt die KI medizinische Ratschläge?", a: "Nein. Medizinische Fragen und Notfälle werden nicht von der KI beantwortet, sondern sofort an die Praxis gemeldet." },
      { q: "Wie erkennt die KI Notfälle?", a: "Beschwerden wie Erbrechen, Fressverweigerung, Atemnot oder Verletzungen werden erkannt und als dringend markiert." },
      { q: "Kann ich festlegen, was gefragt wird?", a: "Ja, Sie bestimmen alle Fragen selbst – die Branchen-Vorlage gibt nur einen Vorschlag." },
    ],
  },
  {
    slug: "energieberater",
    preset: "energieberater",
    audience: "Energieberater",
    metaTitle: "KI für Energieberater: Anfragen zu Energieausweis & iSFP automatisch vorbereiten",
    metaDescription: "Energieausweis, Sanierungsfahrplan, Fördermittelberatung: Die KI beantwortet Anfragen für Energieberater, fragt Baujahr, Wohnfläche und Heizung ab und fordert Grundriss und Fotos an.",
    headline: "Weniger Nachfragen, mehr Beratung.",
    intro: "Ob Energieausweis, iSFP oder Fördermittelberatung – die KI antwortet mit Ihren Texten und Formularen, fragt Gebäudeart, Baujahr, Wohnfläche und Heizung ab und fordert Grundriss und Fotos an. Fragen zur Förderhöhe und zu Preisen beantworten Sie selbst.",
    pains: [
      { title: "Jede Anfrage braucht drei Rückfragen", text: "Baujahr, Wohnfläche, Heizung, Grundriss – bevor Sie ein Angebot machen können, fehlt fast immer etwas." },
      { title: "Formulare kommen unvollständig zurück", text: "Datenerfassungsbögen und Vollmachten müssen geprüft und nachgefordert werden." },
      { title: "Beratung statt Büro", text: "Ihre Zeit gehört in die Vor-Ort-Termine und Berechnungen, nicht ins Postfach." },
    ],
    example: "Guten Tag, wir möchten für unser Einfamilienhaus (Baujahr 1978, ca. 140 m², Gasheizung) einen Sanierungsfahrplan erstellen lassen.",
    result: "Anfrage mit Leistung, Gebäudedaten, Heizung, Adresse sowie Grundriss und Fotos – bereit für Ihr Angebot.",
    faq: [
      { q: "Beantwortet die KI Fragen zur Förderung?", a: "Nein. Fragen zur Höhe und zu den Voraussetzungen der Förderung beantworten Sie selbst – die KI markiert sie für Sie." },
      { q: "Kann ich meinen eigenen Datenerfassungsbogen verwenden?", a: "Ja. Sie hinterlegen Ihre PDF-Formulare je Leistung; FallFlow verschickt sie und liest ausgefüllte Formulare automatisch aus." },
      { q: "Ersetzt FallFlow meine Berechnungssoftware?", a: "Nein. FallFlow bereitet die Anfrage vor – Berechnung und Bericht machen Sie wie gewohnt in Ihrer Software." },
    ],
  },
  {
    slug: "photovoltaik",
    preset: "photovoltaik",
    audience: "Photovoltaik-Betriebe",
    metaTitle: "KI für Photovoltaik-Betriebe: PV-Anfragen automatisch vorqualifizieren",
    metaDescription: "PV-Anlage, Speicher, Wallbox: Die KI beantwortet Anfragen für Solarbetriebe, fragt Dach, Ausrichtung und Stromverbrauch ab und fordert Fotos vom Dach und Zählerschrank an.",
    headline: "Jede PV-Anfrage angebotsreif.",
    intro: "Die KI antwortet sofort, fragt Dachart, Ausrichtung und Stromverbrauch ab und fordert Fotos vom Dach, vom Zählerschrank und die Stromrechnung an. Fragen zu Preisen, Förderung und Rendite beantworten Sie selbst.",
    pains: [
      { title: "Viele Anfragen, wenig Angaben", text: "„Was kostet eine PV-Anlage?“ – ohne Dach, Verbrauch und Fotos ist kein Angebot möglich." },
      { title: "Wer zuerst antwortet, gewinnt", text: "Interessenten fragen bei mehreren Betrieben an – eine schnelle Antwort entscheidet." },
      { title: "Vor-Ort-Termine ohne Vorbereitung", text: "Ohne Fotos vom Zählerschrank fahren Sie für jede Kleinigkeit raus." },
    ],
    example: "Hallo, wir interessieren uns für eine PV-Anlage mit Speicher für unser Einfamilienhaus. Satteldach nach Süden, Verbrauch ca. 4.500 kWh im Jahr.",
    result: "Anfrage mit Leistung, Dach, Ausrichtung, Verbrauch, Adresse und Fotos vom Dach und Zählerschrank – angebotsreif.",
    faq: [
      { q: "Nennt die KI Preise oder Renditen?", a: "Nein. Preise, Förderung, Finanzierung und Wirtschaftlichkeit beantworten Sie selbst – die KI markiert solche Fragen." },
      { q: "Funktioniert das auch für Speicher und Wallbox?", a: "Ja. Je Leistung fragt die KI nur, was dafür nötig ist – beim Speicher z. B. die vorhandene Anlage und den Verbrauch." },
      { q: "Kann ich meinen eigenen Fragebogen nutzen?", a: "Ja. Sie hinterlegen eigene PDF-Formulare; ausgefüllte Formulare liest FallFlow automatisch aus." },
    ],
  },
  {
    slug: "fliesenleger",
    preset: "fliesen",
    audience: "Fliesen- und Bodenleger",
    metaTitle: "KI für Fliesen- und Bodenleger: Anfragen automatisch beantworten",
    metaDescription: "Fliesen, Bad, Parkett, Vinyl, Terrasse: Die KI beantwortet Anfragen für Fliesen- und Bodenleger, fragt Fläche, Raum und alten Belag ab und fordert Fotos an.",
    headline: "Aufmaß-Infos, bevor Sie losfahren.",
    intro: "Die KI antwortet sofort mit Ihren Texten, fragt Fläche, Raum und alten Belag ab und fordert Fotos an. So wissen Sie vor dem Termin, worum es geht. Preise und Materialberatung bleiben bei Ihnen.",
    pains: [
      { title: "Anfragen beim Verlegen", text: "Mit Kleber an den Händen beantwortet niemand E-Mails." },
      { title: "„Was kostet ein Bad?“", text: "Ohne Fläche, Raum und Fotos ist keine Einschätzung möglich." },
      { title: "Unnötige Besichtigungen", text: "Ohne Fotos fahren Sie raus, um zu sehen, dass der alte Belag erst raus muss." },
    ],
    example: "Hallo, wir möchten unser Bad neu fliesen lassen, ca. 8 m² Boden und die Wände bis zur Decke, alte Fliesen müssen raus.",
    result: "Anfrage mit Leistung, Fläche, altem Belag, Adresse und Fotos vom Raum – bereit für Ihre Einschätzung.",
    faq: [
      { q: "Berät die KI zu Material oder Fliesen?", a: "Nein. Materialberatung und Preise übernehmen Sie selbst – die KI markiert solche Fragen für Sie." },
      { q: "Kann ich Fliesen- und Bodenarbeiten getrennt abfragen?", a: "Ja. Je Leistung legen Sie fest, welche Angaben und Fotos die KI anfordert." },
      { q: "Brauche ich ein neues Programm?", a: "Nein. FallFlow arbeitet mit Ihrem E-Mail-Postfach und WhatsApp – Ihre Abläufe bleiben." },
    ],
  },
  {
    slug: "fotograf",
    preset: "fotograf",
    audience: "Fotografen",
    metaTitle: "KI für Fotografen: Shooting-Anfragen automatisch beantworten",
    metaDescription: "Hochzeit, Porträt, Familie, Business, Event: Die KI beantwortet Shooting-Anfragen für Fotografen, fragt Datum, Ort und Umfang ab und schlägt Termine vor.",
    headline: "Mehr Zeit hinter der Kamera.",
    intro: "Die KI beantwortet Anfragen per E-Mail und WhatsApp, fragt Datum, Ort und Umfang ab und schlägt bei Porträts und Business-Fotos einen Termin vor. Preise, Pakete und Nutzungsrechte besprechen Sie selbst.",
    pains: [
      { title: "Anfragen während der Bearbeitung", text: "Zwischen Shooting und Bildbearbeitung bleibt kaum Zeit fürs Postfach." },
      { title: "Hochzeitsanfragen ohne Datum", text: "Ohne Datum und Ort können Sie nicht sagen, ob Sie frei sind." },
      { title: "Langsam antworten heißt verlieren", text: "Brautpaare fragen bei mehreren Fotografen gleichzeitig an." },
    ],
    example: "Hallo, wir heiraten am 14. Juni in Heidelberg und suchen eine Fotografin für ca. 8 Stunden.",
    result: "Anfrage mit Leistung, Datum, Ort und Umfang – Sie prüfen nur noch, ob Sie frei sind, und schicken Ihr Angebot.",
    faq: [
      { q: "Nennt die KI meine Preise?", a: "Nein. Preise und Pakete nennen Sie selbst – die KI markiert solche Fragen für Sie." },
      { q: "Funktioniert das mit Instagram?", a: "FallFlow verarbeitet E-Mail, WhatsApp und den Chat auf Ihrer Website. Instagram-Nachrichten sind nicht angebunden." },
      { q: "Kann ich festlegen, was bei Hochzeiten gefragt wird?", a: "Ja. Je Leistung bestimmen Sie die Fragen – z. B. Datum, Ort, Dauer und Getting Ready." },
    ],
  },
];

export const industryPage = (slug: string) => INDUSTRY_PAGES.find((p) => p.slug === slug) ?? null;

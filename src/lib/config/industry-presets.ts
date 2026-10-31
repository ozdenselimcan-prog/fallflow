/**
 * Fertige Branchen-Vorlagen für die Einrichtung ("Ihr Betrieb"): Ein Klick füllt Leistungen, abzufragende Angaben,
 * Unterlagen und die Themen, bei denen der Betrieb selbst antwortet – ohne Wartezeit auf die KI. Alles bleibt danach
 * frei änderbar. Gleiche Form wie der KI-Vorschlag (siehe ai/business-profile.ts).
 */

export interface PresetField {
  key: string;
  label: string;
  prompt: string;
  required: boolean;
  /** Nur bei diesen Leistungen fragen; leer = bei allen. */
  services: string[];
}

export interface IndustryPreset {
  id: string;
  /** Anzeigename im Schnellstart */
  title: string;
  industry: string;
  description: string;
  services: string[];
  fields: PresetField[];
  documents: string[];
  documentsByService: Record<string, string[]>;
  humanTopics: string[];
  needsAddress: boolean;
}

const f = (key: string, label: string, prompt: string, required = false, services: string[] = []): PresetField => ({ key, label, prompt, required, services });

export const INDUSTRY_PRESETS: IndustryPreset[] = [
  {
    id: "dachdecker",
    title: "Dachdecker",
    industry: "Dachdeckerei",
    description: "Wir sind eine Dachdeckerei und übernehmen Reparaturen, Neueindeckungen, Dachfenster und Dachrinnen für Privatkunden und Hausverwaltungen.",
    services: ["Dachreparatur", "Sturmschaden", "Neueindeckung", "Dachfenster", "Dachrinne", "Flachdach"],
    fields: [
      f("roofType", "Art des Daches", "Um welche Art von Dach handelt es sich (z. B. Satteldach, Flachdach)?", true),
      f("roofArea", "Betroffene Fläche (m²)", "Wie groß ist die betroffene Fläche ungefähr in Quadratmetern?", false, ["Dachreparatur", "Sturmschaden", "Neueindeckung", "Flachdach"]),
      f("waterIngress", "Dringt Wasser ein?", "Dringt bereits Wasser ins Haus ein?", false, ["Dachreparatur", "Sturmschaden", "Flachdach"]),
      f("windowCount", "Anzahl Dachfenster", "Wie viele Dachfenster sollen eingebaut oder getauscht werden?", true, ["Dachfenster"]),
    ],
    documents: ["Fotos vom Schaden", "Fotos vom Dach"],
    documentsByService: { Dachreparatur: ["Fotos vom Schaden"], Sturmschaden: ["Fotos vom Schaden"], Neueindeckung: ["Fotos vom Dach"], Dachfenster: ["Fotos vom Dach"], Dachrinne: ["Fotos vom Schaden"], Flachdach: ["Fotos vom Dach"] },
    humanTopics: ["Preise und Kosten", "Notfälle mit Wassereintritt", "Reklamationen", "Versicherungsfragen"],
    needsAddress: true,
  },
  {
    id: "elektriker",
    title: "Elektriker",
    industry: "Elektroinstallation",
    description: "Wir sind ein Elektrofachbetrieb für Elektroinstallationen, Zählerschränke, Wallboxen, E-Check und Störungen bei Privat- und Gewerbekunden.",
    services: ["Elektroinstallation", "Zählerschrank", "Wallbox", "E-Check", "Störung / Reparatur", "Beleuchtung"],
    fields: [
      f("objectType", "Art des Gebäudes", "Um welches Gebäude geht es (z. B. Einfamilienhaus, Wohnung, Gewerbe)?", true),
      f("wallboxPower", "Gewünschte Ladeleistung", "Welche Ladeleistung soll die Wallbox haben (z. B. 11 kW)?", false, ["Wallbox"]),
      f("unitCount", "Anzahl Wohnungen/Einheiten", "Für wie viele Wohnungen oder Einheiten wird der E-Check gebraucht?", true, ["E-Check"]),
      f("problem", "Was funktioniert nicht?", "Was genau funktioniert nicht?", true, ["Störung / Reparatur"]),
    ],
    documents: ["Fotos vom Zählerschrank", "Fotos vom Installationsort"],
    documentsByService: { Zählerschrank: ["Fotos vom Zählerschrank"], Wallbox: ["Fotos vom Zählerschrank", "Fotos vom Installationsort"], "Störung / Reparatur": ["Fotos vom Installationsort"], Elektroinstallation: [], "E-Check": [], Beleuchtung: ["Fotos vom Installationsort"] },
    humanTopics: ["Preise und Kosten", "Notfälle (Stromausfall, Brandgeruch)", "Reklamationen", "Förderung und Anmeldung beim Netzbetreiber"],
    needsAddress: true,
  },
  {
    id: "maler",
    title: "Maler",
    industry: "Malerbetrieb",
    description: "Wir sind ein Malerbetrieb für Innenanstrich, Fassade, Tapezieren, Lackierarbeiten und Bodenbeläge.",
    services: ["Innenanstrich", "Fassadenanstrich", "Tapezieren", "Lackierarbeiten", "Bodenbeläge"],
    fields: [
      f("area", "Fläche (m²)", "Wie groß ist die Fläche ungefähr in Quadratmetern?", true),
      f("rooms", "Räume", "Um welche Räume geht es?", false, ["Innenanstrich", "Tapezieren", "Bodenbeläge"]),
      f("storeys", "Geschosse", "Wie viele Geschosse hat das Gebäude?", false, ["Fassadenanstrich"]),
      f("surfaceCondition", "Zustand der Wände", "Wie ist der Zustand der Wände (z. B. Risse, alte Tapete, Schimmel)?", false, ["Innenanstrich", "Tapezieren", "Fassadenanstrich"]),
    ],
    documents: ["Fotos der Räume bzw. Fassade"],
    documentsByService: {},
    humanTopics: ["Preise und Kosten", "Reklamationen", "Sonderwünsche"],
    needsAddress: true,
  },
  {
    id: "shk",
    title: "Heizung & Sanitär",
    industry: "Sanitär und Heizung",
    description: "Wir sind ein SHK-Fachbetrieb für Heizungswartung, Heizungstausch, Wärmepumpen, Badsanierung und Rohrreinigung.",
    services: ["Heizungswartung", "Heizungstausch", "Wärmepumpe", "Badsanierung", "Rohrreinigung", "Reparatur"],
    fields: [
      f("heatingType", "Heizungsart", "Welche Heizung haben Sie aktuell (z. B. Gas, Öl, Wärmepumpe)?", true, ["Heizungswartung", "Heizungstausch", "Wärmepumpe"]),
      f("heatingAge", "Alter der Heizung", "Wie alt ist die Heizung ungefähr?", false, ["Heizungswartung", "Heizungstausch", "Wärmepumpe"]),
      f("bathSize", "Badgröße (m²)", "Wie groß ist das Bad ungefähr?", true, ["Badsanierung"]),
      f("problem", "Was ist defekt?", "Was genau ist defekt oder verstopft?", true, ["Rohrreinigung", "Reparatur"]),
    ],
    documents: ["Fotos der Heizung mit Typenschild", "Fotos vom Bad", "Grundriss des Bades"],
    documentsByService: {
      Heizungswartung: ["Fotos der Heizung mit Typenschild"],
      Heizungstausch: ["Fotos der Heizung mit Typenschild"],
      Wärmepumpe: ["Fotos der Heizung mit Typenschild"],
      Badsanierung: ["Fotos vom Bad", "Grundriss des Bades"],
      Rohrreinigung: [],
      Reparatur: [],
    },
    humanTopics: ["Preise und Kosten", "Notfälle (Heizungsausfall, Rohrbruch)", "Reklamationen", "Förderung"],
    needsAddress: true,
  },
  {
    id: "tischler",
    title: "Tischler / Schreiner",
    industry: "Tischlerei",
    description: "Wir sind eine Tischlerei für Möbel nach Maß, Einbauschränke, Küchen, Innentüren, Treppen und Reparaturen.",
    services: ["Möbel nach Maß", "Einbauschrank", "Küche", "Innentüren", "Treppe", "Reparatur"],
    fields: [
      f("dimensions", "Maße", "Welche Maße hat die Fläche bzw. der Platz ungefähr (Breite × Höhe × Tiefe)?", true, ["Möbel nach Maß", "Einbauschrank", "Küche"]),
      f("material", "Material / Oberfläche", "Haben Sie Wünsche zu Material oder Oberfläche?"),
      f("doorCount", "Anzahl Türen", "Wie viele Türen sollen es sein?", true, ["Innentüren"]),
    ],
    documents: ["Fotos der Einbausituation", "Skizze mit Maßen"],
    documentsByService: { Reparatur: ["Fotos der Einbausituation"] },
    humanTopics: ["Preise und Kosten", "Reklamationen", "Sonderwünsche"],
    needsAddress: true,
  },
  {
    id: "garten",
    title: "Garten- & Landschaftsbau",
    industry: "Garten- und Landschaftsbau",
    description: "Wir sind ein Garten- und Landschaftsbaubetrieb für Gartenpflege, Heckenschnitt, Baumfällung, Pflasterarbeiten und Gartenneuanlage.",
    services: ["Gartenpflege", "Heckenschnitt", "Baumfällung", "Pflasterarbeiten", "Rollrasen", "Gartenneuanlage"],
    fields: [
      f("area", "Fläche bzw. Länge", "Wie groß ist die Fläche bzw. wie lang ist die Hecke ungefähr?", true, ["Gartenpflege", "Heckenschnitt", "Pflasterarbeiten", "Rollrasen", "Gartenneuanlage"]),
      f("treeHeight", "Baumhöhe", "Wie hoch ist der Baum ungefähr und wie viele Bäume sind es?", true, ["Baumfällung"]),
      f("access", "Zufahrt", "Ist der Garten mit Fahrzeug bzw. Maschinen erreichbar?"),
    ],
    documents: ["Fotos vom Garten"],
    documentsByService: {},
    humanTopics: ["Preise und Kosten", "Gefahr (umsturzgefährdete Bäume)", "Genehmigungen (Baumfällung)", "Reklamationen"],
    needsAddress: true,
  },
  {
    id: "reinigung",
    title: "Reinigungsfirma",
    industry: "Gebäudereinigung",
    description: "Wir sind eine Reinigungsfirma für Büroreinigung, Treppenhausreinigung, Fensterreinigung, Grundreinigung und Endreinigung nach Umzug.",
    services: ["Büroreinigung", "Treppenhausreinigung", "Fensterreinigung", "Grundreinigung", "Endreinigung nach Umzug", "Bauendreinigung"],
    fields: [
      f("area", "Fläche (m²)", "Wie groß ist die zu reinigende Fläche ungefähr?", true, ["Büroreinigung", "Grundreinigung", "Endreinigung nach Umzug", "Bauendreinigung"]),
      f("frequency", "Wie oft?", "Wie oft soll gereinigt werden (z. B. einmalig, wöchentlich)?", true, ["Büroreinigung", "Treppenhausreinigung", "Fensterreinigung"]),
      f("windowCount", "Anzahl Fenster", "Wie viele Fenster sind es ungefähr?", true, ["Fensterreinigung"]),
      f("desiredDate", "Wunschtermin", "Wann soll gereinigt werden?", false, ["Endreinigung nach Umzug", "Bauendreinigung", "Grundreinigung"]),
    ],
    documents: ["Fotos der Räume"],
    documentsByService: {},
    humanTopics: ["Preise und Kosten", "Reklamationen", "Vertragsfragen"],
    needsAddress: true,
  },
  {
    id: "hausverwaltung",
    title: "Hausverwaltung",
    industry: "Hausverwaltung",
    description: "Wir sind eine Hausverwaltung für Mietshäuser und Eigentümergemeinschaften und nehmen Schadensmeldungen, Anfragen zur Nebenkostenabrechnung und Mietinteressenten entgegen.",
    services: ["Schadensmeldung", "Nebenkostenabrechnung", "Mietinteresse", "Verwaltungsanfrage"],
    fields: [
      f("property", "Objekt / Wohnung", "Um welches Objekt und welche Wohnung geht es (Adresse, Etage, Lage)?", true, ["Schadensmeldung", "Nebenkostenabrechnung"]),
      f("damage", "Was ist kaputt?", "Was genau ist beschädigt oder defekt?", true, ["Schadensmeldung"]),
      f("unitCount", "Anzahl Einheiten", "Wie viele Wohneinheiten hat das Objekt?", true, ["Verwaltungsanfrage"]),
      f("moveInDate", "Gewünschter Einzug", "Ab wann suchen Sie eine Wohnung?", false, ["Mietinteresse"]),
    ],
    documents: ["Fotos vom Schaden"],
    documentsByService: { Schadensmeldung: ["Fotos vom Schaden"], Nebenkostenabrechnung: [], Mietinteresse: [], Verwaltungsanfrage: [] },
    humanTopics: ["Notfälle (Wasser, Strom, Heizung)", "Fragen zur Nebenkostenabrechnung", "Rechtliche Fragen", "Mietminderung und Beschwerden"],
    needsAddress: false,
  },
  {
    id: "umzug",
    title: "Umzugsunternehmen",
    industry: "Umzugsunternehmen",
    description: "Wir sind ein Umzugsunternehmen für Privat- und Firmenumzüge, Möbelmontage, Halteverbotszonen, Entrümpelung und Einlagerung.",
    services: ["Privatumzug", "Firmenumzug", "Möbelmontage", "Entrümpelung", "Einlagerung"],
    fields: [
      f("moveDate", "Umzugstermin", "Wann soll der Umzug stattfinden?", true, ["Privatumzug", "Firmenumzug"]),
      f("fromTo", "Von – nach", "Von wo nach wo geht der Umzug (Ort und Etage, mit oder ohne Aufzug)?", true, ["Privatumzug", "Firmenumzug"]),
      f("volume", "Umfang", "Wie groß ist die Wohnung bzw. wie viele Zimmer und Möbel sind es ungefähr?", true, ["Privatumzug", "Firmenumzug", "Entrümpelung", "Einlagerung"]),
    ],
    documents: ["Fotos der Möbel", "Inventarliste"],
    documentsByService: {},
    humanTopics: ["Preise und Kosten", "Schäden und Reklamationen", "Versicherung"],
    needsAddress: false,
  },
  {
    id: "werkstatt",
    title: "Kfz-Werkstatt",
    industry: "Kfz-Werkstatt",
    description: "Wir sind eine freie Kfz-Werkstatt für Inspektion, HU/AU, Bremsen, Reifen, Klimaservice und Unfallreparatur aller Marken.",
    services: ["Inspektion", "HU/AU", "Bremsen", "Reifenwechsel", "Klimaservice", "Unfallreparatur"],
    fields: [
      f("vehicle", "Fahrzeug", "Um welches Fahrzeug geht es (Marke, Modell, Baujahr)?", true),
      f("mileage", "Kilometerstand", "Wie ist der aktuelle Kilometerstand ungefähr?", false, ["Inspektion"]),
      f("tires", "Reifen", "Haben Sie die Reifen schon oder brauchen Sie neue?", false, ["Reifenwechsel"]),
    ],
    documents: ["Fahrzeugschein", "Fotos vom Schaden"],
    documentsByService: { Unfallreparatur: ["Fahrzeugschein", "Fotos vom Schaden"], Inspektion: [], "HU/AU": [], Bremsen: [], Reifenwechsel: [], Klimaservice: [] },
    humanTopics: ["Preise und Kosten", "Reklamationen", "Versicherungsfragen"],
    needsAddress: false,
  },
  {
    id: "friseur",
    title: "Friseur",
    industry: "Friseursalon",
    description: "Wir sind ein Friseursalon für Damen, Herren und Kinder: Haarschnitt, Färben, Strähnen, Hochsteckfrisuren und Brautstyling.",
    services: ["Haarschnitt", "Färben", "Strähnen", "Hochsteckfrisur", "Brautstyling"],
    fields: [
      f("hairLength", "Haarlänge", "Wie lang sind Ihre Haare ungefähr (kurz, mittel, lang)?"),
      f("desiredDate", "Wunschtermin", "Wann hätten Sie gern einen Termin?", true),
    ],
    documents: [],
    documentsByService: {},
    humanTopics: ["Preise und Kosten", "Reklamationen", "Allergien und Unverträglichkeiten"],
    needsAddress: false,
  },
  {
    id: "kosmetik",
    title: "Kosmetikstudio",
    industry: "Kosmetikstudio",
    description: "Wir sind ein Kosmetikstudio für Gesichtsbehandlungen, Wimpern, Augenbrauen, Maniküre, Pediküre und Haarentfernung.",
    services: ["Gesichtsbehandlung", "Wimpern", "Augenbrauen", "Maniküre", "Pediküre", "Haarentfernung"],
    fields: [f("desiredDate", "Wunschtermin", "Wann hätten Sie gern einen Termin?", true), f("firstVisit", "Erster Besuch?", "Waren Sie schon einmal bei uns?")],
    documents: [],
    documentsByService: {},
    humanTopics: ["Preise und Kosten", "Allergien und Hautprobleme", "Reklamationen"],
    needsAddress: false,
  },
  {
    id: "tierarzt",
    title: "Tierarztpraxis",
    industry: "Tierarztpraxis",
    description: "Wir sind eine Kleintierpraxis für Impfungen, Vorsorge, Kastration, Zahnbehandlung und Operationen bei Hunden und Katzen.",
    services: ["Impfung", "Vorsorge", "Kastration", "Zahnbehandlung", "Krankheit / Beschwerden"],
    fields: [
      f("animal", "Tier", "Um welches Tier geht es (Tierart, Rasse, Alter)?", true),
      f("symptoms", "Beschwerden", "Welche Beschwerden hat Ihr Tier und seit wann?", true, ["Krankheit / Beschwerden"]),
      f("desiredDate", "Wunschtermin", "Wann hätten Sie gern einen Termin?"),
    ],
    documents: ["Impfpass"],
    documentsByService: { Impfung: ["Impfpass"] },
    humanTopics: ["Notfälle", "Medizinische Fragen", "Preise und Kosten"],
    needsAddress: false,
  },
  {
    id: "energieberater",
    title: "Energieberater",
    industry: "Energieberatung",
    description: "Wir sind ein Energieberatungsbüro für Energieausweise, individuelle Sanierungsfahrpläne (iSFP), Fördermittelberatung, Heizlastberechnung und energetische Baubegleitung für Wohngebäude.",
    services: ["Energieausweis", "Sanierungsfahrplan (iSFP)", "Fördermittelberatung", "Heizlastberechnung", "Baubegleitung"],
    fields: [
      f("houseType", "Gebäudeart", "Um welche Art Gebäude geht es (z. B. Einfamilienhaus, Mehrfamilienhaus)?", true),
      f("constructionYear", "Baujahr", "Aus welchem Jahr stammt das Gebäude ungefähr?", true),
      f("floorSpace", "Wohnfläche (m²)", "Wie groß ist die Wohnfläche ungefähr in Quadratmetern?", true),
      f("heatingSystem", "Heizung", "Mit was wird aktuell geheizt (z. B. Gas, Öl, Wärmepumpe)?", false, ["Sanierungsfahrplan (iSFP)", "Fördermittelberatung", "Heizlastberechnung", "Energieausweis"]),
      f("plannedMeasure", "Geplante Maßnahme", "Welche Sanierung planen Sie (z. B. neue Heizung, Dämmung, Fenster)?", false, ["Fördermittelberatung", "Baubegleitung"]),
    ],
    documents: ["Grundriss", "Fotos vom Gebäude", "Alter Energieausweis", "Heizkostenabrechnung"],
    documentsByService: {
      Energieausweis: ["Grundriss", "Fotos vom Gebäude"],
      "Sanierungsfahrplan (iSFP)": ["Grundriss", "Fotos vom Gebäude", "Heizkostenabrechnung"],
      Fördermittelberatung: ["Fotos vom Gebäude"],
      Heizlastberechnung: ["Grundriss"],
      Baubegleitung: ["Grundriss"],
    },
    humanTopics: ["Preise und Kosten", "Höhe und Voraussetzungen der Förderung", "Rechtliche Pflichten (GEG)", "Reklamationen"],
    needsAddress: true,
  },
  {
    id: "photovoltaik",
    title: "Photovoltaik / Solar",
    industry: "Photovoltaik-Fachbetrieb",
    description: "Wir planen und installieren Photovoltaikanlagen, Batteriespeicher und Wallboxen für Einfamilienhäuser und Gewerbe und übernehmen Erweiterung, Wartung und Reparatur.",
    services: ["PV-Anlage", "Batteriespeicher", "Wallbox", "PV-Erweiterung", "Wartung / Reparatur"],
    fields: [
      f("roofType", "Art des Daches", "Um welche Art von Dach handelt es sich (z. B. Satteldach, Flachdach)?", true, ["PV-Anlage", "PV-Erweiterung"]),
      f("roofOrientation", "Dachausrichtung", "In welche Himmelsrichtung zeigt die Dachfläche ungefähr?", false, ["PV-Anlage", "PV-Erweiterung"]),
      f("powerConsumption", "Stromverbrauch (kWh/Jahr)", "Wie hoch ist Ihr Stromverbrauch pro Jahr ungefähr (steht auf der Stromrechnung)?", true, ["PV-Anlage", "Batteriespeicher"]),
      f("existingPv", "Vorhandene Anlage", "Haben Sie schon eine PV-Anlage – wenn ja, wie groß (kWp) und seit wann?", true, ["Batteriespeicher", "PV-Erweiterung", "Wartung / Reparatur"]),
      f("problem", "Was ist das Problem?", "Was genau funktioniert an der Anlage nicht?", true, ["Wartung / Reparatur"]),
    ],
    documents: ["Fotos vom Dach", "Foto vom Zählerschrank", "Stromrechnung"],
    documentsByService: {
      "PV-Anlage": ["Fotos vom Dach", "Foto vom Zählerschrank", "Stromrechnung"],
      Batteriespeicher: ["Foto vom Zählerschrank", "Stromrechnung"],
      Wallbox: ["Foto vom Zählerschrank"],
      "PV-Erweiterung": ["Fotos vom Dach", "Foto vom Zählerschrank"],
      "Wartung / Reparatur": ["Foto vom Zählerschrank"],
    },
    humanTopics: ["Preise und Kosten", "Förderung und Finanzierung", "Wirtschaftlichkeit und Rendite", "Reklamationen"],
    needsAddress: true,
  },
  {
    id: "fliesen",
    title: "Fliesen- & Bodenleger",
    industry: "Fliesen- und Bodenlegerbetrieb",
    description: "Wir sind ein Fliesen- und Bodenlegerbetrieb: Fliesen in Bad, Küche und Wohnraum, Parkett, Vinyl und Laminat, Terrassen und Balkone sowie Reparaturen.",
    services: ["Fliesen verlegen", "Bad fliesen", "Parkett", "Vinyl / Laminat", "Terrasse / Balkon", "Reparatur"],
    fields: [
      f("area", "Fläche (m²)", "Wie groß ist die Fläche ungefähr in Quadratmetern?", true, ["Fliesen verlegen", "Bad fliesen", "Parkett", "Vinyl / Laminat", "Terrasse / Balkon"]),
      f("room", "Raum", "Um welchen Raum bzw. welche Räume geht es?", false, ["Fliesen verlegen", "Parkett", "Vinyl / Laminat"]),
      f("oldCovering", "Alter Belag", "Muss ein alter Belag entfernt werden – wenn ja, welcher?", false, ["Fliesen verlegen", "Bad fliesen", "Parkett", "Vinyl / Laminat", "Terrasse / Balkon"]),
      f("damage", "Schaden", "Was genau ist beschädigt (z. B. gesprungene Fliesen, lose Dielen)?", true, ["Reparatur"]),
    ],
    documents: ["Fotos vom Raum", "Grundriss oder Skizze"],
    documentsByService: {
      "Fliesen verlegen": ["Fotos vom Raum", "Grundriss oder Skizze"],
      "Bad fliesen": ["Fotos vom Raum", "Grundriss oder Skizze"],
      Parkett: ["Fotos vom Raum"],
      "Vinyl / Laminat": ["Fotos vom Raum"],
      "Terrasse / Balkon": ["Fotos vom Raum"],
      Reparatur: ["Fotos vom Raum"],
    },
    humanTopics: ["Preise und Kosten", "Materialberatung", "Reklamationen"],
    needsAddress: true,
  },
  {
    id: "fotograf",
    title: "Fotograf",
    industry: "Fotografie",
    description: "Wir sind ein Fotostudio für Hochzeiten, Porträts, Familien- und Babyfotos, Business- und Bewerbungsfotos, Events und Produktfotos.",
    services: ["Hochzeit", "Porträt", "Familie & Baby", "Business / Bewerbung", "Event", "Produktfotos"],
    fields: [
      f("eventDate", "Datum", "An welchem Datum findet es statt?", true, ["Hochzeit", "Event"]),
      f("location", "Ort", "Wo findet das Shooting bzw. die Feier statt?", true, ["Hochzeit", "Event"]),
      f("coverage", "Dauer / Umfang", "Wie viele Stunden soll fotografiert werden?", false, ["Hochzeit", "Event"]),
      f("people", "Anzahl Personen", "Wie viele Personen sollen fotografiert werden?", false, ["Porträt", "Familie & Baby", "Business / Bewerbung"]),
      f("productCount", "Anzahl Produkte", "Wie viele Produkte sollen fotografiert werden?", true, ["Produktfotos"]),
      f("desiredDate", "Wunschtermin", "Wann hätten Sie gern einen Termin?", false, ["Porträt", "Familie & Baby", "Business / Bewerbung", "Produktfotos"]),
    ],
    documents: ["Beispielbilder / Moodboard"],
    documentsByService: { Hochzeit: ["Beispielbilder / Moodboard"], Produktfotos: ["Beispielbilder / Moodboard"] },
    humanTopics: ["Preise und Pakete", "Nutzungsrechte", "Reklamationen"],
    needsAddress: false,
  },
];

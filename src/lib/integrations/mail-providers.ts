/**
 * Übliche E-Mail-Anbieter: Server-Daten und kurze Anleitung, was beim Verbinden zu beachten ist. Erkannt wird der Anbieter
 * an der E-Mail-Adresse (Freemail) bzw. bei eigener Domain am MX-Eintrag (siehe api/integrations/detect).
 */
export interface MailProvider {
  id: string;
  label: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  /** Freemail-Domains dieses Anbieters */
  domains: string[];
  /** Muster für MX-Einträge eigener Domains, die bei diesem Anbieter liegen */
  mx: RegExp[];
  /** Was der Kunde tun muss – kurze Schritte */
  steps: string[];
  /** Direktlink zur wichtigsten Einstellung (z. B. App-Passwort) */
  link?: { label: string; url: string };
  /** Hinweis, wenn die Anmeldung scheitert */
  authHint: string;
  /** Outlook/Microsoft: statt Passwort die Microsoft-Anmeldung nutzen */
  microsoft?: boolean;
}

export const MAIL_PROVIDERS: MailProvider[] = [
  {
    id: "gmail",
    label: "Gmail / Google Workspace",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    domains: ["gmail.com", "googlemail.com"],
    mx: [/google\.com\.?$/i, /googlemail\.com\.?$/i],
    steps: [
      "Im Google-Konto die 2-Schritt-Verifizierung einschalten (falls noch nicht geschehen).",
      "Ein App-Passwort erstellen (Name z. B. „FallFlow“) – Google zeigt 16 Buchstaben an.",
      "Diese 16 Buchstaben unten als Passwort eintragen (nicht Ihr normales Google-Passwort).",
    ],
    link: { label: "App-Passwort bei Google erstellen", url: "https://myaccount.google.com/apppasswords" },
    authHint: "Google nimmt nur ein App-Passwort an, nicht Ihr normales Passwort. Meldet Google „App-Passwörter nicht verfügbar“, zuerst die 2-Schritt-Verifizierung einschalten.",
  },
  {
    id: "microsoft",
    label: "Outlook / Hotmail / Microsoft 365",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    domains: ["outlook.com", "outlook.de", "hotmail.com", "hotmail.de", "live.com", "live.de", "msn.com"],
    mx: [/mail\.protection\.outlook\.com\.?$/i],
    steps: ["Oben auf „Mit Microsoft anmelden“ klicken und mit Ihrer E-Mail-Adresse und Ihrem Passwort anmelden – Server-Daten sind nicht nötig."],
    authHint: "Microsoft erlaubt keine Anmeldung per Passwort mehr. Bitte oben „Mit Microsoft anmelden“ nutzen.",
    microsoft: true,
  },
  {
    id: "gmx",
    label: "GMX",
    imapHost: "imap.gmx.net",
    imapPort: 993,
    smtpHost: "mail.gmx.net",
    smtpPort: 465,
    domains: ["gmx.de", "gmx.net", "gmx.at", "gmx.ch"],
    mx: [/gmx\.net\.?$/i],
    steps: [
      "Bei GMX im Browser anmelden → E-Mail → Einstellungen → „POP3 & IMAP“ → „POP3 und IMAP Zugriff erlauben“ anhaken und speichern.",
      "Unten Ihr normales GMX-Passwort eintragen (bei aktivierter 2-Faktor-Anmeldung ein „Anwendungsspezifisches Passwort“).",
    ],
    link: { label: "GMX öffnen", url: "https://www.gmx.net/" },
    authHint: "Bei GMX muss der IMAP-Zugriff erst erlaubt werden: E-Mail → Einstellungen → „POP3 & IMAP“ → Zugriff erlauben. Danach erneut verbinden.",
  },
  {
    id: "webde",
    label: "Web.de",
    imapHost: "imap.web.de",
    imapPort: 993,
    smtpHost: "smtp.web.de",
    smtpPort: 465,
    domains: ["web.de"],
    mx: [/web\.de\.?$/i],
    steps: [
      "Bei Web.de im Browser anmelden → E-Mail → Einstellungen → „POP3/IMAP Abruf“ → „Zugriff per POP3 und IMAP erlauben“ anhaken und speichern.",
      "Unten Ihr normales Web.de-Passwort eintragen (bei aktivierter 2-Faktor-Anmeldung ein „Anwendungsspezifisches Passwort“).",
    ],
    link: { label: "Web.de öffnen", url: "https://web.de/" },
    authHint: "Bei Web.de muss der IMAP-Zugriff erst erlaubt werden: E-Mail → Einstellungen → „POP3/IMAP Abruf“ → Zugriff erlauben. Danach erneut verbinden.",
  },
  {
    id: "tonline",
    label: "T-Online",
    imapHost: "secureimap.t-online.de",
    imapPort: 993,
    smtpHost: "securesmtp.t-online.de",
    smtpPort: 465,
    domains: ["t-online.de", "magenta.de"],
    mx: [/t-online\.de\.?$/i],
    steps: [
      "Die Telekom verlangt für E-Mail-Programme ein eigenes „E-Mail-Passwort“: im E-Mail Center unter Einstellungen → Passwörter → E-Mail-Passwort anlegen.",
      "Unten dieses E-Mail-Passwort eintragen (nicht das Passwort Ihres Telekom-Logins).",
    ],
    link: { label: "Telekom E-Mail Center öffnen", url: "https://email.t-online.de/" },
    authHint: "Die Telekom nimmt nur das gesonderte „E-Mail-Passwort“ an (E-Mail Center → Einstellungen → Passwörter), nicht das Login-Passwort.",
  },
  {
    id: "ionos",
    label: "IONOS (1&1)",
    imapHost: "imap.ionos.de",
    imapPort: 993,
    smtpHost: "smtp.ionos.de",
    smtpPort: 465,
    domains: ["online.de", "onlinehome.de"],
    mx: [/ionos\.(de|com)\.?$/i, /kundenserver\.de\.?$/i, /1and1\./i],
    steps: ["Unten das Passwort genau dieses E-Mail-Postfachs eintragen (nicht das Passwort Ihres IONOS-Kundenkontos)."],
    authHint: "Bitte das Passwort des Postfachs verwenden (im IONOS-Kundenbereich unter E-Mail → Postfach → Passwort ändern lässt es sich neu setzen).",
  },
  {
    id: "strato",
    label: "Strato",
    imapHost: "imap.strato.de",
    imapPort: 993,
    smtpHost: "smtp.strato.de",
    smtpPort: 465,
    domains: [],
    mx: [/rzone\.de\.?$/i, /strato\.de\.?$/i],
    steps: ["Unten das Passwort genau dieses E-Mail-Postfachs eintragen (nicht das Passwort Ihres Strato-Kundenlogins)."],
    authHint: "Bitte das Passwort des Postfachs verwenden (im Strato-Kundenlogin unter E-Mail → Verwaltung lässt es sich neu setzen).",
  },
  {
    id: "yahoo",
    label: "Yahoo",
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    domains: ["yahoo.com", "yahoo.de", "ymail.com"],
    mx: [/yahoodns\.net\.?$/i],
    steps: ["In den Yahoo-Kontoeinstellungen unter „Sicherheit“ ein App-Passwort erstellen.", "Unten dieses App-Passwort eintragen."],
    link: { label: "Yahoo-Sicherheitseinstellungen", url: "https://login.yahoo.com/account/security" },
    authHint: "Yahoo nimmt nur ein App-Passwort an (Kontoeinstellungen → Sicherheit → App-Passwort erstellen).",
  },
  {
    id: "posteo",
    label: "Posteo",
    imapHost: "posteo.de",
    imapPort: 993,
    smtpHost: "posteo.de",
    smtpPort: 465,
    domains: ["posteo.de", "posteo.net"],
    mx: [/posteo\.de\.?$/i],
    steps: ["Unten Ihr normales Posteo-Passwort eintragen."],
    authHint: "Bitte E-Mail-Adresse und Posteo-Passwort prüfen.",
  },
  {
    id: "mailboxorg",
    label: "mailbox.org",
    imapHost: "imap.mailbox.org",
    imapPort: 993,
    smtpHost: "smtp.mailbox.org",
    smtpPort: 465,
    domains: ["mailbox.org"],
    mx: [/mailbox\.org\.?$/i],
    steps: ["Unten Ihr normales mailbox.org-Passwort eintragen."],
    authHint: "Bitte E-Mail-Adresse und Passwort prüfen.",
  },
];

export const mailProvider = (id: string) => MAIL_PROVIDERS.find((p) => p.id === id) ?? null;

/** Anbieter an der Domain der E-Mail-Adresse (Freemail) erkennen. */
export function providerForEmail(email: string): MailProvider | null {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return MAIL_PROVIDERS.find((p) => p.domains.includes(domain)) ?? null;
}

/** Anbieter einer eigenen Domain an den MX-Einträgen erkennen. */
export function providerForMx(hosts: string[]): MailProvider | null {
  return MAIL_PROVIDERS.find((p) => hosts.some((h) => p.mx.some((re) => re.test(h)))) ?? null;
}

/** Anbieter zu einem IMAP-Server (für Fehlermeldungen). */
export const providerForImap = (host: string) => MAIL_PROVIDERS.find((p) => p.imapHost === host.trim().toLowerCase()) ?? null;

/** Verständliche Fehlermeldung beim Verbinden (IMAP/SMTP). */
export function friendlyConnectError(reason: string, imapHost: string): string {
  const p = providerForImap(imapHost);
  if (/auth|credential|login|password|passwort|535|invalid|LOGIN failed|AUTHENTICATE/i.test(reason)) {
    return `Die Anmeldung wurde abgelehnt – E-Mail-Adresse oder Passwort stimmen nicht. ${p?.authHint ?? "Bitte E-Mail-Adresse und Passwort prüfen."}`;
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(reason)) return "Der Mail-Server wurde nicht gefunden. Bitte die Server-Adressen (IMAP/SMTP) prüfen.";
  if (/ETIMEDOUT|timeout|ECONNREFUSED|ECONNRESET/i.test(reason)) return "Der Mail-Server antwortet nicht. Bitte Server-Adressen und Ports prüfen (üblich: IMAP 993, SMTP 465).";
  return `Verbindung fehlgeschlagen: ${reason}. Bitte Zugangsdaten und Server-Einstellungen prüfen.`;
}

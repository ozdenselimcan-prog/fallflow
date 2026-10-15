/**
 * Kleine, regelbasierte Erkennungen für E-Mail-Anfragen (ohne KI, deshalb zuverlässig und testbar).
 */

/** Gängige andere Bezeichnungen für Leistungen von Energieberatern – damit "Sanierungsfahrplan" auch "iSFP" trifft. */
const SERVICE_SYNONYMS: [RegExp, RegExp][] = [
  [/isfp|sanierungsfahrplan/i, /\bisfp\b|sanierungsfahrplan/i],
  [/energieausweis/i, /energieausweis|energiepass|verbrauchsausweis|bedarfsausweis/i],
  [/förder|foerder/i, /förder(mittel)?beratung|fördermittel|förderantrag|foerder/i],
  [/heizlast/i, /heizlast/i],
  [/hydraulisch/i, /hydraulisch/i],
  [/baubegleitung/i, /baubegleitung/i],
  [/blower|luftdicht/i, /blower|luftdicht/i],
  [/thermograf|thermograph/i, /thermograf|thermograph/i],
];

/** Text ohne verneinte Erwähnungen ("keinen iSFP", "nicht den Energieausweis"). */
const withoutNegations = (text: string) => text.replace(/\b(kein(en|e|er)?|nicht( den| die| das| einen| eine)?)\s+(\S+\s+){0,2}?\S+/gi, " ");

/** "Einen alten Energieausweis haben wir schon" / "anbei unser Energieausweis" meint das Dokument, nicht die Leistung. */
const CERTIFICATE_AS_DOCUMENT = /(alte[nrs]?|vorhandene[nrs]?|bestehende[nrs]?|bisherige[nrs]?|unsere[nrs]?)\s+energieausweis|energieausweis\s+(habe|haben|hätte|liegt|ist (schon )?vorhanden|von \d{4}|aus \d{4})|(anbei|beigefügt|im anhang)[^.!?]{0,40}energieausweis/gi;

/** Welche der angebotenen Leistungen nennt der Kunde (nicht verneint)? */
export function mentionedServices(text: string, services: string[]): string[] {
  const t = withoutNegations(text).replace(CERTIFICATE_AS_DOCUMENT, " ");
  return services.filter((s) => {
    if (s === "Sonstiges") return false;
    const syn = SERVICE_SYNONYMS.find(([forService]) => forService.test(s));
    if (syn) return syn[1].test(t);
    return new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(t);
  });
}

/** Kunde schickt das Formular nicht per E-Mail (Post, kein Drucker …) – das muss das Büro selbst klären. */
export function formNotByEmail(text: string): boolean {
  return /\b(per|mit der|auf dem) post(weg)?\b|postalisch|per brief|kein(en)? drucker|nicht (aus)?drucken|kann (das|es|den bogen|das formular) nicht (aus)?drucken|vorbei ?bringen|persönlich (vorbei|abgeben|mitbringen)/i.test(text);
}

/**
 * Fordert das Büro in seinem Text zur Leistung etwas an, das FallFlow nicht als Angabe oder Dokument erkennt (z. B.
 * "Wir brauchen die Heizkostenabrechnungen der letzten drei Jahre")? Dann wartet der Fall auf eine Rückmeldung des
 * Kunden, statt sofort als fertig zu gelten. Sätze zum Formular im Anhang zählen nicht – das wird separat verfolgt.
 */
const REQUEST = /benötig|benoetig|brauch|bitte (senden|schicken|übermitteln|reichen)|senden sie|schicken sie|übermitteln sie|reichen sie|erforderlich|lassen sie uns .* zukommen/i;
const ABOUT_FORM = /formular|anhang|vorlage|ausfüllen|ausgefüllt|datenerfassung|vollmacht/i;
const KNOWN_ITEM = /telefon|handynummer|rufnummer|e-?mail|\bname\b|adresse|anschrift|straße|\bplz\b|postleitzahl|baujahr|wohnfläche|heizung\b|gebäudetyp|eigentümer|grundriss|energieausweis/i;
export function requestsUntrackedItems(serviceText: string): boolean {
  return serviceText
    .split(/[.!?\n]+/)
    .some((s) => REQUEST.test(s) && !ABOUT_FORM.test(s) && !KNOWN_ITEM.test(s.replace(/für (den|die|das) [a-zäöü-]*ausweis/gi, "")));
}

/** Kunde zieht seine Anfrage zurück – keine automatische Antwort, das Büro entscheidet. */
export function looksLikeWithdrawal(text: string): boolean {
  return /hat sich erledigt|nicht mehr (nötig|notwendig|benötigt|erforderlich|aktuell|interessiert)|kein interesse mehr|ziehe (meine|die) anfrage zurück|anfrage (zurückziehen|stornieren)|doch nicht (mehr )?(nötig|verkaufen|sanieren|machen)|wir verkaufen doch nicht|brauchen? (das|den|die|es) (doch )?nicht mehr/i.test(text);
}

/** Abwesenheitsnotiz o. Ä. ohne Auto-Submitted-Kopfzeile (manche Mailprogramme setzen sie nicht). */
export function looksLikeAutoReply(subject: string, body: string): boolean {
  if (/^(abwesend|automatische antwort|out of office|autoreply|auto-reply|abwesenheitsnotiz)\b/i.test(subject.trim())) return true;
  // Typische Abwesenheitsnotiz: abwesend/Urlaub UND Hinweis, dass Mails gerade nicht gelesen werden bzw. eine Vertretung.
  return /nicht im büro|im urlaub|abwesend|out of office/i.test(body) && /(lese|lesen) (meine|unsere|keine) (e-?mails|nachrichten)|keinen zugriff|e-?mails (nicht|nur eingeschränkt)|in dringenden fällen|vertretung|wenden sie sich (bitte )?an/i.test(body);
}

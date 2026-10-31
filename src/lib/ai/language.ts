import { z } from "zod";
import { getAiProvider } from "./provider";

/**
 * Antworten in der Sprache des Kunden: Schreibt ein Kunde z. B. Englisch, Türkisch oder Polnisch, gehen die automatischen
 * Antworten (aus den deutschen Texten unter „Texte“) übersetzt raus. Die Sprache steht im Fall-Feld „lang“ (ISO-Code).
 * Deutsch bleibt unverändert; ohne KI oder bei Fehlern geht der deutsche Text raus.
 */
export const LANGUAGE_NAMES: Record<string, string> = {
  en: "Englisch",
  tr: "Türkisch",
  pl: "Polnisch",
  ru: "Russisch",
  uk: "Ukrainisch",
  ar: "Arabisch",
  it: "Italienisch",
  fr: "Französisch",
  es: "Spanisch",
  ro: "Rumänisch",
  hr: "Kroatisch",
  sr: "Serbisch",
  bg: "Bulgarisch",
  el: "Griechisch",
  nl: "Niederländisch",
  pt: "Portugiesisch",
  cs: "Tschechisch",
  hu: "Ungarisch",
  fa: "Persisch",
  vi: "Vietnamesisch",
};

const GERMAN_WORDS = /\b(und|der|die|das|ich|ist|nicht|bitte|mit|für|wir|sie|ein|eine|haben|habe|guten|hallo|danke|grüße|gruß|unser|unsere|wäre|können|möchte|termin|anfrage|vielen|dank|bei|auf|uns|mein|meine|wie|was|wann|noch|schon|auch)\b/gi;
const ENGLISH_WORDS = /\b(the|and|is|are|my|our|you|your|please|thanks|thank|hello|hi|would|could|need|have|with|for|we|this|that|when|what|can|regards)\b/gi;

/**
 * Schnelle Vorprüfung ohne KI: eindeutig Deutsch → "de", eindeutig Englisch → "en", zu kurz für eine Aussage → "short"
 * ("Ok", "Ja", Zahlen, Adresse), sonst null (KI fragen).
 */
export function guessLanguage(text: string): "de" | "en" | "short" | null {
  const t = text.slice(0, 1500);
  const words = t.split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length;
  const de = (t.match(GERMAN_WORDS) ?? []).length;
  const en = (t.match(ENGLISH_WORDS) ?? []).length;
  // Umlaute/ß sind ein starkes Zeichen für Deutsch.
  if (/[äöüß]/i.test(t) && de >= 1) return "de";
  if (de >= 2 && de >= en) return "de";
  if (en >= 3 && de === 0) return "en";
  if (words < 4) return "short";
  return null;
}

const detectSchema = z.object({ lang: z.string() });

/** Sprache der Kundennachricht als ISO-Code (nur bekannte Sprachen, sonst "de"); null = nicht erkennbar (zu kurz). */
export async function detectLanguage(text: string): Promise<string | null> {
  const quick = guessLanguage(text);
  if (quick === "short") return null;
  if (quick) return quick;
  const provider = getAiProvider();
  if (!provider) return "de";
  try {
    const parsed = detectSchema.safeParse(
      await provider.completeJson(
        'Bestimme die Sprache der Nachricht. Antworte NUR mit JSON: {"lang": "<ISO-639-1-Code, z. B. de, en, tr, pl>"}. Gemischt mit überwiegend Deutsch → "de".',
        text.slice(0, 1000),
      ),
    );
    const lang = parsed.success ? parsed.data.lang.trim().toLowerCase().slice(0, 2) : "de";
    return lang in LANGUAGE_NAMES ? lang : "de";
  } catch {
    return "de";
  }
}

const translateSchema = z.object({ texts: z.array(z.string()) });

/** Antworten ins Ziel übersetzen (eine KI-Anfrage für alle). Links, Zahlen, Daten, Namen und Zeilenumbrüche bleiben. */
export async function translateReplies(texts: string[], lang: string): Promise<string[]> {
  const name = LANGUAGE_NAMES[lang];
  if (!name || !texts.length) return texts;
  const provider = getAiProvider();
  if (!provider) return texts;
  try {
    const parsed = translateSchema.safeParse(
      await provider.completeJson(
        `Übersetze die deutschen Nachrichten eines Betriebs an seinen Kunden ins ${name}. Höflich, natürlich, gleiche Bedeutung, nichts hinzufügen oder weglassen.
Unverändert lassen: Links/URLs, E-Mail-Adressen, Telefonnummern, Beträge, Daten und Uhrzeiten (Format darf landesüblich sein), Firmen- und Personennamen, Zeilenumbrüche.
Antworte NUR mit JSON: {"texts": ["…", …]} – gleiche Anzahl und Reihenfolge wie die Eingabe.`,
        JSON.stringify({ texts }),
      ),
    );
    if (!parsed.success || parsed.data.texts.length !== texts.length) return texts;
    // Sicherheitsnetz: Fehlt in der Übersetzung ein Link aus dem Original, lieber Deutsch senden.
    const links = (s: string) => s.match(/https?:\/\/\S+/g) ?? [];
    const ok = texts.every((t, i) => links(t).every((l) => parsed.data.texts[i].includes(l.replace(/[.,;:!?)]+$/, ""))) && parsed.data.texts[i].trim());
    return ok ? parsed.data.texts : texts;
  } catch (err) {
    console.error("[ai] Übersetzung fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    return texts;
  }
}

/** Eine automatische Nachricht in der Sprache des Kunden (Fall-Feld „lang“); Deutsch bzw. unbekannt bleibt unverändert. */
export async function inCustomerLanguage(fields: Record<string, string>, text: string): Promise<string> {
  const lang = fields.lang;
  if (!lang || lang === "de" || !text.trim()) return text;
  return (await translateReplies([text], lang))[0];
}

/** Nachricht eines fremdsprachigen Kunden fürs Büro ins Deutsche übersetzen (null = nicht möglich). */
export async function translateToGerman(text: string): Promise<string | null> {
  const provider = getAiProvider();
  if (!provider || !text.trim()) return null;
  try {
    const parsed = z.object({ text: z.string() }).safeParse(
      await provider.completeJson('Übersetze die Nachricht ins Deutsche (sinngemäß, nichts hinzufügen). Antworte NUR mit JSON: {"text": "…"}.', text.slice(0, 3000)),
    );
    return parsed.success && parsed.data.text.trim() ? parsed.data.text.trim() : null;
  } catch {
    return null;
  }
}

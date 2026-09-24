import type { DocumentKind } from "@/lib/data/types";

/** Kundennachrichten (Dokumentenanforderung, Follow-up). Reine Textbausteine, keine Beratung. */

const WITH_ARTICLE: Record<DocumentKind, string> = {
  floorplan: "der Grundriss",
  energy_certificate: "der Energieausweis",
  photos: "Fotos des Gebäudes",
  other: "weitere Unterlagen",
};

const ACCUSATIVE: Record<DocumentKind, string> = {
  floorplan: "den Grundriss",
  energy_certificate: "den Energieausweis",
  photos: "Fotos des Gebäudes",
  other: "weitere Unterlagen",
};

const join = (parts: string[]) => (parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}`);

const greeting = (name?: string) => (name?.trim() ? `Guten Tag ${name.trim()},` : "Guten Tag,");

export function documentRequestMessage(input: { name?: string; kinds: DocumentKind[]; url: string; reminder?: boolean }) {
  const list = join(input.kinds.map((k) => (input.reminder ? WITH_ARTICLE[k] : ACCUSATIVE[k])));
  const plural = input.kinds.length > 1 || input.kinds[0] === "photos" || input.kinds[0] === "other";
  const head = input.reminder
    ? `uns ${plural ? "fehlen" : "fehlt"} noch ${list} für die Vorbereitung Ihres Beratungstermins.`
    : `für die Vorbereitung Ihres Beratungstermins benötigen wir noch ${list}.`;
  return `${greeting(input.name)}\n\n${head} Sie können ${plural ? "die Unterlagen" : "das Dokument"} hier direkt und sicher hochladen: ${input.url}\n\nVielen Dank!`;
}

export function infoReminderMessage(input: { name?: string; missing: string[] }) {
  const list = join(input.missing.slice(0, 5));
  return `${greeting(input.name)}\n\nfür die Vorbereitung Ihrer Anfrage fehlen uns noch einige Angaben: ${list}. Antworten Sie einfach auf diese Nachricht, dann ergänzen wir Ihren Fall.\n\nVielen Dank!`;
}

/** Kurzer Chat-Text nach abgeschlossener Datenerfassung (Dokumente fehlen noch). */
export function chatDocumentPrompt(kinds: DocumentKind[]) {
  const list = join(kinds.map((k) => ACCUSATIVE[k]));
  return `Zur Vorbereitung Ihres Termins benötigen wir außerdem noch ${list}. Sie können ${kinds.length > 1 ? "die Unterlagen" : "das Dokument"} direkt hier hochladen – oder später über den Link, den wir Ihnen senden.`;
}

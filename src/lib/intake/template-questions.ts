import { extractTemplateQuestions, type TemplateQuestion } from "@/lib/ai/template-questions";
import type { Store } from "@/lib/data/store";
import type { DocumentTemplate, Question } from "@/lib/data/types";
import { extractPdfText } from "@/lib/documents/pdf-text";
import { readFile } from "@/lib/documents/storage";

/**
 * Formular-Fragen im Chat: Statt einem WhatsApp- oder Telefon-Kunden ein PDF zu schicken, fragt die KI die Angaben aus
 * den passenden Vorlagen (zur Leistung bzw. "bei jeder Anfrage") einzeln ab. Die Fragen je Vorlage werden einmal per KI
 * aus dem PDF gelesen und im Betriebsprofil gespeichert.
 */

/** Vorlagen, die zu dieser Leistung gehören und ausgefüllt zurückkommen sollen. */
export const templatesForService = (templates: DocumentTemplate[], service: string) =>
  templates.filter((t) => t.requiresReturn !== false && (t.alwaysInclude || (service && t.service === service)));

export async function questionsOf(store: Store, tpl: DocumentTemplate): Promise<TemplateQuestion[]> {
  const cached = (await store.getCompany()).businessProfile.templateQuestions?.[tpl.id];
  if (cached) return cached;
  const file = await readFile(tpl.storagePath).catch(() => null);
  const text = file && file.mime === "application/pdf" ? await extractPdfText(file.bytes.slice()).catch(() => "") : "";
  const questions = await extractTemplateQuestions(tpl.id, tpl.title, text);
  // Frisch laden, damit gleichzeitige Änderungen am Profil nicht überschrieben werden.
  const profile = (await store.getCompany()).businessProfile;
  await store.updateCompany({ businessProfile: { ...profile, templateQuestions: { ...profile.templateQuestions, [tpl.id]: questions } } });
  return questions;
}

/** Zusätzliche (optionale) Fragen aus den Formularen zur Leistung – als normale Fragen für das Gespräch. */
export async function templateQuestionsFor(store: Store, templates: DocumentTemplate[], service: string): Promise<Question[]> {
  const out: Question[] = [];
  for (const tpl of templatesForService(templates, service)) {
    for (const q of await questionsOf(store, tpl)) {
      out.push({ id: `tpl-${q.key}`, companyId: "", key: q.key, label: q.label, prompt: q.prompt, type: "text", options: [], required: false, active: true, position: 1000 + out.length });
    }
  }
  return out;
}

/** Bezeichnungen aller Formular-Fragen (für die Anzeige in der Fallakte). */
export function templateQuestionLabels(templateQuestions: Record<string, TemplateQuestion[]> | undefined): { key: string; label: string }[] {
  return Object.values(templateQuestions ?? {}).flatMap((list) => list.map((q) => ({ key: q.key, label: q.label })));
}

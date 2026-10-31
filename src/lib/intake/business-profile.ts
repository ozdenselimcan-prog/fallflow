import { CORE_FIELD_KEYS, fieldKey, type SuggestedField } from "@/lib/ai/business-profile";
import type { Store } from "@/lib/data/store";
import type { BusinessProfile } from "@/lib/data/types";
import { syncServiceQuestionOptions } from "./case-ops";

export interface BusinessProfileInput extends BusinessProfile {
  services: string[];
  fields: SuggestedField[];
}

/**
 * Speichert das Betriebsprofil: Leistungen in companies.services, Profil in companies.business_profile und die
 * branchenspezifischen Angaben als Fragen (assistant_questions) – die Standardangaben (Name, E-Mail, Telefon, Leistung,
 * PLZ …) bleiben unverändert. Danach arbeiten Erkennung, Checkliste und Vollständigkeit mit genau diesen Angaben.
 */
export async function saveBusinessProfile(store: Store, input: BusinessProfileInput): Promise<void> {
  const services = [...new Set(input.services.map((s) => s.trim()).filter(Boolean))];
  // Unterlagen je Leistung: aus dem Vorschlag bzw. der Eingabe, sonst die bisher festgelegten behalten – jeweils nur
  // für noch vorhandene Leistungen und Unterlagen.
  const previousProfile = (await store.getCompany()).businessProfile;
  const source = input.documentsByService ?? previousProfile.documentsByService ?? {};
  const documentsByService: Record<string, string[]> = {};
  for (const [service, docs] of Object.entries(source)) {
    if (services.includes(service)) documentsByService[service] = docs.filter((d) => input.documents.includes(d));
  }
  const needsAddress = input.needsAddress ?? true;
  const wanted = new Map(input.fields.map((f) => [fieldKey(f.key, f.label), f]));
  // Angaben, die nur bei bestimmten Leistungen gebraucht werden (nur noch angebotene Leistungen; alle = keine Einschränkung).
  const fieldServices: Record<string, string[]> = {};
  for (const [key, f] of wanted) {
    const scope = (f.services ?? []).filter((s) => services.includes(s));
    if (scope.length && scope.length < services.length) fieldServices[key] = scope;
  }
  await store.updateCompany({
    services,
    // Übrige Einstellungen (Telefon-Limit, Formular-Fragen …) bleiben erhalten.
    businessProfile: { ...previousProfile, industry: input.industry, description: input.description, documents: input.documents, humanTopics: input.humanTopics, documentsByService, needsAddress, fieldServices },
  });

  const existing = await store.listQuestions();
  const core = new Set<string>(CORE_FIELD_KEYS);
  // Adresse: nur Pflicht, wenn der Betrieb beim Kunden arbeitet (sonst fragt z. B. ein Friseur nach der PLZ).
  const ADDRESS_PROMPTS: Record<string, string> = {
    street: "Wie lautet die Adresse (Straße, Hausnummer, PLZ und Ort)?",
    postalCode: "Wie lautet die Postleitzahl?",
  };
  for (const q of existing) {
    if (!(q.key in ADDRESS_PROMPTS)) continue;
    // Arbeitet der Betrieb beim Kunden, ist die Adresse an und Pflicht (ältere Konten hatten die Straßen-Frage teils
    // abgeschaltet – dann fragte der Assistent nur die PLZ). Sonst (Friseur, Werkstatt …) wird sie gar nicht erst gefragt.
    await store.saveQuestion({ ...q, prompt: ADDRESS_PROMPTS[q.key], required: needsAddress, active: needsAddress });
  }
  // Ältere bzw. neu angelegte Konten haben teils keine Straßen-Frage – dann fragte der Assistent nur die PLZ.
  const postal = existing.find((q) => q.key === "postalCode");
  if (!existing.some((q) => q.key === "street")) {
    await store.saveQuestion({ key: "street", label: "Straße, Nr.", prompt: ADDRESS_PROMPTS.street, type: "text", options: [], required: needsAddress, active: needsAddress, position: postal?.position ?? 1 });
    if (postal) await store.saveQuestion({ ...postal, prompt: ADDRESS_PROMPTS.postalCode, required: needsAddress, position: postal.position + 1 });
  }
  // Nicht mehr gewünschte Branchen-Angaben entfernen (z. B. die Energieberatungs-Standards Baujahr, Heizung …)
  for (const q of existing) if (!core.has(q.key) && !wanted.has(q.key)) await store.deleteQuestion(q.id);
  const corePositions = existing.filter((q) => core.has(q.key)).length;
  let position = corePositions;
  for (const [key, f] of wanted) {
    const prev = existing.find((q) => q.key === key);
    await store.saveQuestion({
      ...(prev ? { id: prev.id } : {}),
      key,
      label: f.label,
      prompt: f.prompt,
      type: "text",
      options: [],
      required: f.required,
      active: true,
      position: position++,
    });
  }
  await syncServiceQuestionOptions(store, services);
}

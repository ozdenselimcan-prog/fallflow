import { isAnswered, SKIPPED } from "@/lib/cases/completeness";
import type { AssistantSettings, CaseDocument, Question, Tone } from "@/lib/data/types";
import { buildChecklist, deriveFields, isRelevant } from "@/lib/intake/checklist";
import { detectBuildingType, detectHeating, detectOwnerStatus, detectService } from "./heuristic";
import { matchOption } from "./schema";

/**
 * Deterministische Gesprächslogik (ohne KI, ohne Server-Abhängigkeiten – läuft auch im Browser).
 * Der Assistent sammelt ausschließlich Angaben. Er berät nicht und erfindet nichts:
 * Fragen des Kunden werden an das Team verwiesen.
 *
 * Dynamischer Frage-Flow: Jede Nachricht wird ausgewertet (Extraktor), bekannte Angaben werden übernommen
 * und nur noch die für den konkreten Fall relevanten, fehlenden Angaben werden erfragt.
 */

export interface TurnInput {
  questions: Question[];
  settings: AssistantSettings;
  fields: Record<string, string>;
  /** Nutzertext dieses Zuges */
  text: string;
  /** Erster Nutzertext (Anfrage) */
  first?: boolean;
  /** Ergebnis der Extraktion für den Nutzertext dieses Zuges (KI oder Regeln) */
  extracted?: Record<string, string>;
  /** Bereits vorhandene Dokumente (für den Vollständigkeitswert) */
  documents?: CaseDocument[];
}

export interface TurnResult {
  fields: Record<string, string>;
  replies: string[];
  quickReplies: string[];
  pendingKey: string | null;
  /** Vollständigkeit in % (Angaben + Pflichtdokumente) */
  completeness: number;
  /** Alle relevanten Fragen abgearbeitet (auch wenn Pflichtfelder übersprungen wurden) */
  done: boolean;
  /** Alle Pflichtangaben wirklich beantwortet */
  complete: boolean;
  handoff: boolean;
  appointmentRequested: boolean;
  /** Schlüssel der in diesem Zug neu erkannten Angaben */
  recognizedKeys: string[];
}

interface Phrases {
  intro: string;
  recognized: string;
  noted: string;
  corrected: string;
  retry: string;
  question: string;
  done: string;
  handoff: string;
  noFollowUp: string;
}

const PHRASES: Record<Tone, Phrases> = {
  professional: {
    intro: "Vielen Dank für Ihre Anfrage.",
    recognized: "Aus Ihrer Nachricht habe ich bereits entnommen:",
    noted: "Notiert:",
    corrected: "Korrigiert:",
    retry: "Diese Angabe konnten wir nicht zuordnen.",
    question: "Fachliche Fragen beantwortet Ihnen gerne unser Team persönlich. Zunächst erfassen wir die Angaben für Ihren Fall.",
    done: "Vielen Dank. Ihre Angaben sind vollständig und wurden an unser Team übergeben.",
    handoff: "Wir haben Ihre Anfrage an einen Mitarbeiter übergeben. Sie erhalten eine persönliche Rückmeldung.",
    noFollowUp: "Vielen Dank. Ihre Anfrage wurde an unser Team übergeben.",
  },
  friendly: {
    intro: "Gerne!",
    recognized: "Das habe ich schon verstanden:",
    noted: "Notiert:",
    corrected: "Korrigiert:",
    retry: "Das habe ich leider nicht ganz verstanden.",
    question: "Dazu meldet sich gerne unser Team persönlich bei Ihnen. Ich sammle zunächst die Angaben für Ihren Fall.",
    done: "Vielen Dank, damit habe ich alle Angaben. Ein Mitarbeiter meldet sich bei Ihnen.",
    handoff: "Kein Problem – ich habe Ihre Anfrage an einen Mitarbeiter übergeben. Sie hören persönlich von uns.",
    noFollowUp: "Vielen Dank! Ihre Anfrage ist bei uns angekommen und wir melden uns bei Ihnen.",
  },
  short: {
    intro: "Gerne.",
    recognized: "Erkannt:",
    noted: "Notiert:",
    corrected: "Korrigiert:",
    retry: "Bitte erneut eingeben.",
    question: "Das klärt unser Team persönlich. Erst die Angaben:",
    done: "Danke. Angaben vollständig.",
    handoff: "Übergeben an einen Mitarbeiter.",
    noFollowUp: "Danke. Wir melden uns.",
  },
};

const NUMBER_FILLER = /baujahr|gebaut|jahr|ca\.?|circa|etwa|ungefähr|rund|m²|m2|qm|quadratmeter|wohnfläche|etagen?|stockwerke?|geschosse?|vollgeschosse?|von|aus|im|es|sind|ist|hat|haben|wir|und|mit|das|haus/gi;
/** Ausdrücke, mit denen Kunden eine zuvor erkannte Angabe berichtigen. */
const CORRECTION = /korrigier|berichtig|stimmt nicht|nicht richtig|falsch|eigentlich|vielmehr|richtig ist|nein,|nicht \d/i;
const HANDOFF = /mitarbeiter|mensch|berater sprechen|jemanden sprechen|rückruf|anrufen/i;
const SKIP = /^(überspringen|weiß ich nicht|weiss ich nicht|keine ahnung|k\. ?a\.?|-|—)$/i;
export const SKIP_LABEL_REQUIRED = "Weiß ich nicht";
export const SKIP_LABEL_OPTIONAL = "Überspringen";
export const APPOINTMENT_LABEL = "Termin wünschen";

/** Schlüssel, die nie als „neu erkannt“ gemeldet oder aus späteren Nachrichten übernommen werden. */
const FREE_TEXT_KEYS = new Set(["description"]);

export const activeQuestions = (questions: Question[]) => questions.filter((q) => q.active).sort((a, b) => a.position - b.position);

/** Nächste noch unbeantwortete, für den Fall relevante Frage. */
export const nextPending = (questions: Question[], fields: Record<string, string>) =>
  activeQuestions(questions).find((q) => isRelevant(q, fields) && !isAnswered(fields, q.key)) ?? null;

type Parsed = { ok: true; value: string } | { ok: false };

export function parseAnswer(q: Question, raw: string): Parsed {
  const text = raw.trim();
  if (!text) return { ok: false };
  if (SKIP.test(text)) return { ok: true, value: SKIPPED };
  const fail: Parsed = { ok: false };
  const year = new Date().getFullYear();

  switch (q.type) {
    case "choice": {
      const opts = q.options;
      const direct = matchOption(text, opts);
      const viaKeyword =
        q.key === "buildingType" ? detectBuildingType(text) : q.key === "heating" ? detectHeating(text) : q.key === "service" ? detectService(text) : q.key === "ownerStatus" ? detectOwnerStatus(text) : "";
      const hit = direct || (opts.includes(viaKeyword) ? viaKeyword : "");
      if (hit) return { ok: true, value: hit };
      return opts.includes("Sonstiges") && text.length <= 80 && !text.includes("?") && !CORRECTION.test(text) ?{ ok: true, value: "Sonstiges" } : fail;
    }
    case "number": {
      // Zahlen nur akzeptieren, wenn der Text im Wesentlichen eine Angabe ist („1987“, „Baujahr 1987“, „ca. 160 qm“) – nicht z. B. „Gartenweg 12“.
      if (text.replace(NUMBER_FILLER, "").replace(/[\d\s.,:/-]/g, "").length > 3) return fail;
      const n = Number(text.replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0]);
      if (!Number.isFinite(n) || n <= 0) return fail;
      if (q.key === "yearBuilt" && (n < 1600 || n > year || !Number.isInteger(n))) return fail;
      if (q.key === "livingArea" && (n < 10 || n > 100000)) return fail;
      if (q.key === "floors" && (n > 30 || !Number.isInteger(n))) return fail;
      return { ok: true, value: String(Math.round(n)) };
    }
    case "postal": {
      const plz = text.match(/(?<!\d)\d{5}(?!\d)/)?.[0];
      return plz ? { ok: true, value: plz } : fail;
    }
    case "email": {
      const mail = text.match(/[^\s@,;<>]{1,64}@[^\s@,;<>]{1,255}\.[a-z]{2,}/i)?.[0];
      return mail ? { ok: true, value: mail.toLowerCase() } : fail;
    }
    case "phone": {
      const digits = text.replace(/\D/g, "");
      return digits.length >= 6 && digits.length <= 16 && /^[+\d][\d\s/()+-]+$/.test(text) ? { ok: true, value: text.slice(0, 30) } : fail;
    }
    default:
      return text.length >= 2 && text.length <= 500 ? { ok: true, value: text.replace(/[<>]/g, "") } : fail;
  }
}

export function quickRepliesFor(q: Question): string[] {
  const skip = q.required ? SKIP_LABEL_REQUIRED : SKIP_LABEL_OPTIONAL;
  return q.type === "choice" ? [...q.options, skip] : [skip];
}

/** „Baujahr 1987, Wohnfläche 160 m²“ – nur echte Werte, nichts erfinden. */
function describeRecognized(keys: string[], fields: Record<string, string>, questions: Question[]) {
  return keys
    .filter((k) => fields[k] && fields[k] !== SKIPPED && !FREE_TEXT_KEYS.has(k))
    .map((k) => {
      const label = questions.find((q) => q.key === k)?.label ?? k;
      const value = k === "livingArea" ? `${fields[k]} m²` : fields[k];
      return `${label} ${value}`;
    })
    .join(", ");
}

const result = (input: TurnInput, fields: Record<string, string>, extra: Partial<TurnResult> & { replies: string[] }): TurnResult => {
  const pending = nextPending(input.questions, fields);
  const checklist = buildChecklist({ questions: input.questions, fields, documents: input.documents ?? [] });
  return {
    fields,
    quickReplies: [],
    pendingKey: pending?.key ?? null,
    completeness: checklist.percent,
    done: false,
    complete: checklist.dataComplete,
    handoff: false,
    appointmentRequested: false,
    recognizedKeys: [],
    ...extra,
  };
};

/** Übernimmt erkannte Angaben, die noch nicht beantwortet sind. Gibt die neu gesetzten Schlüssel zurück. */
function mergeExtracted(fields: Record<string, string>, extracted: Record<string, string> | undefined, opts: { allowFreeText: boolean }) {
  const added: string[] = [];
  for (const [k, v] of Object.entries(extracted ?? {})) {
    if (!v || isAnswered(fields, k)) continue;
    if (FREE_TEXT_KEYS.has(k) && !opts.allowFreeText) continue;
    fields[k] = v;
    if (!FREE_TEXT_KEYS.has(k)) added.push(k);
  }
  return added;
}

/** Ein Gesprächszug: Nutzertext verarbeiten und die nächste Antwort samt Schnellantworten bestimmen. */
export function applyTurn(input: TurnInput): TurnResult {
  const { questions, settings, text } = input;
  const p = PHRASES[settings.tone];
  const fields = { ...input.fields };
  const replies: string[] = [];
  let recognized: string[] = [];

  if (settings.humanHandoff && HANDOFF.test(text)) {
    return result(input, fields, { replies: [p.handoff], handoff: true, done: true });
  }

  // Korrektur einer bereits erfassten Angabe („Baujahr ist eigentlich 1988“): nur bei ausdrücklichem Korrekturwunsch überschreiben.
  if (!input.first && CORRECTION.test(text)) {
    const changed: string[] = [];
    for (const [k, v] of Object.entries(input.extracted ?? {})) {
      if (!v || FREE_TEXT_KEYS.has(k) || !isAnswered(fields, k) || fields[k] === SKIPPED || fields[k] === v) continue;
      fields[k] = v;
      changed.push(k);
    }
    if (changed.length) {
      if (changed.includes("heating")) delete fields.energySource;
      Object.assign(fields, deriveFields(fields));
      const next = nextPending(questions, fields);
      const said = `${p.corrected} ${describeRecognized(changed, fields, questions)}.`;
      return result(input, fields, next ? { replies: [said, next.prompt], quickReplies: quickRepliesFor(next), recognizedKeys: changed } : { replies: [said], done: true, recognizedKeys: changed });
    }
  }

  const pendingBefore = nextPending(questions, fields);

  if (input.first) {
    recognized = mergeExtracted(fields, input.extracted, { allowFreeText: true });
    fields.description ||= text.trim().slice(0, 1000);
    Object.assign(fields, deriveFields(fields));
    if (!settings.autoFollowUp) {
      return result(input, fields, { replies: [p.noFollowUp], done: true, recognizedKeys: recognized });
    }
    replies.push(p.intro);
    const known = describeRecognized(recognized, fields, questions);
    if (known) replies.push(`${p.recognized} ${known}. Falls etwas nicht stimmt, schreiben Sie mir einfach die Korrektur.`);
    if (!nextPending(questions, fields)) replies.push("Ich habe alle nötigen Angaben aus Ihrer Nachricht entnehmen können.");
    else replies.push("Für Ihren Fall fehlen mir noch ein paar Angaben.");
  } else if (!pendingBefore) {
    // Fall bereits vollständig erfasst – nur noch Terminwunsch bzw. Hinweis
    if (settings.appointmentBooking && text.trim() === APPOINTMENT_LABEL) {
      return result(input, fields, { replies: ["Notiert. Ein Mitarbeiter schlägt Ihnen in Kürze einen Termin vor."], done: true, appointmentRequested: true });
    }
    return result(input, fields, { replies: ["Ihre Anfrage liegt bereits vor. Ein Mitarbeiter meldet sich bei Ihnen."], done: true });
  } else {
    const parsed = parseAnswer(pendingBefore, text);
    if (parsed.ok) {
      fields[pendingBefore.key] = parsed.value;
      recognized.push(pendingBefore.key);
      // Längere Nachrichten enthalten oft weitere Angaben – auch diese übernehmen.
      if (text.trim().length > 40) recognized.push(...mergeExtracted(fields, input.extracted, { allowFreeText: false }));
    } else {
      const gained = mergeExtracted(fields, input.extracted, { allowFreeText: false });
      if (gained.length === 0) {
        const asksQuestion = text.includes("?");
        return result(input, fields, {
          replies: [asksQuestion ? p.question : p.retry, pendingBefore.prompt],
          quickReplies: quickRepliesFor(pendingBefore),
        });
      }
      recognized.push(...gained);
    }
    Object.assign(fields, deriveFields(fields));
    // Nur zusätzlich erkannte Angaben nennen – die direkte Antwort braucht keine Bestätigung.
    const extras = recognized.filter((k) => k !== pendingBefore.key);
    const known = describeRecognized(extras, fields, questions);
    if (known) replies.push(`${p.noted} ${known}.`);
  }

  const pending = nextPending(questions, fields);
  if (pending) {
    replies.push(pending.prompt);
    return result(input, fields, { replies, quickReplies: quickRepliesFor(pending), recognizedKeys: recognized });
  }

  const complete = buildChecklist({ questions, fields, documents: input.documents ?? [] }).dataComplete;
  replies.push(complete ? p.done : p.noFollowUp);
  return result(input, fields, {
    replies,
    quickReplies: settings.appointmentBooking ? [APPOINTMENT_LABEL] : [],
    done: true,
    recognizedKeys: recognized,
  });
}

/** Erste Begrüßung inkl. Name des Assistenten. */
export const greetingFor = (s: AssistantSettings) => s.greeting;

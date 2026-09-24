import { computeCompleteness, isAnswered, SKIPPED } from "@/lib/cases/completeness";
import type { AssistantSettings, Question, Tone } from "@/lib/data/types";
import { detectBuildingType, detectHeating, detectService } from "./heuristic";
import { matchOption } from "./schema";

/**
 * Deterministische Gesprächslogik (ohne KI, ohne Server-Abhängigkeiten – läuft auch im Browser).
 * Der Assistent sammelt ausschließlich Angaben. Er berät nicht und erfindet nichts:
 * Fragen des Kunden werden an das Team verwiesen.
 */

export interface TurnInput {
  questions: Question[];
  settings: AssistantSettings;
  fields: Record<string, string>;
  /** Nutzertext dieses Zuges */
  text: string;
  /** Erster Nutzertext (Anfrage) → wird per Extraktor vorbefüllt */
  first?: boolean;
  /** Ergebnis der Extraktion für den ersten Text */
  extracted?: Record<string, string>;
}

export interface TurnResult {
  fields: Record<string, string>;
  replies: string[];
  quickReplies: string[];
  pendingKey: string | null;
  completeness: number;
  /** Alle Fragen abgearbeitet (auch wenn Pflichtfelder übersprungen wurden) */
  done: boolean;
  /** Alle Pflichtfelder wirklich beantwortet */
  complete: boolean;
  handoff: boolean;
  appointmentRequested: boolean;
}

const PHRASES: Record<Tone, { intro: string; retry: string; question: string; done: string; handoff: string; noFollowUp: string }> = {
  professional: {
    intro: "Vielen Dank für Ihre Anfrage. Zur Vorbereitung benötigen wir einige Angaben.",
    retry: "Diese Angabe konnten wir nicht zuordnen.",
    question: "Fachliche Fragen beantwortet Ihnen gerne unser Team persönlich. Zunächst erfassen wir die Angaben für Ihren Fall.",
    done: "Vielen Dank. Ihre Anfrage ist vollständig und wurde an unser Team übergeben.",
    handoff: "Wir haben Ihre Anfrage an einen Mitarbeiter übergeben. Sie erhalten eine persönliche Rückmeldung.",
    noFollowUp: "Vielen Dank. Ihre Anfrage wurde an unser Team übergeben.",
  },
  friendly: {
    intro: "Gerne. Damit wir Ihre Anfrage vorbereiten können, benötigen wir noch einige Angaben.",
    retry: "Das habe ich leider nicht ganz verstanden.",
    question: "Dazu meldet sich gerne unser Team persönlich bei Ihnen. Ich sammle zunächst die Angaben für Ihren Fall.",
    done: "Vielen Dank. Ihre Anfrage ist vollständig. Ein Mitarbeiter meldet sich bei Ihnen.",
    handoff: "Kein Problem – ich habe Ihre Anfrage an einen Mitarbeiter übergeben. Sie hören persönlich von uns.",
    noFollowUp: "Vielen Dank! Ihre Anfrage ist bei uns angekommen und wir melden uns bei Ihnen.",
  },
  short: {
    intro: "Gerne. Noch ein paar Angaben:",
    retry: "Bitte erneut eingeben.",
    question: "Das klärt unser Team persönlich. Erst die Angaben:",
    done: "Danke. Anfrage vollständig.",
    handoff: "Übergeben an einen Mitarbeiter.",
    noFollowUp: "Danke. Wir melden uns.",
  },
};

const HANDOFF = /mitarbeiter|mensch|berater sprechen|jemanden sprechen|rückruf|anrufen/i;
const SKIP = /^(überspringen|weiß ich nicht|weiss ich nicht|keine ahnung|k\. ?a\.?|-|—)$/i;
export const SKIP_LABEL_REQUIRED = "Weiß ich nicht";
export const SKIP_LABEL_OPTIONAL = "Überspringen";
export const APPOINTMENT_LABEL = "Termin wünschen";

export const activeQuestions = (questions: Question[]) => questions.filter((q) => q.active).sort((a, b) => a.position - b.position);

export const nextPending = (questions: Question[], fields: Record<string, string>) =>
  activeQuestions(questions).find((q) => !isAnswered(fields, q.key)) ?? null;

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
      const viaKeyword = q.key === "buildingType" ? detectBuildingType(text) : q.key === "heating" ? detectHeating(text) : q.key === "service" ? detectService(text) : "";
      const hit = direct || (opts.includes(viaKeyword) ? viaKeyword : "");
      if (hit) return { ok: true, value: hit };
      return opts.includes("Sonstiges") && text.length <= 80 && !text.includes("?") ? { ok: true, value: "Sonstiges" } : fail;
    }
    case "number": {
      const n = Number(text.replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0]);
      if (!Number.isFinite(n) || n <= 0) return fail;
      if (q.key === "yearBuilt" && (n < 1600 || n > year || !Number.isInteger(n))) return fail;
      if (q.key === "livingArea" && (n < 10 || n > 100000)) return fail;
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

const result = (
  input: TurnInput,
  fields: Record<string, string>,
  extra: Partial<TurnResult> & { replies: string[] },
): TurnResult => {
  const pending = nextPending(input.questions, fields);
  const completeness = computeCompleteness(input.questions, fields);
  return {
    fields,
    quickReplies: [],
    pendingKey: pending?.key ?? null,
    completeness,
    done: false,
    complete: false,
    handoff: false,
    appointmentRequested: false,
    ...extra,
  };
};

/** Ein Gesprächszug: Nutzertext verarbeiten und die nächste Antwort samt Schnellantworten bestimmen. */
export function applyTurn(input: TurnInput): TurnResult {
  const { questions, settings, text } = input;
  const p = PHRASES[settings.tone];
  let fields = { ...input.fields };
  const replies: string[] = [];

  if (settings.humanHandoff && HANDOFF.test(text)) {
    return result(input, fields, { replies: [p.handoff], handoff: true, done: true });
  }

  const pendingBefore = nextPending(questions, fields);

  if (input.first) {
    for (const [k, v] of Object.entries(input.extracted ?? {})) if (v && !isAnswered(fields, k)) fields[k] = v;
    fields.description ||= text.trim().slice(0, 1000);
    if (!settings.autoFollowUp) {
      return result(input, fields, { replies: [p.noFollowUp], done: true });
    }
    replies.push(p.intro);
  } else if (!pendingBefore) {
    // Fall bereits vollständig erfasst – nur noch Terminwunsch bzw. Hinweis
    if (settings.appointmentBooking && text.trim() === APPOINTMENT_LABEL) {
      return result(input, fields, { replies: ["Notiert. Ein Mitarbeiter schlägt Ihnen in Kürze einen Termin vor."], done: true, complete: true, appointmentRequested: true });
    }
    return result(input, fields, { replies: ["Ihre Anfrage liegt bereits vor. Ein Mitarbeiter meldet sich bei Ihnen."], done: true, complete: true });
  } else {
    const parsed = parseAnswer(pendingBefore, text);
    if (!parsed.ok) {
      const asksQuestion = text.includes("?");
      return result(input, fields, {
        replies: [asksQuestion ? p.question : p.retry, pendingBefore.prompt],
        quickReplies: quickRepliesFor(pendingBefore),
      });
    }
    fields = { ...fields, [pendingBefore.key]: parsed.value };
  }

  const pending = nextPending(questions, fields);
  if (pending) {
    replies.push(pending.prompt);
    return result(input, fields, { replies, quickReplies: quickRepliesFor(pending) });
  }

  const completeness = computeCompleteness(questions, fields);
  replies.push(completeness === 100 ? p.done : p.noFollowUp);
  return result(input, fields, {
    replies,
    quickReplies: settings.appointmentBooking ? [APPOINTMENT_LABEL] : [],
    done: true,
    complete: completeness === 100,
  });
}

/** Erste Begrüßung inkl. Name des Assistenten. */
export const greetingFor = (s: AssistantSettings) => s.greeting;

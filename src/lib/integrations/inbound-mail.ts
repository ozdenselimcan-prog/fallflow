import { classifyInquiry } from "@/lib/ai/classify";
import type { Store } from "@/lib/data/store";
import type { CaseRecord } from "@/lib/data/types";
import { extractForText } from "@/lib/intake/engine";
import { noteSkippedAttachments, receiveEmailAttachments } from "@/lib/intake/case-ops";
import { findCaseByIdentity } from "@/lib/intake/identity";
import { routeInbound } from "@/lib/intake/router";
import type { InboundAttachment } from "./email";

export interface IncomingMail {
  /** Absenderadresse (klein geschrieben) */
  from: string;
  fromName?: string;
  subject: string;
  body: string;
  attachments: InboundAttachment[];
  skippedAttachments?: string[];
}

/**
 * Der Fall des Kunden ist fertig vorbereitet ("Bereit zur Prüfung"): Ist die neue Mail eine echte Anfrage – zu einer
 * anderen Leistung oder (ohne laufende Terminabstimmung) nach über 30 Tagen –, wird ein neuer Fall angelegt.
 * Kurze Rückmeldungen ("Danke", "Dienstag passt", Rückfragen) bleiben im bisherigen Fall. (Übernommene Fälle
 * zählen ohnehin nicht mehr als offen, siehe findCaseByIdentity.)
 */
async function isNewRequestAfterDoneCase(c: CaseRecord, text: string): Promise<boolean> {
  if (c.status !== "READY_FOR_REVIEW") return false;
  // Nicht sicher beurteilbar (KI nicht erreichbar) → im bisherigen Fall bleiben.
  if ((await classifyInquiry(text)) !== true) return false;
  const service = (await extractForText(text)).service ?? "";
  const otherService = Boolean(service && service !== "Sonstiges" && service !== (c.fields.service ?? ""));
  // Läuft noch eine Terminabstimmung, geht es bei derselben Leistung fast immer um den Termin – dann im alten Fall bleiben.
  const stage = c.fields.apptStage ?? "";
  const longAgo = stage !== "ask" && stage !== "proposed" && Date.now() - Date.parse(c.updatedAt) > 30 * 86_400_000;
  return otherService || longAgo;
}

/** Grund für "Aufmerksamkeit benötigt", wenn die KI nicht prüfen konnte, ob es eine Kundenanfrage ist. */
export const UNSURE_ATTENTION = "KI war kurz nicht erreichbar – bitte prüfen, ob es eine Kundenanfrage ist, und selbst antworten";

export type InboundOutcome = { handled: false } | { handled: true; caseId: string; matchedExisting: boolean };

/**
 * Verarbeitet eine eingegangene E-Mail: prüft, ob es überhaupt eine Kundenanfrage ist, ordnet sie dem Fall zu
 * (bzw. legt einen an), lässt die KI reagieren und legt die Anhänge in der Fallakte ab. Genutzt vom Postfach-Abruf
 * (mail-sync.ts) und von der Test-Simulation (/api/simulate/email). CaseLimitReachedError geht an den Aufrufer.
 * Mails aus dem Junk-Ordner (junk) werden genauso bearbeitet: Echten Spam sortiert die Anfrage-Prüfung aus, echte
 * Kundenanfragen bekommen ganz normal ihre Antwort – im Verlauf steht nur ein Hinweis.
 */
export async function handleInboundMail(store: Store, companyId: string, mail: IncomingMail, opts: { simulated?: boolean; junk?: boolean } = {}): Promise<InboundOutcome> {
  const fullText = `${mail.subject ? `${mail.subject}\n\n` : ""}${mail.body}`;
  const previous = findCaseByIdentity(await store.listCases(), { email: mail.from });
  // Ist der bisherige Fall schon fertig und stellt der Kunde eine NEUE Anfrage, beginnt ein ganz neuer Fall.
  const startNew = previous ? await isNewRequestAfterDoneCase(previous, fullText) : false;
  const existing = startNew ? null : previous;
  // Mails von Kunden mit bestehendem Fall kommen immer durch (auch ein knappes "Danke!" oder "Dienstag passt").
  // Neue Absender prüft die KI immer – auch mit Anhang, sonst würde z. B. eine Lieferantenrechnung als PDF zum Fall.
  // Die Dateinamen gehen mit in die Prüfung, damit "siehe Anhang" + grundriss.pdf trotzdem als Anfrage erkannt wird.
  const fileNames = [...mail.attachments.map((a) => a.filename), ...(mail.skippedAttachments ?? [])];
  const classifyText = fileNames.length ? `${fullText}\n\n[Anhänge: ${fileNames.join(", ")}]` : fullText;
  // Ist die KI gerade nicht erreichbar (null), wird nicht blind geantwortet: Mails aus dem Junk-Ordner bleiben liegen
  // (fast immer Spam), alle anderen werden als Fall angelegt, aber ohne automatische Antwort – das Büro schaut drauf.
  let unsure = false;
  // (Neue Anfrage nach fertigem Fall: schon als Anfrage erkannt, siehe isNewRequestAfterDoneCase.)
  if (!existing && !startNew) {
    const verdict = await classifyInquiry(classifyText);
    if (verdict === false || (verdict === null && opts.junk)) return { handled: false };
    unsure = verdict === null;
  }

  const { turn, matchedExisting } = await routeInbound(store, {
    companyId,
    channel: "email",
    text: fullText.slice(0, 1500),
    sender: { email: mail.from, name: mail.fromName || undefined },
    simulated: opts.simulated,
    forceNewCase: startNew,
    forceAttention: unsure ? UNSURE_ATTENTION : undefined,
  });
  if (startNew && previous) await store.addEvent(turn.sessionId, "note", `Neue Anfrage eines bekannten Kunden – sein früherer Fall (${previous.service || "ohne Leistung"}) war bereits abgeschlossen.`);
  if (opts.junk) await store.addEvent(turn.sessionId, "note", "E-Mail des Kunden lag im Spam-/Junk-Ordner und wurde trotzdem übernommen.");
  // Alle Anhänge dieser Mail gemeinsam verarbeiten (Vorlagen, Grundriss, Energieausweis, Fotos) und danach
  // genau einmal antworten – Abschluss-Nachricht oder kurze Bestätigung, was noch fehlt.
  if (mail.skippedAttachments?.length) await noteSkippedAttachments(store, turn.sessionId, mail.skippedAttachments);
  await receiveEmailAttachments(store, turn.sessionId, mail.attachments).catch((err) => {
    console.error("[mail] Anhänge konnten nicht verarbeitet werden:", err instanceof Error ? err.message : "unbekannt");
  });
  return { handled: true, caseId: turn.sessionId, matchedExisting };
}

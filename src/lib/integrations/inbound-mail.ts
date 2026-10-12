import { isCustomerInquiry } from "@/lib/ai/classify";
import type { Store } from "@/lib/data/store";
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

export type InboundOutcome = { handled: false } | { handled: true; caseId: string; matchedExisting: boolean };

/**
 * Verarbeitet eine eingegangene E-Mail: prüft, ob es überhaupt eine Kundenanfrage ist, ordnet sie dem Fall zu
 * (bzw. legt einen an), lässt die KI reagieren und legt die Anhänge in der Fallakte ab. Genutzt vom Postfach-Abruf
 * (mail-sync.ts) und von der Test-Simulation (/api/simulate/email). CaseLimitReachedError geht an den Aufrufer.
 */
/** Hinweis bei neuen Anfragen aus dem Junk-Ordner: keine automatische Antwort, das Büro schaut selbst drauf. */
export const JUNK_ATTENTION = "Anfrage lag im Spam-/Junk-Ordner – bitte prüfen und selbst antworten";

export async function handleInboundMail(store: Store, companyId: string, mail: IncomingMail, opts: { simulated?: boolean; junk?: boolean } = {}): Promise<InboundOutcome> {
  const existing = findCaseByIdentity(await store.listCases(), { email: mail.from });
  const fullText = `${mail.subject ? `${mail.subject}\n\n` : ""}${mail.body}`;
  // Mails von Kunden mit bestehendem Fall kommen immer durch (auch ein knappes "Danke!" oder "Dienstag passt").
  // Neue Absender prüft die KI immer – auch mit Anhang, sonst würde z. B. eine Lieferantenrechnung als PDF zum Fall.
  // Die Dateinamen gehen mit in die Prüfung, damit "siehe Anhang" + grundriss.pdf trotzdem als Anfrage erkannt wird.
  const fileNames = [...mail.attachments.map((a) => a.filename), ...(mail.skippedAttachments ?? [])];
  const classifyText = fileNames.length ? `${fullText}\n\n[Anhänge: ${fileNames.join(", ")}]` : fullText;
  if (!existing && !(await isCustomerInquiry(classifyText))) return { handled: false };

  const { turn, matchedExisting } = await routeInbound(store, {
    companyId,
    channel: "email",
    text: fullText.slice(0, 1500),
    sender: { email: mail.from, name: mail.fromName || undefined },
    simulated: opts.simulated,
    // Neue Absender aus dem Junk-Ordner: Fall anlegen, aber nicht automatisch antworten (könnte Spam sein).
    // Bekannte Kunden (z. B. die Antwort mit dem ausgefüllten Formular) werden ganz normal bearbeitet.
    forceAttention: opts.junk && !existing ? JUNK_ATTENTION : undefined,
  });
  if (opts.junk && existing) await store.addEvent(turn.sessionId, "note", "E-Mail des Kunden lag im Spam-/Junk-Ordner und wurde trotzdem übernommen.");
  // Alle Anhänge dieser Mail gemeinsam verarbeiten (Vorlagen, Grundriss, Energieausweis, Fotos) und danach
  // genau einmal antworten – Abschluss-Nachricht oder kurze Bestätigung, was noch fehlt.
  if (mail.skippedAttachments?.length) await noteSkippedAttachments(store, turn.sessionId, mail.skippedAttachments);
  await receiveEmailAttachments(store, turn.sessionId, mail.attachments).catch((err) => {
    console.error("[mail] Anhänge konnten nicht verarbeitet werden:", err instanceof Error ? err.message : "unbekannt");
  });
  return { handled: true, caseId: turn.sessionId, matchedExisting };
}

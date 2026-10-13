import type { Store } from "@/lib/data/store";
import type { CaseSource, MessageChannel } from "@/lib/data/types";
import { processIntakeMessage, type IntakeTurn } from "./engine";
import { findCaseByIdentity } from "./identity";

export interface InboundMessage {
  companyId: string;
  channel: Exclude<MessageChannel, "website" | "phone">;
  text: string;
  sender: { email?: string; phone?: string; name?: string };
  simulated?: boolean;
  /** true = immer einen neuen Fall anlegen, auch wenn es zu diesem Absender schon einen gibt. */
  forceNewCase?: boolean;
  /** Fall anlegen, aber mit diesem Grund unter "Aufmerksamkeit benötigt" statt automatisch zu antworten. */
  forceAttention?: string;
}

export interface InboundResult {
  turn: IntakeTurn;
  /** true = einem bestehenden Fall zugeordnet, false = neuer Fall angelegt */
  matchedExisting: boolean;
}

/**
 * Zentrale Eingangsverarbeitung für E-Mail:
 * Nachricht → Kunde/Fall erkennen (E-Mail-Adresse bzw. Telefonnummer) → im Fall speichern → fehlende
 * Angaben erkennen → KI reagiert. Unbekannte Absender erzeugen einen neuen Fall.
 */
export async function routeInbound(store: Store, msg: InboundMessage): Promise<InboundResult> {
  const cases = await store.listCases();
  const match = msg.forceNewCase ? null : findCaseByIdentity(cases, msg.sender);
  const source: CaseSource = msg.channel;
  const turn = await processIntakeMessage(store, {
    companyId: msg.companyId,
    sessionId: match?.id ?? null,
    text: msg.text,
    source,
    channel: msg.channel,
    simulated: msg.simulated,
    identity: msg.sender,
    forceAttention: msg.forceAttention,
  });
  return { turn, matchedExisting: Boolean(match) };
}

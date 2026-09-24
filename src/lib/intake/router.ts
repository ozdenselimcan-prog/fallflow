import type { Store } from "@/lib/data/store";
import type { CaseSource, MessageChannel } from "@/lib/data/types";
import { processIntakeMessage, type IntakeTurn } from "./engine";
import { findCaseByIdentity } from "./identity";

export interface InboundMessage {
  channel: Exclude<MessageChannel, "website" | "phone">;
  text: string;
  sender: { email?: string; phone?: string; name?: string };
  simulated?: boolean;
}

export interface InboundResult {
  turn: IntakeTurn;
  /** true = einem bestehenden Fall zugeordnet, false = neuer Fall angelegt */
  matchedExisting: boolean;
}

/**
 * Zentrale Eingangsverarbeitung für WhatsApp und E-Mail:
 * Nachricht → Kunde/Fall erkennen (E-Mail-Adresse bzw. Telefonnummer) → im Fall speichern → fehlende
 * Angaben erkennen → KI reagiert. Unbekannte Absender erzeugen einen neuen Fall.
 */
export async function routeInbound(store: Store, msg: InboundMessage): Promise<InboundResult> {
  const cases = await store.listCases();
  const match = findCaseByIdentity(cases, msg.sender);
  const source: CaseSource = msg.channel;
  const turn = await processIntakeMessage(store, {
    sessionId: match?.id ?? null,
    text: msg.text,
    source,
    channel: msg.channel,
    simulated: msg.simulated,
    identity: msg.sender,
  });
  return { turn, matchedExisting: Boolean(match) };
}

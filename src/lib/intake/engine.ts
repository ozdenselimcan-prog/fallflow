import { extractFields, extractionContext, type ExtractionContext } from "@/lib/ai/case-extractor";
import { applyTurn, isInteractive, nextPending, parseAnswer, type TurnResult } from "@/lib/ai/conversation";
import { formNotByEmail, looksLikeWithdrawal, mentionedServices } from "./request-signals";
import { customerQuestion, obviousHumanQuestion } from "@/lib/ai/personal-reply";
import { ATTENTION_KEY, attentionOf } from "@/lib/cases/attention";
import { heuristicExtract } from "@/lib/ai/heuristic";
import { canCreateCase } from "@/lib/billing/usage";
import { FIELD_GROUPS } from "@/lib/cases/fields";
import type { Store } from "@/lib/data/store";
import { profileDocumentsFor, type CaseRecord, type CaseSource, type CaseStatus, type DocumentKind, type MessageChannel } from "@/lib/data/types";
import type { InboundAttachment } from "@/lib/integrations/email";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { normalizePhone } from "./identity";
import { outlookBusy, removeAppointment } from "@/lib/integrations/outlook-calendar";
import { refreshCase, ensureUploadToken, autoBookNextSlot, autoConfirmIfEnabled, completionTextFor, frameEmail, matchServiceMaterials, uploadUrl } from "./case-ops";
import { CONTACT_CHANNEL_KEY } from "./checklist";
import { customerText } from "@/lib/config/customer-texts";
import { answerFromKnowledge, knowledgeOf } from "@/lib/ai/knowledge";
import { templateQuestionsFor } from "./template-questions";
import { answerWebsiteChat } from "./website-chat";
import { documentList } from "./messages";
import {
  availabilityExample,
  findNextSlot,
  findSlotOnDate,
  formatSlot,
  formatYmd,
  looksLikeCancellation,
  looksLikeReschedule,
  parseAvailability,
  workingDayNames,
  parseSpecificDate,
  ymdToDate,
} from "./scheduling";

export class SessionNotFoundError extends Error {}
/** Monatliches Fall-Limit des Abo-Plans erreicht – keine neue Anfrage wird mehr als Fall angelegt. */
export class CaseLimitReachedError extends Error {}

export interface IntakeInput {
  companyId: string;
  /** Fall-ID (unratbare UUID) einer laufenden Unterhaltung, null bei der ersten Nachricht */
  sessionId: string | null;
  text: string;
  source: CaseSource;
  channel: MessageChannel;
  /** true = im Simulator erzeugt, nichts wird nach außen versendet */
  simulated?: boolean;
  /** Bekannte Absenderdaten (E-Mail-Adresse, Telefonnummer …) – gelten als beantwortet */
  identity?: { email?: string; phone?: string; name?: string };
  /** Keine automatische Antwort, sondern "Aufmerksamkeit benötigt" mit diesem Grund (z. B. KI nicht erreichbar). */
  forceAttention?: string;
}

export interface UploadPrompt {
  url: string;
  items: { kind: DocumentKind; label: string; done: boolean; required: boolean }[];
}

export interface IntakeTurn {
  sessionId: string;
  replies: string[];
  quickReplies: string[];
  done: boolean;
  completeness: number;
  status: CaseStatus;
  fields: Record<string, string>;
  /** Wurden die Antworten wirklich beim Kunden zugestellt (Website-Chat) oder nur gespeichert? */
  delivered: boolean;
  deliveryNote: string;
  upload: UploadPrompt | null;
  /** true, wenn in diesem Zug ein neuer Fall angelegt wurde */
  created: boolean;
}

const SHORT_TEXT = 25;

/** Kurze Antworten („1987“, „Gas“) werten wir regelbasiert aus; nur längere Texte gehen an das KI-Modell. */
export async function extractForText(text: string, ctx: ExtractionContext | null = null): Promise<Record<string, string>> {
  return text.length > SHORT_TEXT ? (await extractFields(text, ctx)).fields : heuristicExtract(text);
}

/**
 * Verarbeitet eine Kundennachricht (Website-Chat, E-Mail): erkennt bekannte Angaben, fragt nur noch
 * relevante fehlende Angaben ab, hält Fallakte, Status und Dokumentenanforderung aktuell.
 */
export async function processIntakeMessage(store: Store, input: IntakeInput): Promise<IntakeTurn> {
  const { companyId } = input;
  const [baseQuestions, settings, company, templates, serviceMessages] = await Promise.all([
    store.listQuestions(),
    store.getAssistant(),
    store.getCompany(),
    store.listDocumentTemplates(),
    store.listServiceMessages(),
  ]);
  const foerderOverrides = { energyCertificate: company.foerderEnergyCertificate, floorplan: company.foerderFloorplan, profiled: Boolean(company.businessProfile?.industry) };
  const existing = input.sessionId ? await store.getCase(input.sessionId) : null;
  if (input.sessionId && !existing) throw new SessionNotFoundError();

  const first = !existing;
  // Das Team hat in diesem WhatsApp-Chat selbst geantwortet: KI schweigt, Nachricht kommt beim Team an.
  if (input.channel === "whatsapp" && existing?.fields[AI_PAUSED_KEY] === "1") return recordWhilePaused(store, existing, input);
  // Monatliches Fall-Limit nur für wirklich NEUE Anfragen prüfen – ein laufender Fall wird nie
  // abgebrochen, nur weil das Büro zwischenzeitlich sein Kontingent erreicht hat.
  if (first && !(await canCreateCase(store)).allowed) throw new CaseLimitReachedError();
  const documents = existing ? await store.listDocuments(existing.id) : [];
  // "Automatische Antworten" aus: FallFlow schreibt dem Kunden per E-Mail nichts, bereitet den Fall aber trotzdem vor
  // (Angaben auslesen, Unterlagen ablegen, Vollständigkeit) – das Büro antwortet selbst.
  const silent = (input.channel === "email" || input.channel === "whatsapp") && !settings.autoReply;
  const T = (key: string, vars: Record<string, string> = {}) => customerText(company.businessProfile?.texts, key, vars);
  const extracted = await extractForText(input.text, extractionContext(company, baseQuestions));
  // WhatsApp und Telefon: statt PDF-Formulare zu schicken, deren Angaben einzeln abfragen (optionale Zusatzfragen).
  const formChannel = input.channel === "whatsapp" || input.channel === "phone";
  const serviceGuess = existing?.fields.service || extracted.service || "";
  // Mit eigener WhatsApp-Liste gilt bei WhatsApp nur diese (siehe withAppliesTo) – dann keine Formular-Fragen zusätzlich.
  const ownWhatsAppList = input.channel === "whatsapp" && Boolean(company.businessProfile?.whatsappQuestions?.length);
  const questions = formChannel && serviceGuess && !ownWhatsAppList ? [...baseQuestions, ...(await templateQuestionsFor(store, templates, serviceGuess).catch(() => []))] : baseQuestions;

  const known: Record<string, string> = {};
  if (input.identity?.email) known.email = input.identity.email.toLowerCase();
  if (input.identity?.phone) known.phone = normalizePhone(input.identity.phone).display;
  if (input.identity?.name) known.name = input.identity.name;
  // Anrufer: Kontakt läuft über die Telefonnummer – nach der E-Mail-Adresse fragt die KI am Telefon nicht (siehe isRelevant).
  if (input.channel === "phone") known[CONTACT_CHANNEL_KEY] = "Telefon";
  if (input.channel === "whatsapp") known[CONTACT_CHANNEL_KEY] = "WhatsApp";
  const startFields = existing?.fields ?? (settings.autoReply ? known : { ...known, description: input.text.slice(0, 1000) });

  // WhatsApp: Zwischenfrage des Kunden mitten im Gespräch ("Haben Sie samstags offen?") – beantworten wie im Website-Chat
  // (Preise, Notfälle u. Ä. beantwortet die KI dabei nicht, sondern markiert den Fall für das Team) und danach mit der
  // offenen Frage weitermachen, statt die Zwischenfrage als Antwort zu werten.
  if (input.channel === "whatsapp" && existing && settings.autoReply && !silent) {
    const pendingQ = nextPending(questions, startFields);
    const answersPending = pendingQ && pendingQ.type !== "text" && parseAnswer(pendingQ, input.text).ok;
    if (input.text.includes("?") && !answersPending) return answerSideQuestion(store, existing, input, pendingQ?.prompt ?? "");
  }

  const turnSettings = settings.autoReply ? settings : { ...settings, autoFollowUp: false };
  const pendingBefore = nextPending(questions, startFields)?.key ?? null;
  const turn: TurnResult = applyTurn({ questions, settings: turnSettings, texts: company.businessProfile?.texts, fields: startFields, text: input.text, first, extracted, documents, channel: input.channel, foerderOverrides });

  // Eigener Termin-Hinweis je Leistung ersetzt die sonst feste, tonabhängige Standardformulierung
  // ("Ein Mitarbeiter meldet sich..."), sobald der Fall für diese Leistung fertig ist.
  if (turn.done && turn.fields.service && turn.replies.length) {
    const note = serviceMessages.find((m) => m.service === turn.fields.service)?.appointmentNote?.trim();
    if (note) turn.replies[turn.replies.length - 1] = note;
  }

  // E-Mail: Ist die Leistung unklar, stellt der Kunde eine Frage oder wünscht er persönlichen Kontakt, antwortet die
  // KI NICHT automatisch (keine Leistungs-Nachricht, keine Vorlage, kein Termin). Der Fall erscheint im Posteingang
  // unter "Aufmerksamkeit benötigt", und der Energieberater antwortet selbst.
  // Wartet der Fall schon auf eine persönliche Antwort des Büros, bleibt es dabei: Weitere Mails des Kunden (z. B.
  // „Ich warte noch auf eine Antwort“) dürfen nicht plötzlich eine automatische Antwort auslösen.
  const pendingAttention = input.channel === "email" && existing ? attentionOf(existing.fields) : "";
  let attention: string | null = input.forceAttention ?? (pendingAttention || null);
  // „Wissen & Preise“: Kann die KI eine Kundenfrage mit den Angaben des Betriebs sicher beantworten, antwortet sie selbst
  // (statt „Aufmerksamkeit benötigt“). Notfälle und Reklamationen gehen immer an den Betrieb.
  let knowledgeReply: string | null = null;
  const fromKnowledge = async (question: string) =>
    /^(notfall|reklamation|beschwerde)/i.test(question)
      ? null
      : answerFromKnowledge(input.text, knowledgeOf(company.businessProfile), { industry: company.businessProfile?.industry ?? "", companyName: company.name });
  // Termin absagen oder verschieben per E-Mail: Das klärt das Büro selbst (Kalender) – nicht still übergehen.
  // Termin absagen oder verschieben (auch per E-Mail) erledigt der Termin-Ablauf unten automatisch.
  const wantsApptChange = Boolean(existing && (existing.fields.apptStage ?? "") !== "" && (looksLikeCancellation(input.text) || looksLikeReschedule(input.text)));
  // Unklare Anfrage: einmal nachfragen statt sofort an den Betrieb; mehrere Leistungen: eine Antwort für alle.
  let clarify = false;
  let extraServices: string[] = [];
  // Anruf: Notfall, Reklamation, Preisfrage o. Ä. gleich zu Beginn → das Team ruft zurück, die KI fragt nur noch das Nötigste.
  if (!attention && (input.channel === "phone" || input.channel === "whatsapp") && first && settings.autoReply) {
    const question = await customerQuestion(
      input.text,
      company.businessProfile?.industry ? { industry: company.businessProfile.industry, humanTopics: company.businessProfile.humanTopics } : null,
    );
    if (question && input.channel === "whatsapp") knowledgeReply = await fromKnowledge(question);
    if (question && !knowledgeReply) attention = input.channel === "phone" ? `Anruf: ${question}` : `Frage des Kunden: ${question}`;
  }
  if (!attention && input.channel === "email" && settings.autoReply) {
    const service = turn.fields.service ?? "";
    // Termin-Betriebe ohne Einsatz vor Ort (Friseur, Werkstatt …): mehrere Leistungen sind ein Termin ("Schneiden und
    // Färben", "Inspektion und Reifenwechsel") – dann normal antworten. Bei Handwerkern sind es zwei Aufträge.
    const several = existing || company.businessProfile?.needsAddress === false ? [] : mentionedServices(input.text, company.services);
    if (turn.handoff) attention = "Kunde wünscht persönlichen Kontakt";
    // Mehrere angebotene Leistungen in einer Anfrage: nicht nur eine davon beantworten und die andere still übergehen.
    else if (several.length > 1) extraServices = several.filter((s) => s !== (service || several[0]));
    // Formular kommt nicht per E-Mail (Post, kein Drucker …): das klärt das Büro selbst.
    else if (existing && formNotByEmail(input.text)) attention = "Kunde schickt das Formular nicht per E-Mail (z. B. per Post) – bitte selbst klären";
    // Kunde zieht die Anfrage zurück: nicht mit "Vielen Dank, wir haben alles" antworten – das Büro entscheidet.
    else if (existing && looksLikeWithdrawal(input.text)) attention = "Kunde zieht die Anfrage zurück";
    else if (!service || service === "Sonstiges") {
      // Betriebe mit Profil: Ist es eine Reklamation, ein Notfall o. Ä., das als Grund nennen statt nur "Leistung nicht erkannt".
      const profile = company.businessProfile;
      const question = profile?.industry ? await customerQuestion(input.text, { industry: profile.industry, humanTopics: profile.humanTopics }) : null;
      if (question) knowledgeReply = await fromKnowledge(question);
      if (question && !knowledgeReply) attention = `Frage des Kunden: ${question}`;
      else if (!question && !existing?.fields.clarifyAsked) clarify = true;
      else if (!question) attention = "Leistung nicht erkannt";
    } else {
      const question = await customerQuestion(
        input.text,
        company.businessProfile?.industry ? { industry: company.businessProfile.industry, humanTopics: company.businessProfile.humanTopics } : null,
      );
      if (question) knowledgeReply = await fromKnowledge(question);
      if (question && !knowledgeReply) attention = `Frage des Kunden: ${question}`;
    }
  }

  const draft = {
    fields: turn.fields,
    customerName: turn.fields.name ?? existing?.customerName ?? "Unbekannt",
    service: turn.fields.service ?? existing?.service ?? "",
  };

  let caseId: string;
  if (existing) {
    caseId = existing.id;
    await store.updateCase(caseId, draft);
  } else {
    const created = await store.createCase({ ...draft, source: input.source, status: "NEW", assignedTo: null, summary: "" });
    caseId = created.id;
    await store.addEvent(caseId, "received", eventForSource(input.source, input.simulated));
  }

  // Kunde hat geantwortet: Erinnerungen wieder von vorn (falls später erneut etwas fehlt).
  if (existing && (existing.fields.reminderCount || existing.fields.noResponse)) await store.updateCase(caseId, { fields: { reminderCount: "", noResponse: "" }, keepTimestamp: true });
  if (extraServices.length) {
    await store.updateCase(caseId, { fields: { extraServices: extraServices.join(", ") }, keepTimestamp: true });
    await store.addEvent(caseId, "note", `Kunde fragt zusätzlich nach: ${extraServices.join(", ")} – die Antwort deckt alle Leistungen ab.`);
  }
  if (clarify) await store.updateCase(caseId, { fields: { clarifyAsked: "1" }, keepTimestamp: true });

  if (attention && attention === pendingAttention) {
    await store.addEvent(caseId, "handoff", "Kunde hat erneut geschrieben – der Fall wartet weiter auf Ihre persönliche Antwort (keine automatische Antwort).");
  } else if (attention) {
    await store.updateCase(caseId, { fields: { [ATTENTION_KEY]: attention } });
    await store.addEvent(caseId, "handoff", `Aufmerksamkeit benötigt (${attention}) – keine automatische Antwort, bitte selbst antworten.`);
  }

  const meta = { channel: input.channel, simulated: Boolean(input.simulated) };
  await store.addMessage(caseId, "user", input.text.slice(0, 2000), { ...meta, delivery: "delivered" });

  // Terminfrage/-bestätigung laufen als eigener kleiner Dialog NACH Abschluss der Datenerfassung: Antwortet der
  // Kunde in diesem Zustand, ersetzt die Terminantwort die sonst übliche „liegt bereits vor“-Floskel.
  const priorApptStage = existing?.fields.apptStage ?? "";
  const inAppointmentFlow = priorApptStage === "ask" || priorApptStage === "proposed";

  // Antworten der KI: im Website-Chat erscheinen sie sofort im Fenster und fragen aktiv fehlende Angaben ab
  // (passt zu einem laufenden Gespräch). Bei E-Mail NICHT, solange noch etwas fehlt (turn.done = false) –
  // dort soll laut Vorgabe nur die vom Büro selbst verfasste Leistungs-Nachricht (siehe Vorlagen-Block unten)
  // + ggf. PDF-Anhang raus, keine automatisch generierte Rückfrage-Liste ("Welche Art Gebäude...", "Baujahr...").
  // Sobald der Fall aber abgeschlossen ist (turn.done = true: Abschluss-Nachricht, Handoff, Terminbestätigung
  // o. Ä.), soll genau diese Abschlussmeldung auch per Mail raus – siehe Termin-Hinweis-Override oben.
  // Erste E-Mail, die schon alle Angaben enthält: keine Chat-Begrüßung ("Gerne! Das habe ich schon verstanden: …") –
  // der Kunde bekommt die Büro-Nachricht zur Leistung (unten) und ggf. den Terminhinweis.
  const firstCompleteEmail = input.channel === "email" && first && turn.done && Boolean(turn.fields.service);
  const replies = silent || attention || inAppointmentFlow || firstCompleteEmail || (input.channel === "email" && (!turn.done || wantsApptChange)) ? [] : [...turn.replies];
  // WhatsApp: Auch wenn das Team selbst antwortet, bekommt der Kunde sofort eine kurze Bestätigung (kein Schweigen im Chat).
  if (input.channel === "whatsapp" && attention && !silent) replies.push(T("whatsapp.handoff"));
  if (knowledgeReply && !silent && input.channel !== "email") replies.splice(replies.length ? 1 : 0, 0, knowledgeReply);
  // E-Mail an den Betrieb (Notfall, Reklamation, Frage …): Der Kunde bekommt sofort eine Eingangsbestätigung statt Stille –
  // nur beim ersten Mal (nicht bei jeder weiteren Mail, während der Fall auf die Antwort des Büros wartet).
  if (input.channel === "email" && attention && attention !== pendingAttention && !silent && settings.autoReply && !/zieht die Anfrage zurück|per Post/i.test(attention)) {
    const urgent = /notfall/i.test(attention) && company.phone ? ` ${T("email.urgentPhone", { telefon: company.phone })}` : "";
    replies.push(`${T("email.received")}${urgent}`);
  }
  if (clarify && !silent) replies.push(T("email.unclear", { liste: company.services.filter((s) => s !== "Sonstiges").slice(0, 8).join(", ") }));
  const label = (k: string) => questions.find((q) => q.key === k)?.label ?? FIELD_GROUPS.flatMap((g) => g.fields).find((f) => f.key === k)?.label ?? k;
  // Verlauf nur bei Neuem: mehrere Angaben auf einmal erkannt bzw. eine neue Frage gestellt (keine Wiederholungen).
  if (turn.recognizedKeys.length > 1 || (first && turn.recognizedKeys.length > 0)) await store.addEvent(caseId, "answer", `KI hat erkannt: ${turn.recognizedKeys.map(label).join(", ")}`);
  // "KI fragt nach" nur im Chat – per E-Mail stellt die KI keine einzelnen Rückfragen.
  if (isInteractive(input.channel) && turn.pendingKey && !turn.done && turn.pendingKey !== pendingBefore) await store.addEvent(caseId, "question", `KI fragt nach: ${label(turn.pendingKey)}`);
  if (turn.handoff) await store.addEvent(caseId, "handoff", "Kunde wünscht persönlichen Kontakt");
  if (turn.appointmentRequested) await store.addEvent(caseId, "appointment", "Kunde wünscht einen Termin");

  // Büro-Vorlage(n) und/oder eigene Leistungs-Nachricht automatisch mitschicken – siehe matchServiceMaterials
  // (Nachricht und Vorlage kommen vom Büro selbst, keine automatisch generierte Angaben-Checkliste). Vor refreshCase, damit der Fall
  // nicht in diesem Zug schon als "bereit zur Prüfung" gilt, obwohl gerade erst eine neue Vorlage aussteht.
  const caseNow = (await store.getCase(caseId))!;
  // Am Telefon keine Vorlagen-Links oder Anhänge vorlesen – die bekommt der Kunde, wenn das Team sich meldet.
  const material = attention || silent || formChannel ? null : await matchServiceMaterials(store, caseNow, templates, serviceMessages, input.channel);
  const attachments: InboundAttachment[] = material?.attachments ?? [];
  if (material) replies.push(...material.texts);
  if (knowledgeReply && !silent && input.channel === "email") replies.push(T("email.answer", { antwort: knowledgeReply }));

  // Nachbereitung: Vollständigkeit, Status, automatische Dokumentenanforderung.
  const refreshed = await refreshCase(store, caseId, {
    // Per E-Mail gibt es kein laufendes Gespräch: Hat die KI dem Kunden gerade Vorlage/Nachricht geschickt, liegt der
    // Ball beim Kunden ("Warten auf Kunde") statt dauerhaft "wird qualifiziert" zu zeigen.
    hint: turn.handoff || (input.channel === "email" && (existing || (material && (material.texts.length > 0 || material.attachments.length > 0)))) ? "waiting" : "chat",
    autoRequestDocs: settings.autoReply && !turn.handoff && !attention,
  });
  const { checklist } = refreshed;

  // Per E-Mail: Ist der Fall durch diese Antwort (z. B. nachgereichte Telefonnummer) vollständig geworden, die
  // Abschluss-Nachricht schicken – außer der Kunde bekommt in diesem Zug ohnehin die Büro-Nachricht/Vorlage.
  const completionIndex = input.channel === "email" && !attention && refreshed.becamePrepared && !material && !turn.done ? replies.length : -1;
  if (completionIndex >= 0) replies.push(await completionTextFor(store, refreshed.caseRecord.fields.service));

  let upload: UploadPrompt | null = null;
  // Nur klassische (vom Kunden angeforderte) Dokumentarten – Vorlagen-Rückläufer haben keinen festen
  // DocumentKind und laufen ausschließlich über den eigenen Upload-Seiten-Link oben.
  const openDocs = checklist.items.filter((i) => i.kind === "document" && i.required && !i.done && i.key.startsWith("doc:"));
  if (checklist.dataComplete && openDocs.length > 0 && settings.autoReply) {
    const token = await ensureUploadToken(store, refreshed.caseRecord);
    upload = {
      url: uploadUrl(token),
      items: checklist.items.filter((i) => i.kind === "document" && i.key.startsWith("doc:")).map((i) => ({ kind: i.key.replace("doc:", "") as DocumentKind, label: i.label, done: i.done, required: i.required })),
    };
    // Auch hier: die Textaufforderung ("Bitte senden Sie uns...") nur im Website-Chat, nicht per Mail (siehe oben).
    if (refreshed.requestedNow.length && (input.channel === "website" || input.channel === "whatsapp")) replies.push(T("forms.chatUpload", { liste: documentList(openDocs.map((i) => i.key.replace("doc:", "") as DocumentKind)) }));
  }

  // Terminvorschlag: Sobald der Fall vollständig ist (oder der Kunde ausdrücklich einen Termin wünscht),
  // fragt die KI nach passenden Wochentagen ODER einem konkreten Datum, sucht selbstständig einen freien
  // Termin (unter Berücksichtigung bestehender Termine UND vom Büro im Kalender eingetragener Blocker) und
  // lässt ihn vom Team freigeben: Der Kunde erfährt das genaue Datum bewusst NICHT direkt von der KI,
  // erst wenn ein Mitarbeiter den Vorschlag im Kalender akzeptiert (oder selbst einen anderen Termin
  // wählt), geht die Terminbestätigung per Mail an den Kunden raus (siehe /api/appointments/[id]/accept
  // und .../decline).
  if (settings.appointmentBooking && !turn.handoff && !attention && !silent) {
    const stage = refreshed.caseRecord.fields.apptStage ?? "";
    const vacation = settings.vacationFrom && settings.vacationUntil ? { from: settings.vacationFrom, until: settings.vacationUntil } : null;
    const slotBase = { workingDays: settings.workingDays, slotStart: settings.slotStart, slotEnd: settings.slotEnd, slotMinutes: settings.slotMinutes, maxAppointmentsPerDay: settings.maxAppointmentsPerDay, vacation };

    const pendingDefault = T("appointment.pending");
    const noSlot = T("appointment.noSlot");
    const bookSlot = async (slot: Date, pendingText: string = pendingDefault) => {
      const appt = await store.saveAppointment({ caseId, title: `Termin ${refreshed.caseRecord.customerName}`, startsAt: slot.toISOString(), durationMin: settings.slotMinutes, notes: "Automatisch von der KI vorgeschlagen – wartet auf Freigabe durch das Team", status: "proposed" });
      await store.updateCase(caseId, { fields: { apptStage: "proposed" } });
      await store.addEvent(caseId, "appointment", `Termin vorgeschlagen, wartet auf Freigabe: ${formatSlot(slot)}`);
      // „Termine automatisch bestätigen“: gleich die Bestätigung statt „ein Mitarbeiter bestätigt …“.
      const confirmed = await autoConfirmIfEnabled(store, appt.id);
      replies.push(confirmed ?? withoutRepeatedThanks(replies, pendingText));
    };

    /** Versucht zuerst ein konkretes Datum, sonst einen Wochentag-Bereich aus dem Kundentext zu lesen und vorzuschlagen. Gibt zurück, ob etwas erkannt wurde. */
    const resolveAndPropose = async (text: string, pendingText: string = pendingDefault): Promise<boolean> => {
      const existingAppts = await store.listAppointments();
      // Belegte Zeiten im verbundenen Outlook-Kalender auslassen (ohne Verbindung: leer).
      const blocked = await outlookBusy(companyId);
      const specificDate = parseSpecificDate(text);
      if (specificDate) {
        const exact = findSlotOnDate(specificDate, { ...slotBase, existing: existingAppts, blocked });
        if (exact.reason === "ok" && exact.slot) {
          await bookSlot(exact.slot, pendingText);
          return true;
        }
        const info =
          T(exact.reason === "not_a_working_day" ? "appointment.notWorkingDay" : exact.reason === "on_vacation" ? "appointment.vacation" : "appointment.fullyBooked", { datum: formatYmd(specificDate) });
        const alt = findNextSlot({ ...slotBase, customerDays: settings.workingDays, existing: existingAppts, blocked, from: ymdToDate(specificDate) });
        if (alt) {
          const appt = await store.saveAppointment({ caseId, title: `Termin ${refreshed.caseRecord.customerName}`, startsAt: alt.toISOString(), durationMin: settings.slotMinutes, notes: "Automatisch von der KI vorgeschlagen – wartet auf Freigabe durch das Team", status: "proposed" });
          await store.updateCase(caseId, { fields: { apptStage: "proposed" } });
          await store.addEvent(caseId, "appointment", `Wunschtermin nicht verfügbar, Alternative vorgeschlagen, wartet auf Freigabe: ${formatSlot(alt)}`);
          const confirmed = await autoConfirmIfEnabled(store, appt.id);
          replies.push(`${info} ${confirmed ?? pendingText}`);
        } else {
          await store.updateCase(caseId, { fields: { apptStage: "failed" } });
          replies.push(`${info} ${noSlot}`);
        }
        return true;
      }
      const days = parseAvailability(text);
      if (!days) return false;
      if (!days.some((d) => settings.workingDays.includes(d))) {
        // Keiner der genannten Tage ist überhaupt ein Bürotag – klar sagen, statt "nichts gefunden".
        await store.updateCase(caseId, { fields: { apptStage: "ask" } });
        replies.push(T("appointment.noOverlap", { tage: workingDayNames(settings.workingDays).join(", ") }));
        return true;
      }
      const slot = findNextSlot({ ...slotBase, customerDays: days, existing: existingAppts, blocked });
      if (slot) await bookSlot(slot, pendingText);
      else {
        await store.updateCase(caseId, { fields: { apptStage: "failed" } });
        replies.push(noSlot);
      }
      return true;
    };

    // Kunde sagt einen bereits bestätigten Termin ab. Nur innerhalb eines bekannten, bereits laufenden
    // Falls (existing) – bei der allerersten Nachricht eines unbekannten Absenders ignoriert die KI das
    // bewusst, sonst könnte eine völlig fremde Mail fälschlich einen Termin canceln.
    const confirmedAppt = existing ? (await store.listAppointments()).find((a) => a.caseId === caseId && (a.status === "confirmed" || a.status === "proposed")) : undefined;
    if (existing && confirmedAppt && (looksLikeCancellation(input.text) || (wantsApptChange && looksLikeReschedule(input.text)))) {
      await store.deleteAppointment(confirmedAppt.id);
      await removeAppointment(companyId, confirmedAppt.id);
      await store.addEvent(caseId, "appointment", `Termin vom Kunden ${looksLikeCancellation(input.text) ? "abgesagt" : "verschoben"}: ${formatSlot(new Date(confirmedAppt.startsAt))}`);
      await store.updateCase(caseId, { fields: { apptStage: "ask" } });
      // Schlägt der Kunde in derselben Nachricht gleich einen neuen Termin vor, direkt weitersuchen
      // (wieder nur "vorgeschlagen", wartet erneut auf Freigabe durchs Team) statt extra nachzufragen.
      if (!(await resolveAndPropose(input.text, T("appointment.rescheduled")))) replies.push(T("appointment.cancelled"));
    } else if (stage === "ask") {
      if (!(await resolveAndPropose(input.text))) replies.push(T("appointment.notUnderstood"));
      // Die aktive "Welche Tage passen Ihnen?"-Rückfrage ist wie der Frage-Flow eine reine
      // Website-Chat-Funktion. Per E-Mail fragt die KI nicht zusätzlich nach Terminwünschen, bucht aber
      // trotzdem automatisch den nächsten freien Termin, sobald der Fall (laut Vorlagen & Nachrichten
      // bzw. Dokumenten) komplett ist – der Berater braucht den Kalendereintrag unabhängig vom Kanal.
      // Nicht im selben Zug wie eine andere offene Frage (z. B. eine optionale Angabe): Sonst beantwortet der Kunde nur
      // die Terminfrage, und seine Antwort landet als Wert der anderen Angabe in der Fallakte.
    } else if (stage === "" && isInteractive(input.channel) && (turn.appointmentRequested || turn.complete) && !replies.some((r) => r.trim().endsWith("?"))) {
      await store.updateCase(caseId, { fields: { apptStage: "ask" } });
      replies.push(T("appointment.ask", { beispiel: availabilityExample(settings.workingDays) }));
    } else if (stage === "" && !isInteractive(input.channel) && (turn.appointmentRequested || checklist.missing.length === 0)) {
      const booking = await autoBookNextSlot(store, refreshed.caseRecord);
      if (booking) {
        // Abschluss-Nachricht und Terminhinweis in einem Satz statt doppeltem "Vielen Dank … ein Mitarbeiter …".
        if (completionIndex >= 0) replies[completionIndex] = await completionTextFor(store, refreshed.caseRecord.fields.service, { appointmentProposed: true, confirmedText: booking.confirmedText });
        else replies.push(booking.confirmedText ?? withoutRepeatedThanks(replies, pendingDefault));
      }
    }
    // stage "proposed"/"confirmed"/"failed": liegt beim Team bzw. ist bereits final – die KI sagt dazu nichts Neues mehr.
  }

  let delivered = true;
  let deliveryNote = "";
  // Website-Chat: jede Antwort eine eigene Sprechblase. E-Mail: alles in EINER Nachricht senden –
  // sonst bekäme der Kunde für einen einzigen Gesprächszug mehrere einzelne E-Mails.
  // WhatsApp: Sind alle Angaben da, einmal um die typischen Unterlagen (Fotos …) bitten – direkt im Chat schicken.
  if (input.channel === "whatsapp" && turn.done && !attention && !silent && company.businessProfile?.industry) {
    const svc = turn.fields.service ?? "";
    const docs = profileDocumentsFor(company.businessProfile, svc);
    if (docs.length && refreshed.caseRecord.fields.docsRequestedFor !== svc) {
      replies.push(T("whatsapp.documents", { liste: docs.join(", ") }));
      await store.updateCase(caseId, { fields: { docsRequestedFor: svc }, keepTimestamp: true });
    }
  }
  if (input.channel === "whatsapp") replies.splice(0, replies.length, ...polishWhatsAppReplies(replies, T("chat.done"), T("appointment.ask", { beispiel: availabilityExample(settings.workingDays) })));
  // WhatsApp: eine Nachricht pro Gesprächszug (wie E-Mail), statt mehrerer kurzer Nachrichten hintereinander.
  const joined = replies.length ? [replies.join("\n\n")] : [];
  // E-Mail mit Anrede und Gruß (bearbeitbar unter „Texte“); im Chat nicht.
  if (input.channel === "email" && joined.length) joined[0] = await frameEmail(store, joined[0], turn.fields.name);
  const outgoing = isInteractive(input.channel) && input.channel !== "whatsapp" ? replies : joined;
  for (const reply of outgoing) {
    const subject = serviceMessages.find((m) => m.service === turn.fields.service)?.subject?.trim() || undefined;
    const result = await deliverToCustomer({ companyId, channel: input.channel, email: turn.fields.email, phone: turn.fields.phone, text: reply, simulated: input.simulated, attachments, subject });
    if (!result.delivered) {
      delivered = false;
      deliveryNote = result.reason;
    }
    await store.addMessage(caseId, "assistant", reply, { ...meta, delivery: result.delivered ? "delivered" : "not_sent" });
  }

  return {
    sessionId: caseId,
    replies,
    quickReplies: turn.quickReplies,
    done: turn.done,
    completeness: checklist.percent,
    status: refreshed.caseRecord.status,
    fields: turn.fields,
    delivered,
    deliveryNote,
    upload,
    created: first,
  };
}

function eventForSource(source: CaseSource, simulated?: boolean) {
  const suffix = simulated ? " (Simulation)" : "";
  if (source === "email") return `Anfrage per E-Mail eingegangen${suffix}`;
  return `Anfrage über den Website-Chat eingegangen${suffix}`;
}


/** Feld: "1" = KI antwortet in diesem Chat nicht automatisch (Team hat übernommen). */
export const AI_PAUSED_KEY = "aiPaused";

/**
 * Letzte WhatsApp-Nachricht entwirren: Folgt noch die Terminfrage, nicht "Ein Mitarbeiter meldet sich" sagen und die
 * Frage ans Ende stellen (nach der Bitte um Fotos) – so gibt es genau eine offene Frage zum Schluss.
 */
export function polishWhatsAppReplies(replies: string[], doneText = "Vielen Dank, damit habe ich alle Angaben. Ein Mitarbeiter meldet sich bei Ihnen.", askText?: string): string[] {
  const ask = replies.find((r) => r === askText || r.startsWith("An welchen Wochentagen"));
  if (!ask) return replies;
  // Nur den Standard-Abschluss kürzen – eine eigene Fassung des Betriebs bleibt, wie sie ist.
  const short = doneText === "Vielen Dank, damit habe ich alle Angaben. Ein Mitarbeiter meldet sich bei Ihnen." ? "Vielen Dank, damit habe ich alle Angaben!" : doneText;
  return [...replies.filter((r) => r !== ask).map((r) => (r === doneText ? short : r)), ask];
}

/** Kein zweites "Vielen Dank!" direkt hinter einer Nachricht, die schon dankt ("Vielen Dank für Ihre Anfrage …"). */
export const withoutRepeatedThanks = (previous: string[], text: string) =>
  previous.some((r) => /vielen dank/i.test(r)) ? text.replace(/^Vielen Dank!\s*/, "") : text;

/** Nachricht bei pausierter KI nur speichern und dem Team zeigen ("Aufmerksamkeit benötigt"). */
async function recordWhilePaused(store: Store, existing: CaseRecord, input: IntakeInput): Promise<IntakeTurn> {
  await store.addMessage(existing.id, "user", input.text.slice(0, 2000), { channel: input.channel, simulated: Boolean(input.simulated), delivery: "delivered" });
  if (!attentionOf(existing.fields)) {
    await store.updateCase(existing.id, { fields: { [ATTENTION_KEY]: "Kunde hat im WhatsApp-Chat geantwortet" } });
    await store.addEvent(existing.id, "handoff", "Kunde hat geantwortet – die KI ist in diesem Chat pausiert, bitte selbst antworten.");
  }
  const current = (await store.getCase(existing.id)) ?? existing;
  return { sessionId: existing.id, replies: [], quickReplies: [], done: false, completeness: current.completeness, status: current.status, fields: current.fields, delivered: true, deliveryNote: "", upload: null, created: false };
}


/** Zwischenfrage im WhatsApp-Chat beantworten (siehe processIntakeMessage) und mit der offenen Frage weitermachen. */
async function answerSideQuestion(store: Store, existing: CaseRecord, input: IntakeInput, pendingPrompt: string): Promise<IntakeTurn> {
  const meta = { channel: input.channel, simulated: Boolean(input.simulated) };
  const history = (await store.listMessages(existing.id))
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-8)
    .map((m) => ({ role: m.role as "user" | "assistant", text: m.content.slice(0, 500) }));
  await store.addMessage(existing.id, "user", input.text.slice(0, 2000), { ...meta, delivery: "delivered" });
  const company = await store.getCompany();
  const texts = company.businessProfile?.texts;
  const known = obviousHumanQuestion(input.text) ? await answerFromKnowledge(input.text, knowledgeOf(company.businessProfile), { industry: company.businessProfile?.industry ?? "", companyName: company.name }) : null;
  const human = known ? null : obviousHumanQuestion(input.text);
  let answer: string;
  if (known) {
    answer = known;
  } else if (human) {
    answer = customerText(texts, "whatsapp.sideQuestion");
    await store.updateCase(existing.id, { fields: { [ATTENTION_KEY]: `Frage des Kunden: ${human}` } });
    await store.addEvent(existing.id, "handoff", `Aufmerksamkeit benötigt (Frage des Kunden per WhatsApp: ${human}).`);
  } else {
    answer = await answerWebsiteChat(store, input.text, history);
  }
  const text = pendingPrompt ? `${answer}

${customerText(texts, "whatsapp.backToRequest", { frage: pendingPrompt })}` : answer;
  const result = await deliverToCustomer({ companyId: input.companyId, channel: input.channel, email: existing.fields.email, phone: existing.fields.phone, text, simulated: input.simulated });
  await store.addMessage(existing.id, "assistant", text, { ...meta, delivery: result.delivered ? "delivered" : "not_sent" });
  const current = (await store.getCase(existing.id)) ?? existing;
  return {
    sessionId: existing.id,
    replies: [text],
    quickReplies: [],
    done: false,
    completeness: current.completeness,
    status: current.status,
    fields: current.fields,
    delivered: result.delivered,
    deliveryNote: result.reason,
    upload: null,
    created: false,
  };
}

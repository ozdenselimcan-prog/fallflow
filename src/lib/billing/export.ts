import { strToU8, zipSync, type Zippable } from "fflate";
import { DOCUMENT_LABELS, FIELD_GROUPS, STATUS_LABELS } from "@/lib/cases/fields";
import { FORM_ENTRIES_KEY } from "@/lib/cases/form-entries";
import type { Store } from "@/lib/data/store";
import type { CaseRecord } from "@/lib/data/types";
import { readFile } from "@/lib/documents/storage";

const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "");

/** CSV mit Semikolon und BOM – öffnet sich in Excel direkt korrekt (Umlaute, Spalten). */
function csv(rows: string[][]): Uint8Array {
  const cell = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return strToU8(`﻿${rows.map((r) => r.map((v) => cell(v ?? "")).join(";")).join("\r\n")}`);
}

/** Datei-/Ordnernamen ohne Sonderzeichen. */
const safe = (s: string, max = 60) =>
  s
    .normalize("NFKD")
    .replace(/[^\w.\- äöüÄÖÜß]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, max) || "unbenannt";

const FIELD_COLUMNS = FIELD_GROUPS.flatMap((g) => g.fields);

function caseText(c: CaseRecord, messages: { role: string; content: string; createdAt: string; channel: string }[], events: { text: string; createdAt: string }[]): string {
  const lines: string[] = [];
  lines.push(`Fallakte – ${c.customerName}`, `Fall-ID: ${c.id}`, `Erstellt: ${fmt(c.createdAt)} · Zuletzt aktiv: ${fmt(c.updatedAt)}`, `Status: ${STATUS_LABELS[c.status]} · Vollständigkeit: ${c.completeness} %`, "");
  lines.push("ANGABEN");
  for (const f of FIELD_COLUMNS) if (c.fields[f.key]) lines.push(`${f.label}: ${c.fields[f.key]}`);
  if (c.fields[FORM_ENTRIES_KEY]) lines.push("", "WEITERE ANGABEN AUS FORMULAREN", c.fields[FORM_ENTRIES_KEY]);
  if (c.summary) lines.push("", "ZUSAMMENFASSUNG", c.summary);
  lines.push("", "NACHRICHTEN");
  for (const m of messages) lines.push(`[${fmt(m.createdAt)}] ${m.role === "user" ? "Kunde" : m.role === "staff" ? "Büro" : "Assistent"} (${m.channel}):`, m.content, "");
  lines.push("VERLAUF");
  for (const e of events) lines.push(`[${fmt(e.createdAt)}] ${e.text}`);
  return lines.join("\n");
}

/**
 * Alle Daten eines Büros als ZIP: Übersicht aller Fälle (CSV), je Fall eine Fallakte (Text) mit allen Dokumenten,
 * Termine (CSV) und die eigenen PDF-Vorlagen. Damit kann ein Büro seine Daten vor Vertragsende vollständig sichern.
 */
export async function buildCompanyExport(store: Store): Promise<Uint8Array> {
  const [company, cases, documents, appointments, templates] = await Promise.all([store.getCompany(), store.listCases(), store.listDocuments(), store.listAppointments(), store.listDocumentTemplates()]);
  const files: Zippable = {};

  files["README.txt"] = strToU8(
    [
      `Datenexport von FallFlow – ${company.name}`,
      `Erstellt am ${fmt(new Date().toISOString())}`,
      "",
      "faelle.csv       Übersicht aller Fälle (öffnet sich in Excel)",
      "faelle/          je Fall ein Ordner mit fallakte.txt (Angaben, Nachrichten, Verlauf) und allen Dokumenten",
      "termine.csv      alle Termine",
      "vorlagen/        Ihre PDF-Vorlagen",
    ].join("\n"),
  );

  files["faelle.csv"] = csv([
    ["Fall-ID", "Erstellt", "Status", "Vollständigkeit %", ...FIELD_COLUMNS.map((f) => f.label), "Zusammenfassung"],
    ...cases.map((c) => [c.id, fmt(c.createdAt), STATUS_LABELS[c.status], String(c.completeness), ...FIELD_COLUMNS.map((f) => c.fields[f.key] ?? ""), c.summary]),
  ]);

  const caseFolder = new Map<string, string>();
  for (const c of cases) {
    const folder = `faelle/${c.createdAt.slice(0, 10)}_${safe(c.customerName, 40)}_${c.id.slice(0, 8)}`;
    caseFolder.set(c.id, folder);
    const [messages, events] = await Promise.all([store.listMessages(c.id), store.listEvents(c.id)]);
    files[`${folder}/fallakte.txt`] = strToU8(caseText(c, messages, events));
  }

  const used = new Set<string>();
  for (const d of documents.filter((x) => x.status === "received" && x.storagePath && caseFolder.has(x.caseId))) {
    const file = await readFile(d.storagePath);
    if (!file) continue;
    let name = `${caseFolder.get(d.caseId)}/dokumente/${safe(d.fileName || DOCUMENT_LABELS[d.kind], 80)}`;
    if (!/\.[a-z0-9]{2,4}$/i.test(name)) name += d.mimeType === "application/pdf" ? ".pdf" : "";
    for (let i = 2; used.has(name); i++) name = name.replace(/(\.[a-z0-9]+)?$/i, `_${i}$1`);
    used.add(name);
    files[name] = [file.bytes, { level: 0 }];
  }

  const nameOf = new Map(cases.map((c) => [c.id, c.customerName]));
  files["termine.csv"] = csv([
    ["Beginn", "Dauer (Min.)", "Titel", "Status", "Kunde", "Notiz"],
    ...appointments.map((a) => [fmt(a.startsAt), String(a.durationMin), a.title, a.status === "confirmed" ? "bestätigt" : "vorgeschlagen", a.caseId ? (nameOf.get(a.caseId) ?? "") : "", a.notes ?? ""]),
  ]);

  for (const t of templates) {
    const file = await readFile(t.storagePath);
    if (file) files[`vorlagen/${safe(t.title, 60)}.pdf`] = [file.bytes, { level: 0 }];
  }

  return zipSync(files, { level: 6 });
}

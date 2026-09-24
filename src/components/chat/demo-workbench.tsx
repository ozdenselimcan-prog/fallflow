"use client";

import { CheckCircle2, Circle, FileUp, RotateCcw, Sparkles, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { applyTurn } from "@/lib/ai/conversation";
import { heuristicExtract } from "@/lib/ai/heuristic";
import { buildSummary } from "@/lib/cases/completeness";
import { DEFAULT_ASSISTANT, STATUS_LABELS } from "@/lib/cases/fields";
import { seedQuestions } from "@/lib/data/seed";
import type { CaseDocument, CaseStatus, DocumentKind } from "@/lib/data/types";
import { buildChecklist, deriveStatus, missingLabel, readinessOf, READINESS_LABELS } from "@/lib/intake/checklist";
import { chatDocumentPrompt } from "@/lib/intake/messages";
import { cn } from "@/lib/utils";
import { ChatClient, type ChatSendContext, type ChatTurn, type ChatUpload } from "./chat-client";

const questions = seedQuestions();
const settings = { ...DEFAULT_ASSISTANT };

const SUGGESTIONS: Record<string, string> = {
  __first: "Hallo, wir haben ein Einfamilienhaus von 1987 mit 160 qm und möchten einen iSFP.",
  heating: "Gas",
  ownerStatus: "Eigentümer",
  street: "Gartenweg 12",
  postalCode: "82166",
  floors: "2",
  name: "Max Mustermann",
  email: "max.mustermann@example.com",
  phone: "+49 170 1234567",
};

const mkDoc = (kind: DocumentKind, status: CaseDocument["status"]): CaseDocument => ({
  id: `${kind}-${status}`,
  caseId: "demo",
  companyId: "demo",
  kind,
  status,
  fileName: status === "received" ? "Demo-Datei.pdf" : "",
  mimeType: "",
  size: 0,
  storagePath: "",
  requestedAt: new Date().toISOString(),
  receivedAt: status === "received" ? new Date().toISOString() : null,
});

interface View {
  fields: Record<string, string>;
  docs: CaseDocument[];
  status: CaseStatus;
  started: boolean;
}
const EMPTY: View = { fields: {}, docs: [], status: "NEW", started: false };

/**
 * Komplett lokale Demo (ohne Server): dieselbe Gesprächs- und Vollständigkeitslogik wie im echten Produkt,
 * regelbasierte Extraktion. Der Dokument-Upload ist hier simuliert und als Demo gekennzeichnet.
 */
export function DemoWorkbench({ compact = false }: { compact?: boolean }) {
  const [run, setRun] = useState(0);
  const [view, setView] = useState<View>(EMPTY);
  const ref = useRef<View>(EMPTY);

  const commit = (next: View) => {
    ref.current = next;
    setView(next);
  };

  const send = useCallback(async (text: string, ctx: ChatSendContext): Promise<ChatTurn> => {
    const prev = ref.current;
    const turn = applyTurn({ questions, settings, fields: ctx.fields, text, first: ctx.first, extracted: heuristicExtract(text), documents: prev.docs });
    const replies = [...turn.replies];
    let docs = prev.docs;
    let checklist = buildChecklist({ questions, fields: turn.fields, documents: docs });

    // Schritt 7/8: fehlendes Dokument erkennen und automatisch anfordern.
    if (checklist.dataComplete && checklist.unrequestedDocuments.length > 0) {
      const kinds = checklist.unrequestedDocuments.map((i) => i.key.replace("doc:", "") as DocumentKind);
      docs = [...docs, ...kinds.map((k) => mkDoc(k, "requested"))];
      replies.push(chatDocumentPrompt(kinds));
      checklist = buildChecklist({ questions, fields: turn.fields, documents: docs });
    }
    const status = deriveStatus(prev.status, checklist, "chat");
    commit({ fields: turn.fields, docs, status, started: true });

    const open = checklist.items.some((i) => i.kind === "document" && i.required && !i.done);
    const upload: ChatUpload | null =
      checklist.dataComplete && open
        ? { url: "#demo", items: checklist.items.filter((i) => i.kind === "document").map((i) => ({ kind: i.key.replace("doc:", ""), label: i.label, done: i.done, required: i.required })) }
        : null;
    return { ...turn, replies, completeness: checklist.percent, upload };
  }, []);

  const simulateUpload = (kind: string) => {
    const prev = ref.current;
    const docs = [...prev.docs.filter((d) => !(d.kind === kind && d.status === "requested")), mkDoc(kind as DocumentKind, "received")];
    const checklist = buildChecklist({ questions, fields: prev.fields, documents: docs });
    commit({ ...prev, docs, status: deriveStatus(prev.status, checklist, "edit") });
  };

  const checklist = buildChecklist({ questions, fields: view.fields, documents: view.docs });
  const readiness = readinessOf(view.status, checklist);
  const ready = view.status === "READY_FOR_REVIEW";
  const complete = checklist.percent >= 100;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex h-[32rem] flex-col overflow-hidden rounded-2xl border border-border shadow-sm sm:h-[36rem]">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{settings.name} · Website-Chat</p>
            <p className="text-xs text-muted-foreground">Demo – keine echten Daten</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRun((r) => r + 1);
              commit(EMPTY);
            }}
          >
            <RotateCcw className="size-3.5" /> Neu starten
          </Button>
        </div>
        <ChatClient
          key={run}
          assistantName={settings.name}
          greeting={settings.greeting}
          send={send}
          suggestions={SUGGESTIONS}
          className="flex-1"
          renderUpload={(u) => (
            <ul className="space-y-2">
              {u.items.map((i) => {
                const done = view.docs.some((d) => d.kind === i.kind && d.status === "received");
                return (
                  <li key={i.kind} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      {done ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <FileUp className="size-4 text-muted-foreground" aria-hidden />}
                      {i.label}
                      {i.required === false && <span className="text-xs text-muted-foreground">(optional)</span>}
                    </span>
                    <Button variant="secondary" size="sm" disabled={done} onClick={() => simulateUpload(i.kind)}>
                      {done ? "Erhalten" : "Demo-Datei hochladen"}
                    </Button>
                  </li>
                );
              })}
              <li className="text-xs text-muted-foreground">Im echten Produkt lädt der Kunde hier PDF oder Foto hoch – geprüft, verschlüsselt und nicht öffentlich.</li>
            </ul>
          )}
        />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Live entstehende Fallakte</p>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground">BERATUNGSFALL</span>
            <Badge tone={ready ? "success" : view.started ? "accent" : "neutral"}>{STATUS_LABELS[view.status]}</Badge>
          </div>
          <p className="mt-3 text-lg font-semibold">{view.fields.name || <span className="text-muted-foreground">Name folgt …</span>}</p>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Completeness Score</span>
              <span className="flex items-center gap-1 font-semibold">
                {complete && <CheckCircle2 className="size-4 text-success" aria-hidden />}
                {checklist.percent} %
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={checklist.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Vollständigkeit">
              <div className={cn("h-full rounded-full transition-all duration-500", complete ? "bg-success" : "bg-accent")} style={{ width: `${checklist.percent}%` }} />
            </div>
            <p className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>{view.started ? missingLabel(checklist.missing.length) : "Noch keine Angaben"}</span>
              <span>{READINESS_LABELS[readiness]}</span>
            </p>
          </div>

          <ul className="mt-4 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            {checklist.items.map((item) => (
              <li key={item.key} className="flex items-center gap-2">
                {item.done ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="vorhanden" /> : item.required ? <X className="size-4 shrink-0 text-danger/70" aria-label="fehlt" /> : <Circle className="size-4 shrink-0 text-muted-foreground/40" aria-label="optional" />}
                <span className={cn(!item.done && "text-muted-foreground")}>{item.label}</span>
                {item.kind === "document" && !item.done && item.requested && <Badge tone="warning">angefordert</Badge>}
              </li>
            ))}
          </ul>

          {view.started && !checklist.dataComplete && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              KI sammelt gerade die fehlenden Informationen
            </p>
          )}
          {checklist.dataComplete && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-background px-3 py-2 text-sm">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span>
                <span className="font-medium">Zusammenfassung: </span>
                {buildSummary(view.fields)}
              </span>
            </p>
          )}
        </div>

        <div className={cn("rounded-2xl border p-4 text-sm transition-colors", ready ? "border-success/40 bg-success-soft" : "border-dashed border-border bg-card text-muted-foreground")}>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground">DASHBOARD DES ENERGIEBERATERS</p>
          {ready ? (
            <p className="mt-1.5 font-medium text-success">
              1 neuer fertiger Beratungsfall – {view.fields.name} ({view.fields.service}) ist bereit zur Prüfung.
            </p>
          ) : (
            <p className="mt-1.5">Sobald alle Angaben vorliegen, erscheint hier der fertige Beratungsfall.</p>
          )}
        </div>

        {!compact && (
          <p className="text-xs text-muted-foreground">
            Die Demo läuft vollständig im Browser mit regelbasierter Auswertung. Im Produktivbetrieb kann zusätzlich ein KI-Modell die Freitext-Nachrichten auswerten – Gesprächsführung, Vollständigkeitsprüfung und Statuslogik bleiben regelbasiert und nachvollziehbar.
          </p>
        )}
      </div>
    </div>
  );
}

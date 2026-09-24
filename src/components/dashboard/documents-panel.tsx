"use client";

import { Check, Clipboard, Download, FileWarning, Mail, Send } from "lucide-react";
import { useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { DOCUMENT_LABELS } from "@/lib/cases/fields";
import type { DocumentKind } from "@/lib/data/types";
import { apiFetch, useMutation } from "@/lib/use-api";
import { formatDateTime } from "@/lib/utils";

export interface DocView {
  id: string;
  kind: DocumentKind;
  status: "requested" | "received";
  fileName: string;
  size: number;
  requestedAt: string;
  receivedAt: string | null;
}

export interface DocRequirementView {
  kind: DocumentKind;
  required: boolean;
}

interface Props {
  caseId: string;
  documents: DocView[];
  requirements: DocRequirementView[];
  customerName: string;
  email: string;
  /** Gültiger Upload-Link des Falls (falls schon erzeugt) */
  uploadLink: string | null;
  canWrite: boolean;
}

const WITH_ARTICLE: Record<DocumentKind, string> = {
  floorplan: "der Grundriss",
  energy_certificate: "der Energieausweis",
  photos: "Fotos",
  other: "weitere Unterlagen",
};

const size = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

interface RequestResult {
  url: string;
  message: string;
  delivered: boolean;
  reason: string;
}

export function DocumentsPanel({ caseId, documents, requirements, customerName, email, uploadLink, canWrite }: Props) {
  const { pending, error, run } = useMutation();
  const [result, setResult] = useState<RequestResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const received = (kind: DocumentKind) => documents.filter((d) => d.kind === kind && d.status === "received");
  const requestedOnly = (kind: DocumentKind) => documents.some((d) => d.kind === kind && d.status === "requested") && received(kind).length === 0;
  const missing = requirements.filter((r) => r.required && received(r.kind).length === 0);
  const extraKinds = (["photos", "other"] as DocumentKind[]).filter((k) => !requirements.some((r) => r.kind === k) && received(k).length > 0);
  const rows: { kind: DocumentKind; required: boolean }[] = [...requirements, ...extraKinds.map((kind) => ({ kind, required: false }))];

  async function request() {
    const res = await run(() => apiFetch<RequestResult & { email: string }>("POST", `/api/cases/${caseId}/documents`, {}));
    if (res) setResult(res);
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  const link = result?.url ?? uploadLink;
  const mailto = result && email ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Unterlagen für Ihren Beratungstermin")}&body=${encodeURIComponent(result.message)}` : undefined;

  return (
    <Card>
      <CardHeader title="Dokumente" description="Grundriss, Energieausweis, Fotos und sonstige Unterlagen" />
      <div className="space-y-4 px-5 py-4">
        {missing.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-soft px-4 py-3">
            <p className="flex items-start gap-2 text-sm text-warning">
              <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Für diesen Beratungsfall fehlt noch {missing.map((m) => WITH_ARTICLE[m.kind]).join(" und ")}.
              </span>
            </p>
            {canWrite && (
              <Button size="sm" onClick={request} loading={pending}>
                <Send className="size-3.5" /> Dokument beim Kunden anfordern
              </Button>
            )}
          </div>
        )}
        {error && <Notice tone="error">{error}</Notice>}

        {result && (
          <div className="space-y-3 rounded-xl border border-border bg-background p-4">
            {result.delivered ? (
              <Notice tone="success">Die Anforderung wurde an {customerName} gesendet.</Notice>
            ) : (
              <Notice tone="info">
                Anforderung vorbereitet – <strong>noch nicht versendet</strong>. {result.reason} Kopieren Sie die Nachricht oder öffnen Sie sie in Ihrem E-Mail-Programm.
              </Notice>
            )}
            <pre className="max-h-48 overflow-auto rounded-lg bg-card p-3 text-xs leading-relaxed whitespace-pre-wrap">{result.message}</pre>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => copy("msg", result.message)}>
                {copied === "msg" ? <Check className="size-3.5" /> : <Clipboard className="size-3.5" />} Nachricht kopieren
              </Button>
              {mailto && (
                <a href={mailto} className={buttonStyles({ variant: "secondary", size: "sm" })}>
                  <Mail className="size-3.5" /> In E-Mail-Programm öffnen
                </a>
              )}
            </div>
          </div>
        )}

        <ul className="divide-y divide-border">
          {rows.map(({ kind, required }) => {
            const files = received(kind);
            return (
              <li key={kind} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {DOCUMENT_LABELS[kind]} {!required && <span className="font-normal text-muted-foreground">(optional)</span>}
                  </p>
                  {files.length > 0 ? <Badge tone="success">Erhalten</Badge> : requestedOnly(kind) ? <Badge tone="warning">Angefordert</Badge> : required ? <Badge tone="danger">Fehlt</Badge> : <Badge>Nicht vorhanden</Badge>}
                </div>
                {files.map((f) => (
                  <div key={f.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      {f.fileName} <span className="text-xs text-muted-foreground">· {size(f.size)} · {f.receivedAt ? formatDateTime(f.receivedAt) : ""}</span>
                    </span>
                    <a href={`/api/documents/${f.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                      <Download className="size-3.5" aria-hidden /> Herunterladen
                    </a>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>

        {link && canWrite && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <span>Sicherer Upload-Link des Kunden:</span>
            <Button variant="ghost" size="sm" onClick={() => copy("link", link)}>
              {copied === "link" ? <Check className="size-3.5" /> : <Clipboard className="size-3.5" />} Link kopieren
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

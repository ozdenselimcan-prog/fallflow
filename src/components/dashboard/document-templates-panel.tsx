"use client";

import { FileText, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { SERVICES } from "@/lib/cases/fields";
import { apiFetch, useMutation } from "@/lib/use-api";

export interface DocumentTemplateView {
  id: string;
  service: string;
  title: string;
  fileName: string;
}

/**
 * Büro-eigene PDF-Vorlagen (z. B. Vollmachten), je einer Leistung zugeordnet. Die KI schickt die passende
 * Vorlage automatisch als Download-Link mit, sobald sie bei einer Kundenanfrage die Leistung erkennt.
 */
export function DocumentTemplatesPanel({ initial, canEdit }: { initial: DocumentTemplateView[]; canEdit: boolean }) {
  const [templates, setTemplates] = useState(initial);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { pending, run } = useMutation();
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploadError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/document-templates", { method: "POST", body: form });
      const data = (await res.json()) as { template?: DocumentTemplateView; suggested?: boolean; error?: string };
      if (!res.ok || !data.template) throw new Error(data.error ?? "Hochladen fehlgeschlagen");
      setTemplates((prev) => [...prev, data.template!]);
      if (!data.suggested) setUploadError(`„${data.template.fileName}“ hochgeladen – die Leistung konnte nicht automatisch erkannt werden, bitte unten auswählen.`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Hochladen fehlgeschlagen");
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void upload(file);
  };

  const setService = async (id: string, service: string) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, service } : t)));
    await run(() => apiFetch("PUT", `/api/document-templates/${id}`, { service }), { refresh: false });
  };

  const remove = async (id: string) => {
    const ok = await run(() => apiFetch("DELETE", `/api/document-templates/${id}`), { refresh: false });
    if (ok) setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">PDF-Vorlagen (z. B. Vollmachten)</h2>
          <p className="text-sm text-muted-foreground">
            Laden Sie Ihre Vorlagen hoch und ordnen Sie jede einer Leistung zu. Erkennt die KI diese Leistung bei einer Anfrage, schickt sie dem Kunden automatisch einen Download-Link zu dieser Vorlage.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
            <Select className="!h-9 w-auto" value={t.service} disabled={!canEdit || pending} onChange={(e) => setService(t.id, e.target.value)}>
              <option value="">Leistung wählen…</option>
              {SERVICES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            {canEdit && (
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => remove(t.id)}>
                <Trash2 className="size-3.5 text-danger" />
              </Button>
            )}
          </div>
        ))}
        {templates.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Vorlagen hochgeladen.</p>}
      </div>

      {uploadError && (
        <div className="mt-3">
          <Notice>{uploadError}</Notice>
        </div>
      )}

      {canEdit && (
        <div className="mt-4">
          <input ref={fileInput} type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />
          <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
            <Upload className="size-3.5" /> PDF hochladen
          </Button>
        </div>
      )}
    </Card>
  );
}

"use client";

import { Check, FileText, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch } from "@/lib/use-api";

export interface ServiceMessageView {
  service: string;
  body: string;
}
export interface ServiceTemplateView {
  id: string;
  service: string;
  title: string;
  fileName: string;
}

const DEFAULT_BODY = (service: string) => `Für Ihr Anliegen (${service}) benötigen wir zusätzlich die ausgefüllte Vorlage. Bitte laden Sie sich das Dokument herunter, füllen es aus und schicken es uns wieder zu.`;

/**
 * Pro ausgewählter Leistung: eigener Nachrichtentext, der zusätzlich zu den Vorlagen-Links verschickt wird,
 * sobald die KI die Leistung bei einer Kundenanfrage erkennt – und direkt hier die passende PDF-Vorlage
 * hochladen/ändern, ohne zwischen Schritten wechseln zu müssen.
 */
export function ServiceMessagesPanel({ services, initialMessages, initialTemplates, canEdit }: { services: string[]; initialMessages: ServiceMessageView[]; initialTemplates: ServiceTemplateView[]; canEdit: boolean }) {
  const [bodies, setBodies] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of services) map[s] = initialMessages.find((m) => m.service === s)?.body ?? DEFAULT_BODY(s);
    return map;
  });
  const [templates, setTemplates] = useState(initialTemplates);
  const [savedService, setSavedService] = useState<string | null>(null);
  const [busyService, setBusyService] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const save = async (service: string) => {
    setError(null);
    setBusyService(service);
    try {
      await apiFetch("PUT", "/api/service-messages", { service, body: bodies[service] ?? "" });
      setSavedService(service);
      setTimeout(() => setSavedService((s) => (s === service ? null : s)), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setBusyService(null);
    }
  };

  const uploadTemplate = async (service: string, file: File) => {
    setError(null);
    setBusyService(service);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/document-templates", { method: "POST", body: form });
      const data = (await res.json()) as { template?: ServiceTemplateView; error?: string };
      if (!res.ok || !data.template) throw new Error(data.error ?? "Hochladen fehlgeschlagen");
      // KI-Vorschlag kann abweichen – hier ist die Leistung aus dem Kontext bereits bekannt, also fest zuweisen.
      await apiFetch("PUT", `/api/document-templates/${data.template.id}`, { service });
      setTemplates((prev) => [...prev.filter((t) => t.service !== service), { ...data.template!, service }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hochladen fehlgeschlagen");
    } finally {
      setBusyService(null);
    }
  };

  const removeTemplate = async (id: string) => {
    setError(null);
    await fetch(`/api/document-templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  if (services.length === 0) {
    return <p className="text-sm text-muted-foreground">Wählen Sie zuerst mindestens eine Leistung aus.</p>;
  }

  return (
    <div className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}
      {services.map((service) => {
        const template = templates.find((t) => t.service === service);
        return (
          <Card key={service} className="p-4">
            <h3 className="font-semibold">{service}</h3>
            <div className="mt-2.5">
              {template ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{template.title}</span>
                  {canEdit && (
                    <Button variant="ghost" size="sm" onClick={() => removeTemplate(template.id)}>
                      <Trash2 className="size-3.5 text-danger" />
                    </Button>
                  )}
                </div>
              ) : (
                canEdit && (
                  <div>
                    <input
                      ref={(el) => {
                        fileInputs.current[service] = el;
                      }}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void uploadTemplate(service, file);
                      }}
                    />
                    <Button variant="secondary" size="sm" loading={busyService === service} onClick={() => fileInputs.current[service]?.click()}>
                      <Upload className="size-3.5" /> PDF-Vorlage hinzufügen (optional)
                    </Button>
                  </div>
                )
              )}
            </div>
            <div className="mt-3">
              <Textarea rows={3} disabled={!canEdit} value={bodies[service] ?? ""} onChange={(e) => setBodies({ ...bodies, [service]: e.target.value })} />
              {canEdit && (
                <div className="mt-2 flex items-center gap-2">
                  <Button variant="secondary" size="sm" loading={busyService === service} onClick={() => save(service)}>
                    Nachricht speichern
                  </Button>
                  {savedService === service && (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <Check className="size-3.5" /> Gespeichert
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

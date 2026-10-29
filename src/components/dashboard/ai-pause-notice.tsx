"use client";

import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";
import { apiFetch, useMutation } from "@/lib/use-api";

/** Hinweis in der Fallakte: KI ist in diesem WhatsApp-Chat pausiert, weil das Team selbst geantwortet hat. */
export function AiPauseNotice({ caseId, canWrite }: { caseId: string; canWrite: boolean }) {
  const { pending, run } = useMutation();
  return (
    <Notice>
      <span className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Bot className="size-4 shrink-0" aria-hidden />
          Die KI antwortet in diesem WhatsApp-Chat gerade nicht, weil Sie selbst geantwortet haben. Neue Nachrichten des Kunden landen bei Ihnen.
        </span>
        {canWrite && (
          <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => apiFetch("PATCH", `/api/cases/${caseId}`, { resumeAi: true }))}>
            KI antwortet wieder
          </Button>
        )}
      </span>
    </Notice>
  );
}

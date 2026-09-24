"use client";

import { useCallback } from "react";
import { ChatClient, type ChatSendContext, type ChatTurn } from "@/components/chat/chat-client";
import { Card, CardHeader } from "@/components/ui/card";
import { apiFetch } from "@/lib/use-api";

/** Testet den Assistenten mit den gespeicherten Einstellungen. Es wird kein Fall angelegt. */
export function AssistantPreview({ name, greeting }: { name: string; greeting: string }) {
  const send = useCallback((text: string, ctx: ChatSendContext) => apiFetch<ChatTurn>("POST", "/api/ai/chat", { text, first: ctx.first, fields: ctx.fields }), []);
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Vorschau" description="Speichern Sie zuerst Änderungen, dann testen Sie hier. Es wird nichts gespeichert." />
      <div className="h-[28rem]">
        <ChatClient assistantName={name} greeting={greeting} send={send} />
      </div>
    </Card>
  );
}

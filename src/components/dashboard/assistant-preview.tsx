"use client";

import { useCallback } from "react";
import { ChatClient, type ChatSendContext, type ChatTurn } from "@/components/chat/chat-client";
import { Card, CardHeader } from "@/components/ui/card";
import { apiFetch } from "@/lib/use-api";

/** Testet den Website-Chat mit den gespeicherten Einstellungen. Es wird nichts gespeichert. */
export function AssistantPreview({ name, greeting }: { name: string; greeting: string }) {
  const send = useCallback((text: string, ctx: ChatSendContext) => apiFetch<ChatTurn>("POST", "/api/ai/chat", { text, history: ctx.history }), []);
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Vorschau Website-Chat" description="Stellen Sie hier Fragen wie ein Website-Besucher. Speichern Sie zuerst Änderungen – es wird nichts gespeichert." />
      <div className="h-[28rem]">
        <ChatClient assistantName={name} greeting={greeting} send={send} />
      </div>
    </Card>
  );
}

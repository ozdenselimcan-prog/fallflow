"use client";

import { Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { ROLE_LABELS } from "@/lib/cases/fields";
import type { Member, Role } from "@/lib/data/types";
import { apiFetch, useMutation } from "@/lib/use-api";

export function TeamManager({ members, canManage }: { members: Member[]; canManage: boolean }) {
  const { pending, error, run } = useMutation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<Role, "OWNER">>("MEMBER");

  return (
    <div className="space-y-6">
      {canManage && (
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Mitarbeiter hinzufügen</h2>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_11rem_auto] sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(() => apiFetch("POST", "/api/team", { email, role }));
              if (ok) setEmail("");
            }}
          >
            <Field label="E-Mail">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} />
            </Field>
            <Field label="Rolle">
              <Select value={role} onChange={(e) => setRole(e.target.value as Exclude<Role, "OWNER">)}>
                <option value="MEMBER">{ROLE_LABELS.MEMBER}</option>
                <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
              </Select>
            </Field>
            <Button type="submit" loading={pending}>
              <UserPlus className="size-4" /> Einladen
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Die Einladung wird gespeichert und automatisch angenommen, sobald sich die Person mit dieser E-Mail-Adresse registriert. Es wird keine E-Mail versendet.
          </p>
        </Card>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      <Card className="divide-y divide-border">
        {members.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{m.name || m.email}</p>
              {m.name && <p className="truncate text-sm text-muted-foreground">{m.email}</p>}
            </div>
            <div className="flex items-center gap-3">
              {m.status === "invited" && <Badge tone="warning">Eingeladen</Badge>}
              {canManage && m.role !== "OWNER" ? (
                <Select
                  aria-label={`Rolle von ${m.email}`}
                  className="h-9 w-36"
                  value={m.role}
                  disabled={pending}
                  onChange={(e) => run(() => apiFetch("PATCH", "/api/team", { id: m.id, role: e.target.value }))}
                >
                  <option value="MEMBER">{ROLE_LABELS.MEMBER}</option>
                  <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                </Select>
              ) : (
                <Badge tone={m.role === "OWNER" ? "accent" : "neutral"}>{ROLE_LABELS[m.role]}</Badge>
              )}
              {canManage && m.role !== "OWNER" && (
                <Button variant="ghost" size="sm" aria-label={`${m.email} entfernen`} disabled={pending} onClick={() => run(() => apiFetch("DELETE", `/api/team?id=${encodeURIComponent(m.id)}`))}>
                  <Trash2 className="size-4 text-danger" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

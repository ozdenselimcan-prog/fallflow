"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BusinessProfileEditor, type ProfileDraft } from "@/components/onboarding/business-profile-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { apiFetch, useMutation } from "@/lib/use-api";

/** Betriebsprofil nachträglich ändern (Branche, Leistungen, Angaben, Unterlagen, Themen für den Menschen). */
export function BusinessProfileCard({ initial, website, canEdit }: { initial: ProfileDraft; website: string; canEdit: boolean }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useMutation();
  const valid = profile.industry.trim() && profile.services.length > 0;

  async function save() {
    setSaved(false);
    const ok = await run(() => apiFetch("PUT", "/api/business-profile", profile), { refresh: false });
    if (ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <Card className="p-5">
      <fieldset disabled={!canEdit || pending} className="space-y-6">
        <BusinessProfileEditor
          value={profile}
          onChange={(v) => {
            setProfile(v);
            setSaved(false);
          }}
          website={website}
        />
      </fieldset>
      <div className="mt-6 space-y-3">
        {error && <Notice tone="error">{error}</Notice>}
        {!valid && <Notice>Bitte Branche und mindestens eine Leistung angeben.</Notice>}
        {canEdit ? (
          <div className="flex items-center gap-3">
            <Button onClick={save} loading={pending} disabled={!valid}>
              Speichern
            </Button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-success">
                <Check className="size-4" /> Gespeichert – der Assistent arbeitet ab sofort damit.
              </span>
            )}
          </div>
        ) : (
          <Notice>Nur Inhaber und Admins können das Betriebsprofil ändern.</Notice>
        )}
      </div>
    </Card>
  );
}

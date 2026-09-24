# FallFlow

**AI Intake & Operations für Energieberater.** Von der ersten Kundenanfrage zum vollständig vorbereiteten Beratungsfall – automatisch.

FallFlow ist kein CRM und kein allgemeiner Chatbot. Es übernimmt genau den Teil zwischen Anfrage und Beratung:

Kundenanfrage → KI erkennt Angaben → fragt nur Fehlendes → sammelt Dokumente → prüft Vollständigkeit → fasst nach → legt die Fallakte an → Berater übernimmt.

## Tech Stack

Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript strict, Tailwind CSS 4, Supabase (Auth + Postgres + RLS + Storage), Zod. KI über eine OpenAI-kompatible API, ausschließlich serverseitig.

## Schnellstart (Demo-Modus, ohne externe Dienste)

```bash
npm install
npm run dev        # http://localhost:3000
```

Ohne Supabase-Variablen läuft die App im **Demo-Modus** (Daten im Arbeitsspeicher, Seed „BA Engineering & Consulting“ mit 7 Fällen). Ohne `AI_API_KEY` extrahiert ein regelbasierter Mock Angaben aus Freitext. Nützliche URLs: `/demo` (komplette Demo, läuft im Browser), `/dashboard`, `/dashboard/intake`, `/dashboard/inbox`, `/widget/demo` (echter Website-Chat gegen die API), `/upload/demo-upload-weber` (Kunden-Upload).

## Produktmodell

| Konzept | Umsetzung |
|---|---|
| **Intake-Status** | `NEW → QUALIFYING → WAITING_FOR_CUSTOMER → COMPLETE → READY_FOR_REVIEW → CONVERTED` ([types.ts](src/lib/data/types.ts), Logik in [checklist.ts](src/lib/intake/checklist.ts)) |
| **Completeness Score** | Anteil erfüllter Pflichtpunkte in % = Pflichtangaben (Fragen-Builder) + Pflichtdokumente. Dynamisch aus den Falldaten berechnet, nie manuell gesetzt. |
| **Dokumentenbedarf** | Grundriss immer; Energieausweis bei Beratungsleistungen (nicht beim Energieausweis selbst); Fotos optional (`documentRequirements`). |
| **Lead-Readiness** | Reiner Prozessstatus: Unvollständig / Fast vollständig (≤ 2 fehlen) / Vollständig (100 %) / Bereit zur Bearbeitung. Keine Kaufwahrscheinlichkeit. |
| **Statusregeln** | `COMPLETE` = alle Pflichtangaben da, Dokumente noch nicht angefordert. `READY_FOR_REVIEW` = Angaben da und Dokumente erhalten **oder angefordert** (Fall kann übernommen werden, Upload kann folgen). Ein laufendes Gespräch ohne Aktivität > 30 Min. wird als `WAITING_FOR_CUSTOMER` angezeigt (abgeleitet, nicht gespeichert). |
| **Dynamischer Frage-Flow** | [conversation.ts](src/lib/ai/conversation.ts): jede Nachricht wird ausgewertet (KI oder Regeln), bekannte Angaben übernommen, nur relevante fehlende erfragt (`isRelevant`). Keine Beratung, nichts erfunden. |
| **Automatik** | [case-ops.ts](src/lib/intake/case-ops.ts) `refreshCase`: Score, Status, Zusammenfassung, automatische Dokumentenanforderung, Follow-up-Planung nach jeder Änderung. |

## Environment Variables

Siehe [.env.example](.env.example).

| Variable | Zweck |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Öffentliche URL (Upload-Links, OAuth-Redirects, Widget-Snippet) – in Produktion **nicht** `localhost` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase; wenn gesetzt → Produktivmodus |
| `SUPABASE_SERVICE_ROLE_KEY` | Nur serverseitig: Widget, Kunden-Upload, Datei-Speicher, Cron |
| `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` | OpenAI-kompatibles Modell (optional; Extraktion und Zusammenfassung) |
| `CRON_SECRET` | Schützt `/api/cron/follow-ups` (Vercel-Cron, siehe [vercel.json](vercel.json)) |
| `GOOGLE_*`, `MICROSOFT_*` | E-Mail-OAuth (vorbereitet) |
| `WHATSAPP_*` | WhatsApp Business; Empfang zusätzlich nur mit `WHATSAPP_APP_SECRET` (Signaturprüfung) und `WHATSAPP_COMPANY_ID` |
| `STRIPE_*` | Abrechnung (vorbereitet) |

## Supabase Setup

1. Projekt anlegen.
2. Migrationen der Reihe nach ausführen: [0001_init.sql](supabase/migrations/0001_init.sql), dann [0002_intake.sql](supabase/migrations/0002_intake.sql) (neue Status, `case_documents`, `follow_ups`, Kanal-Metadaten, privater Bucket `case-documents`, neue Standardfragen; migriert bestehende Daten).
3. Auth → URL Configuration: Site URL = `NEXT_PUBLIC_APP_URL`, Redirect URL `…/auth/callback`.
4. Keys eintragen; optional Demo-Daten mit [seed.sql](supabase/seed.sql).

**Sicherheit:** RLS auf allen Tabellen (`is_member`/`has_role`). Kundendateien liegen in einem **privaten** Bucket ohne Policies für `anon`/`authenticated` – Zugriff nur per Service Role: Upload über `/api/upload/[token]`, Download nur angemeldet über `/api/documents/[id]` (Company-gefiltert, `Content-Disposition: attachment`, `nosniff`).

## Architektur

- `src/lib/data/` – `Store`-Interface mit `memory.ts` (Demo) und `supabase.ts` (RLS).
- `src/lib/intake/` – `checklist.ts` (rein, auch im Browser), `engine.ts` (Kundennachricht → Fall), `case-ops.ts` (Refresh, Dokumentenanforderung, Follow-ups), `router.ts` + `identity.ts` (eingehende Nachrichten Kunde/Fall zuordnen), `follow-ups.ts`, `notes.ts`, `attention.ts`, `messages.ts`.
- `src/lib/ai/` – Gesprächslogik, Zod-validierte Extraktion und Zusammenfassung mit regelbasiertem Fallback.
- `src/lib/integrations/` – E-Mail-/WhatsApp-Adapter; `outbound.ts` liefert nur `delivered: true`, wenn wirklich versendet wurde.
- `src/lib/documents/storage.ts` – Upload-Validierung (Magic Bytes, 10 MB, PDF/JPG/PNG/WebP) und Speicher.

## Ehrlicher Integrationsstatus („keine Fake-Erfolge“)

- **Website-Chat:** produktiv.
- **E-Mail / WhatsApp:** Adapter vorhanden, Versand und Postfach-Abruf **nicht implementiert**. Ausgehende Nachrichten werden als „nicht versendet“ gespeichert und im Dashboard so gezeigt; fällige Follow-ups erscheinen mit fertigem Text zum manuellen Versand. Der Posteingang zeigt Kanäle als „nicht verbunden · Demo-Modus“.
- **Eingang simulieren** (Posteingang): spielt eine WhatsApp-/E-Mail-Nachricht durch die echte Verarbeitung (Kunde erkennen → Fall zuordnen → KI reagiert); alles ist als **Simulation** markiert.
- **WhatsApp-Webhook:** verarbeitet Nachrichten nur mit Signaturprüfung und `WHATSAPP_COMPANY_ID`.
- **Follow-ups:** Cron (täglich, Vercel Hobby) versendet nur über verbundene Kanäle, sonst → „manuell senden“.

## Entwicklung

```bash
npm run lint
npm run typecheck
npm run build && npm start
```

## Bekannte Grenzen

- Die SQL-Migrationen wurden nicht gegen eine echte Supabase-Instanz ausgeführt; der Supabase-Store ist getypt und gebaut, aber ungetestet.
- Kein Virenscan für Uploads (nur Typ-/Größenprüfung).
- In-Memory-Rate-Limit gilt pro Instanz.
- Team-Einladungen werden nicht per E-Mail versendet; Stripe und Kalender-Sync nicht enthalten.
- Datenschutz/Impressum sind Platzhalter und ersetzen keine Rechtsprüfung.

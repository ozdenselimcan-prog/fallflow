# FallFlow

FallFlow verwandelt unvollständige Kundenanfragen in strukturierte, möglichst vollständige Beratungsfälle – für Energieberatungsbüros in Deutschland. Ein Website-Chat fragt fehlende Angaben (Gebäudeart, Baujahr, Wohnfläche, PLZ, Heizung, Anliegen …) automatisch ab; das Büro erhält den fertigen Fall im Dashboard.

## Tech Stack

Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript strict, Tailwind CSS 4, Lucide, Supabase (Auth + Postgres + RLS), Zod, React Hook Form. KI über eine OpenAI-kompatible API, ausschließlich serverseitig.

## Schnellstart (Demo-Modus, ohne externe Dienste)

```bash
npm install
npm run dev        # http://localhost:3000
```

Ohne Supabase-Variablen läuft die App im **Demo-Modus**: Login/Signup führen direkt ins Dashboard, Daten (Seed: „BA Engineering & Consulting“, 5 Fälle) liegen im Arbeitsspeicher und werden beim Neustart zurückgesetzt. Ohne `AI_API_KEY` extrahiert ein regelbasierter Mock Angaben aus Freitext. Nützliche URLs: `/demo`, `/dashboard`, `/widget-test.html` (simulierte Kunden-Website mit eingebettetem Widget).

## Environment Variables

Siehe [.env.example](.env.example); kopieren nach `.env.local`.

| Variable | Zweck |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Öffentliche URL (OAuth-Redirects, Widget-Snippet) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase; wenn gesetzt → Produktivmodus |
| `SUPABASE_SERVICE_ROLE_KEY` | Nur serverseitig; nötig für Widget/Webhooks (umgeht RLS, daher immer auf eine Company begrenzt) |
| `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` | OpenAI-kompatibles Modell (optional) |
| `GOOGLE_*`, `MICROSOFT_*` | E-Mail-OAuth (vorbereitet) |
| `WHATSAPP_*` | WhatsApp Business (vorbereitet) |
| `STRIPE_*` | Abrechnung (vorbereitet) |

## Supabase Setup

1. Projekt auf supabase.com anlegen.
2. Migration ausführen: [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql) im SQL-Editor ausführen (oder `supabase db push`). Sie legt Tabellen, RLS-Policies und den Signup-Trigger an, der pro neuem Konto Büro, Owner-Mitgliedschaft, Standardfragen, Assistent und Kanäle erzeugt bzw. eine offene Team-Einladung annimmt.
3. Auth → URL Configuration: Site URL = `NEXT_PUBLIC_APP_URL`, Redirect URL `…/auth/callback`.
4. Keys in `.env.local` eintragen.
5. Optional Demo-Daten: in der App registrieren, dann [supabase/seed.sql](supabase/seed.sql) mit Ihrer E-Mail ausführen.

**Mandantentrennung:** Alle Tabellen haben RLS über `is_member(company_id)` / `has_role(...)`; Kindtabellen sind per zusammengesetztem Fremdschlüssel `(case_id, company_id)` an denselben Mandanten gebunden. Konfiguration (Assistent, Fragen, Kanäle, Team, Firma) dürfen nur OWNER/ADMIN schreiben; `subscriptions` nur die Service Role.

## Architektur

- `src/lib/data/` – `Store`-Interface mit `memory.ts` (Demo) und `supabase.ts` (RLS). Dashboard und API nutzen nur `getStore(session)`.
- `src/lib/ai/` – `conversation.ts` (deterministische Gesprächslogik: sammelt nur Angaben, keine Beratung), `provider.ts`, `case-extractor.ts` (Zod-validierte Extraktion, Fallback auf `heuristic.ts` bei ungültiger Antwort, Fehler-Log ohne Nutzertext), `prompts.ts`, `schema.ts`.
- `src/lib/widget/service.ts` – Chat → Fall, Nachrichten, Ereignisse, Vollständigkeit.
- `src/lib/api.ts` – `withSession` (Auth, Origin-/CSRF-Check, Rechte, Rate-Limit) und `publicRoute`.
- `src/lib/integrations/` – `EmailProvider` (Gmail/Microsoft) und `WhatsAppProvider` als Adapter.
- `public/widget.js` – Embed-Script (Button + iframe auf `/widget/[companyId]`).

```html
<script src="https://APP-DOMAIN/widget.js" data-company-id="COMPANY_ID"></script>
```

## AI Setup

`AI_API_KEY` und optional `AI_MODEL` (Standard `gpt-4o-mini`) setzen; für andere OpenAI-kompatible Anbieter `AI_BASE_URL`. Die KI wertet nur die erste Freitext-Anfrage aus; jede Antwort wird gegen ein Zod-Schema und Plausibilitätsgrenzen geprüft. Vor dem Produktivbetrieb Auftragsverarbeitung mit dem KI-Anbieter klären.

## OAuth Setup (Gmail / Microsoft 365)

Ohne Credentials zeigt das Dashboard „nicht verbunden“ und nennt die fehlenden Variablen. Mit Credentials wird die echte Autorisierungs-URL erzeugt (Redirect-URI: `NEXT_PUBLIC_APP_URL/api/integrations/gmail` bzw. `/microsoft`). **Offen (TODO, braucht echte Credentials):** Token-Austausch, verschlüsselte Token-Ablage (`channels.token_ref`), Postfach-Abruf und Versand in `gmail.ts`/`microsoft.ts`.

## WhatsApp Setup

Webhook `/api/webhooks/whatsapp` (Verify-Handshake und Parser vorhanden; ohne Credentials Mock-Antwort). **Offen (TODO):** Signaturprüfung (`X-Hub-Signature-256`), Zuordnung Phone-Number-ID → Company, Versand.

## Development / Production Build

```bash
npm run lint
npm run typecheck
npm run build && npm start
```

## Deployment

Beliebiger Next.js-Host (z. B. Vercel): Environment Variables setzen, Migration ausführen. `next.config.ts` setzt Security-Header; nur `/widget/*` darf geframed werden. Das In-Memory-Rate-Limit (`src/lib/rate-limit.ts`) gilt pro Instanz – bei mehreren Instanzen durch einen geteilten Store ersetzen.

## Bekannte Grenzen

- Team-Einladungen werden gespeichert, aber nicht per E-Mail versendet.
- Stripe nur vorbereitet (Upgrade-Button deaktiviert ohne Keys).
- Kalender-Sync (Google/Microsoft) nicht enthalten.
- Datenschutz/Impressum sind Platzhalter (`[FIRMENNAME]` …) und ersetzen keine Rechtsprüfung.
- Die SQL-Migration wurde nicht gegen eine echte Supabase-Instanz ausgeführt; der Supabase-Store ist getypt und gebaut, aber ungetestet.

-- Eigener, editierbarer Text je Leistung fuer den "ein Mitarbeiter meldet sich wegen des Termins"-Hinweis,
-- der sonst nur eine feste, vom Ton abhaengige Standardformulierung ist (siehe src/lib/ai/conversation.ts).
alter table public.service_messages add column appointment_note text not null default '';

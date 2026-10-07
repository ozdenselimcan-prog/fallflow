-- Haelt fest, ob die KI eine zurueckgeschickte Vorlage tatsaechlich als ausgefuellt einschaetzt (nicht nur
-- "erhalten") - damit eine erkennbar leere/unvollstaendige PDF den Fall nicht faelschlich als fertig gelten laesst.
alter table public.template_documents add column filled boolean;

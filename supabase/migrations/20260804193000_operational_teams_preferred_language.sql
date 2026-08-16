-- Idioma preferido da equipe (mensagens WhatsApp de designação: pt | en | es)

ALTER TABLE public.operational_teams
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'pt';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'operational_teams_preferred_language_check'
  ) THEN
    ALTER TABLE public.operational_teams
      ADD CONSTRAINT operational_teams_preferred_language_check
      CHECK (preferred_language IN ('pt', 'en', 'es'));
  END IF;
END $$;

COMMENT ON COLUMN public.operational_teams.preferred_language IS
  'Idioma das mensagens de designação WhatsApp (pt, en, es).';

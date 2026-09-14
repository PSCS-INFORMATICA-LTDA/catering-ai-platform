-- =============================================================================
-- Commercial Review / Proposal Workspace V1 — DEV ONLY
-- Target: Catering AI DEV (yasprgtlqclwsjcshtls). Never apply to PROD.
--
-- Minimum columns required to:
--   1) keep internal commercial notes off the public proposal / PDF;
--   2) pin a shared proposal to a specific quote_version + actor.
--
-- Reuses quotes + quote_versions. No new table. No PSCS One FK.
-- Idempotent.
-- =============================================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS proposal_shared_version_id uuid,
  ADD COLUMN IF NOT EXISTS proposal_shared_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quotes_proposal_shared_version_fk'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_proposal_shared_version_fk
      FOREIGN KEY (proposal_shared_version_id)
      REFERENCES public.quote_versions (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quotes_proposal_shared_version
  ON public.quotes (proposal_shared_version_id)
  WHERE proposal_shared_version_id IS NOT NULL;

COMMENT ON COLUMN public.quotes.internal_notes IS
  'Internal commercial note. Never copy into public proposal, PDF, or quote_versions.commercial_snapshot.';
COMMENT ON COLUMN public.quotes.proposal_shared_version_id IS
  'quote_versions.id pinned when the proposal was last marked sent. Future quote edits must not rewrite that shared version.';
COMMENT ON COLUMN public.quotes.proposal_shared_by IS
  'App user id of the actor who last marked the proposal sent. PSCS One Identity mapping is future-only; no remote FK.';

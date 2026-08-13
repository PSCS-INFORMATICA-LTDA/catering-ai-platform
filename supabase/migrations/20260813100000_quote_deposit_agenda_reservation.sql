-- =============================================================================
-- Quote deposit → agenda reservation (before OS)
-- DEV ONLY: yasprgtlqclwsjcshtls
--
-- - team_id nullable (reserva sem equipe)
-- - status 'reserved' = sinal confirmado, ainda sem OS/equipe final
-- - um evento ativo por quote_id
-- =============================================================================

-- Allow reserved status
ALTER TABLE public.agenda_events
  DROP CONSTRAINT IF EXISTS agenda_events_status_check;

ALTER TABLE public.agenda_events
  ADD CONSTRAINT agenda_events_status_check
  CHECK (status IN ('reserved', 'scheduled', 'completed', 'cancelled'));

-- Team optional until designation
ALTER TABLE public.agenda_events
  ALTER COLUMN team_id DROP NOT NULL;

COMMENT ON COLUMN public.agenda_events.team_id IS
  'Equipe designada. NULL permitido enquanto status=reserved (sinal confirmado, sem escala).';

COMMENT ON COLUMN public.agenda_events.status IS
  'reserved=sinal confirmado; scheduled=equipe/OS planejada; completed; cancelled.';

ALTER TABLE public.agenda_events
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

ALTER TABLE public.agenda_events
  ADD COLUMN IF NOT EXISTS cancelled_by uuid;

COMMENT ON COLUMN public.agenda_events.cancelled_at IS
  'Quando a reserva/agenda foi cancelada (histórico preservado).';

COMMENT ON COLUMN public.agenda_events.cancelled_by IS
  'Usuário que cancelou a reserva (auth.users / profiles).';

-- Deduplicate active rows per quote before unique index (keep best: has OS, then newest)
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY company_id, quote_id
      ORDER BY
        (service_order_id IS NOT NULL) DESC,
        created_at DESC NULLS LAST
    ) AS rn
  FROM public.agenda_events
  WHERE quote_id IS NOT NULL
    AND status IS DISTINCT FROM 'cancelled'
)
UPDATE public.agenda_events ae
SET
  status = 'cancelled',
  cancelled_at = COALESCE(ae.cancelled_at, now()),
  notes = CASE
    WHEN ae.notes IS NULL OR btrim(ae.notes) = '' THEN
      'Cancelado: dedupe uq_agenda_events_quote_active'
    ELSE
      ae.notes || ' | dedupe uq_agenda_events_quote_active'
  END,
  updated_at = now()
FROM ranked r
WHERE ae.id = r.id
  AND r.rn > 1;

-- One active agenda event per quote (idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS uq_agenda_events_quote_active
  ON public.agenda_events (company_id, quote_id)
  WHERE quote_id IS NOT NULL AND status IS DISTINCT FROM 'cancelled';

CREATE INDEX IF NOT EXISTS idx_agenda_events_company_date_status
  ON public.agenda_events (company_id, event_date, status);

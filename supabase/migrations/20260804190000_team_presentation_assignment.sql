-- =============================================================================
-- Horário de apresentação + designação da equipe (padrão Logistics)
-- Ambiente-alvo: DEV. Idempotente.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- quotes: apresentação + equipe designada
-- ---------------------------------------------------------------------------

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS team_presentation_time time without time zone,
  ADD COLUMN IF NOT EXISTS designated_team_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quotes_designated_team_id_fkey'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_designated_team_id_fkey
      FOREIGN KEY (designated_team_id)
      REFERENCES public.operational_teams (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quotes_designated_team
  ON public.quotes (designated_team_id)
  WHERE designated_team_id IS NOT NULL;

COMMENT ON COLUMN public.quotes.team_presentation_time IS
  'Horário de apresentação da equipe no local (mesmo dia do evento).';
COMMENT ON COLUMN public.quotes.designated_team_id IS
  'Equipe operacional designada após aceite do cliente.';

-- ---------------------------------------------------------------------------
-- agenda_events: apresentação + token de aceite da equipe
-- ---------------------------------------------------------------------------

ALTER TABLE public.agenda_events
  ADD COLUMN IF NOT EXISTS presentation_time time without time zone,
  ADD COLUMN IF NOT EXISTS team_assignment_token text,
  ADD COLUMN IF NOT EXISTS team_assignment_response text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS team_assignment_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS team_assignment_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS team_assignment_rejected_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agenda_events_team_assignment_response_check'
  ) THEN
    ALTER TABLE public.agenda_events
      ADD CONSTRAINT agenda_events_team_assignment_response_check
      CHECK (team_assignment_response IN ('pending', 'accepted', 'rejected'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_events_team_assignment_token
  ON public.agenda_events (team_assignment_token)
  WHERE team_assignment_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agenda_events_quote_id
  ON public.agenda_events (quote_id)
  WHERE quote_id IS NOT NULL;

COMMENT ON COLUMN public.agenda_events.presentation_time IS
  'Horário de apresentação da equipe no local.';
COMMENT ON COLUMN public.agenda_events.team_assignment_token IS
  'Token público para aceite/recusa da designação (sem login).';
COMMENT ON COLUMN public.agenda_events.team_assignment_response IS
  'Resposta da equipe: pending, accepted ou rejected.';

-- ---------------------------------------------------------------------------
-- Público (anon) via token
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_team_assignment(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evt public.agenda_events%ROWTYPE;
  v_company_name TEXT;
  v_team_name TEXT;
  v_address TEXT;
  v_quote_number TEXT;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT e.*
  INTO v_evt
  FROM public.agenda_events e
  WHERE e.team_assignment_token = trim(p_token);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT COALESCE(c.trade_name, c.name)
  INTO v_company_name
  FROM public.companies c
  WHERE c.id = v_evt.company_id;

  SELECT t.name
  INTO v_team_name
  FROM public.operational_teams t
  WHERE t.id = v_evt.team_id;

  IF v_evt.quote_id IS NOT NULL THEN
    SELECT q.quote_number
    INTO v_quote_number
    FROM public.quotes q
    WHERE q.id = v_evt.quote_id;

    SELECT NULLIF(
      trim(
        concat_ws(
          ', ',
          NULLIF(trim(COALESCE(ev.address_line, '')), ''),
          NULLIF(trim(COALESCE(ev.city, '')), ''),
          NULLIF(trim(COALESCE(ev.state, '')), '')
        )
      ),
      ''
    )
    INTO v_address
    FROM public.quotes q
    LEFT JOIN public.events ev ON ev.id = q.event_id
    WHERE q.id = v_evt.quote_id;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'company_name', v_company_name,
    'team_assignment_response', v_evt.team_assignment_response,
    'team_assignment_sent_at', v_evt.team_assignment_sent_at,
    'can_respond', (
      v_evt.team_assignment_response = 'pending'
      AND v_evt.team_assignment_sent_at IS NOT NULL
      AND v_evt.status = 'scheduled'
    ),
    'assignment', jsonb_build_object(
      'event_id', v_evt.id,
      'code', v_evt.code,
      'title', v_evt.title,
      'client_name', v_evt.client_name,
      'team_name', v_team_name,
      'event_date', v_evt.event_date,
      'start_time', v_evt.start_time,
      'end_time', v_evt.end_time,
      'presentation_time', v_evt.presentation_time,
      'address', v_address,
      'quote_number', v_quote_number,
      'status', v_evt.status
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_team_assignment(p_token TEXT, p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evt public.agenda_events%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  IF p_action NOT IN ('accept', 'reject') THEN
    RAISE EXCEPTION 'Ação inválida';
  END IF;

  SELECT * INTO v_evt
  FROM public.agenda_events
  WHERE team_assignment_token = trim(p_token)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Designação não encontrada';
  END IF;

  IF v_evt.team_assignment_sent_at IS NULL THEN
    RAISE EXCEPTION 'Designação ainda não foi enviada à equipe';
  END IF;

  IF v_evt.team_assignment_response <> 'pending' THEN
    RAISE EXCEPTION 'Designação já respondida';
  END IF;

  IF v_evt.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Evento não está mais agendado';
  END IF;

  IF p_action = 'accept' THEN
    UPDATE public.agenda_events
    SET
      team_assignment_response = 'accepted',
      team_assignment_accepted_at = NOW(),
      updated_at = NOW()
    WHERE id = v_evt.id;
  ELSE
    UPDATE public.agenda_events
    SET
      team_assignment_response = 'rejected',
      team_assignment_rejected_at = NOW(),
      status = 'cancelled',
      updated_at = NOW()
    WHERE id = v_evt.id;
  END IF;

  RETURN jsonb_build_object(
    'team_assignment_response', (
      SELECT team_assignment_response FROM public.agenda_events WHERE id = v_evt.id
    ),
    'status', (
      SELECT status FROM public.agenda_events WHERE id = v_evt.id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_team_assignment(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_team_assignment(TEXT, TEXT) TO anon, authenticated;

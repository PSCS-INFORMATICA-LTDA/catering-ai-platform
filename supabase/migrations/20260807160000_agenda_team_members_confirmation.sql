-- =============================================================================
-- Agenda multi-evento + membros de equipe + confirmação individual
-- Ambiente-alvo: Supabase DEV ONLY (yasprgtlqclwsjcshtls)
-- Idempotente. NÃO aplicar em Production nesta atividade.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Remove bloqueio "1 evento / equipe / dia" → overlap por horário
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS public.uq_agenda_events_team_day_active;

-- ---------------------------------------------------------------------------
-- 2) Funções operacionais da Pessoa (Address Book = customers)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_operational_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  role_key text NOT NULL
    CHECK (role_key IN (
      'team_leader',
      'grill_master',
      'assistant',
      'preparation'
    )),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_operational_roles_unique
    UNIQUE (company_id, person_id, role_key)
);

CREATE INDEX IF NOT EXISTS idx_customer_operational_roles_person
  ON public.customer_operational_roles (company_id, person_id)
  WHERE active IS TRUE;

COMMENT ON TABLE public.customer_operational_roles IS
  'Funções operacionais da Pessoa (líder, churrasqueiro, ajudante, preparação). Rótulos i18n no app.';

-- ---------------------------------------------------------------------------
-- 3) Composição da equipe (Pessoas com função)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.operational_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.operational_teams (id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  role_key text NOT NULL
    CHECK (role_key IN (
      'team_leader',
      'grill_master',
      'assistant',
      'preparation'
    )),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_team_members_unique_active
    UNIQUE (team_id, person_id, role_key)
);

CREATE INDEX IF NOT EXISTS idx_operational_team_members_team
  ON public.operational_team_members (company_id, team_id)
  WHERE active IS TRUE;

CREATE INDEX IF NOT EXISTS idx_operational_team_members_person
  ON public.operational_team_members (company_id, person_id)
  WHERE active IS TRUE;

COMMENT ON TABLE public.operational_team_members IS
  'Membros da equipe operacional: Pessoa + função. Histórico via active=false.';

-- ---------------------------------------------------------------------------
-- 4) Confirmação individual da escala (por evento × pessoa)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agenda_event_member_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  agenda_event_id uuid NOT NULL REFERENCES public.agenda_events (id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.operational_teams (id) ON DELETE RESTRICT,
  person_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  role_key text NOT NULL
    CHECK (role_key IN (
      'team_leader',
      'grill_master',
      'assistant',
      'preparation'
    )),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled')),
  token_hash text,
  token_expires_at timestamptz,
  token_revoked_at timestamptz,
  sent_at timestamptz,
  responded_at timestamptz,
  substituted_by_confirmation_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agenda_event_member_confirmations_substituted_fkey'
  ) THEN
    ALTER TABLE public.agenda_event_member_confirmations
      ADD CONSTRAINT agenda_event_member_confirmations_substituted_fkey
      FOREIGN KEY (substituted_by_confirmation_id)
      REFERENCES public.agenda_event_member_confirmations (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_agenda_member_conf_active_person
  ON public.agenda_event_member_confirmations (agenda_event_id, person_id)
  WHERE status IN ('pending', 'confirmed');

CREATE UNIQUE INDEX IF NOT EXISTS uq_agenda_member_conf_token_hash
  ON public.agenda_event_member_confirmations (token_hash)
  WHERE token_hash IS NOT NULL AND token_revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_agenda_member_conf_event
  ON public.agenda_event_member_confirmations (company_id, agenda_event_id);

CREATE INDEX IF NOT EXISTS idx_agenda_member_conf_person_date
  ON public.agenda_event_member_confirmations (company_id, person_id, status);

COMMENT ON TABLE public.agenda_event_member_confirmations IS
  'Confirmação individual da escala. Token armazenado como hash; público via /confirmacao-equipe/[token].';

-- ---------------------------------------------------------------------------
-- 5) RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.customer_operational_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_event_member_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_operational_roles_select ON public.customer_operational_roles;
CREATE POLICY customer_operational_roles_select
  ON public.customer_operational_roles FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS customer_operational_roles_write ON public.customer_operational_roles;
CREATE POLICY customer_operational_roles_write
  ON public.customer_operational_roles FOR ALL TO authenticated
  USING (private.is_company_member(company_id))
  WITH CHECK (private.is_company_member(company_id));

DROP POLICY IF EXISTS operational_team_members_select ON public.operational_team_members;
CREATE POLICY operational_team_members_select
  ON public.operational_team_members FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS operational_team_members_write ON public.operational_team_members;
CREATE POLICY operational_team_members_write
  ON public.operational_team_members FOR ALL TO authenticated
  USING (private.is_company_member(company_id))
  WITH CHECK (private.is_company_member(company_id));

DROP POLICY IF EXISTS agenda_member_conf_select ON public.agenda_event_member_confirmations;
CREATE POLICY agenda_member_conf_select
  ON public.agenda_event_member_confirmations FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS agenda_member_conf_write ON public.agenda_event_member_confirmations;
CREATE POLICY agenda_member_conf_write
  ON public.agenda_event_member_confirmations FOR ALL TO authenticated
  USING (private.is_company_member(company_id))
  WITH CHECK (private.is_company_member(company_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_operational_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_event_member_confirmations TO authenticated;
GRANT ALL ON public.customer_operational_roles TO service_role;
GRANT ALL ON public.operational_team_members TO service_role;
GRANT ALL ON public.agenda_event_member_confirmations TO service_role;

-- ---------------------------------------------------------------------------
-- 6) RPCs públicas (anon) — confirmação individual por token
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_team_member_confirmation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
  v_row public.agenda_event_member_confirmations%ROWTYPE;
  v_evt public.agenda_events%ROWTYPE;
  v_company_name TEXT;
  v_team_name TEXT;
  v_person_name TEXT;
  v_address TEXT;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  SELECT c.*
  INTO v_row
  FROM public.agenda_event_member_confirmations c
  WHERE c.token_hash = v_hash
    AND c.token_revoked_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF v_row.token_expires_at IS NOT NULL AND v_row.token_expires_at < now() THEN
    RETURN jsonb_build_object('found', true, 'expired', true, 'status', v_row.status);
  END IF;

  SELECT e.* INTO v_evt FROM public.agenda_events e WHERE e.id = v_row.agenda_event_id;
  SELECT COALESCE(c.trade_name, c.name) INTO v_company_name
  FROM public.companies c WHERE c.id = v_row.company_id;
  SELECT t.name INTO v_team_name FROM public.operational_teams t WHERE t.id = v_row.team_id;
  SELECT COALESCE(NULLIF(trim(p.ab_name), ''), p.full_name)
  INTO v_person_name
  FROM public.customers p WHERE p.id = v_row.person_id;

  IF v_evt.quote_id IS NOT NULL THEN
    SELECT NULLIF(
      trim(concat_ws(', ',
        NULLIF(trim(COALESCE(ev.address_line, '')), ''),
        NULLIF(trim(COALESCE(ev.city, '')), ''),
        NULLIF(trim(COALESCE(ev.state, '')), '')
      )),
      ''
    )
    INTO v_address
    FROM public.quotes q
    LEFT JOIN public.events ev ON ev.id = q.event_id
    WHERE q.id = v_evt.quote_id;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'expired', false,
    'company_name', v_company_name,
    'status', v_row.status,
    'can_respond', (
      v_row.status = 'pending'
      AND v_row.token_revoked_at IS NULL
      AND (v_row.token_expires_at IS NULL OR v_row.token_expires_at >= now())
      AND v_evt.status = 'scheduled'
    ),
    'confirmation', jsonb_build_object(
      'id', v_row.id,
      'role_key', v_row.role_key,
      'person_name', v_person_name,
      'team_name', v_team_name,
      'event_title', v_evt.title,
      'event_date', v_evt.event_date,
      'start_time', v_evt.start_time,
      'end_time', v_evt.end_time,
      'client_name', v_evt.client_name,
      'location', v_address
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_team_member_confirmation(
  p_token TEXT,
  p_response TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
  v_row public.agenda_event_member_confirmations%ROWTYPE;
  v_status TEXT;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  IF p_response NOT IN ('confirmed', 'declined') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_response');
  END IF;

  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  SELECT c.*
  INTO v_row
  FROM public.agenda_event_member_confirmations c
  WHERE c.token_hash = v_hash
    AND c.token_revoked_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_row.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'status', v_row.status);
  END IF;

  IF v_row.token_expires_at IS NOT NULL AND v_row.token_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  v_status := p_response;

  UPDATE public.agenda_event_member_confirmations
  SET
    status = v_status,
    responded_at = now(),
    updated_at = now()
  WHERE id = v_row.id;

  RETURN jsonb_build_object('ok', true, 'status', v_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_team_member_confirmation(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_team_member_confirmation(TEXT, TEXT) TO anon, authenticated;

-- =============================================================================
-- Agenda de eventos + Equipes (análogo Agenda da Frota / Logistics)
-- Ambiente-alvo: Supabase DEV ONLY (yasprgtlqclwsjcshtls)
-- NÃO aplicar em Production.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Equipes operacionais
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.operational_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#e21b1b',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_teams_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_operational_teams_company_active
  ON public.operational_teams (company_id, active);

CREATE UNIQUE INDEX IF NOT EXISTS uq_operational_teams_company_name
  ON public.operational_teams (company_id, lower(trim(name)))
  WHERE active IS TRUE;

-- ---------------------------------------------------------------------------
-- 2) Eventos da agenda (recursos = equipes)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agenda_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.operational_teams (id) ON DELETE RESTRICT,
  code text NOT NULL,
  title text NOT NULL,
  client_name text,
  event_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes text,
  quote_id uuid REFERENCES public.quotes (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_events_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT agenda_events_time_order CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_agenda_events_company_date
  ON public.agenda_events (company_id, event_date);

CREATE INDEX IF NOT EXISTS idx_agenda_events_team_date
  ON public.agenda_events (team_id, event_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agenda_events_company_code
  ON public.agenda_events (company_id, code);

-- ---------------------------------------------------------------------------
-- 3) Permissões
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (permission_key, label_pt, label_en, label_es, category_key)
VALUES
  ('agenda.view', 'Ver agenda', 'View agenda', 'Ver agenda', 'agenda'),
  ('agenda.manage', 'Gerenciar agenda', 'Manage agenda', 'Gestionar agenda', 'agenda'),
  ('teams.view', 'Ver equipes', 'View teams', 'Ver equipos', 'agenda'),
  ('teams.manage', 'Gerenciar equipes', 'Manage teams', 'Gestionar equipos', 'agenda')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r.role_key, p.permission_key
FROM (VALUES ('owner'), ('admin')) AS r(role_key)
CROSS JOIN (
  VALUES ('agenda.view'), ('agenda.manage'), ('teams.view'), ('teams.manage')
) AS p(permission_key)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'manager', p.permission_key
FROM (VALUES ('agenda.view'), ('agenda.manage'), ('teams.view'), ('teams.manage')) AS p(permission_key)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'sales', p.permission_key
FROM (VALUES ('agenda.view'), ('teams.view')) AS p(permission_key)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'operator', p.permission_key
FROM (VALUES ('agenda.view'), ('agenda.manage'), ('teams.view')) AS p(permission_key)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'viewer', p.permission_key
FROM (VALUES ('agenda.view'), ('teams.view')) AS p(permission_key)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.operational_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operational_teams_select_member ON public.operational_teams;
CREATE POLICY operational_teams_select_member
  ON public.operational_teams FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS operational_teams_write_member ON public.operational_teams;
CREATE POLICY operational_teams_write_member
  ON public.operational_teams FOR ALL TO authenticated
  USING (private.is_company_member(company_id))
  WITH CHECK (private.is_company_member(company_id));

DROP POLICY IF EXISTS agenda_events_select_member ON public.agenda_events;
CREATE POLICY agenda_events_select_member
  ON public.agenda_events FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS agenda_events_write_member ON public.agenda_events;
CREATE POLICY agenda_events_write_member
  ON public.agenda_events FOR ALL TO authenticated
  USING (private.is_company_member(company_id))
  WITH CHECK (private.is_company_member(company_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_events TO authenticated;
GRANT ALL ON public.operational_teams TO service_role;
GRANT ALL ON public.agenda_events TO service_role;

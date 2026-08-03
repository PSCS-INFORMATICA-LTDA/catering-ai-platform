-- =============================================================================
-- auth_users_rbac_foundation — Catering AI Platform DEV
-- Project Ref autorizado: yasprgtlqclwsjcshtls
-- Nao aplicar em Production.
--
-- Complementa F1 + harden RLS (NAO altera essas migrations).
-- Adiciona: permissions, role_permissions, user_invites, support_access_sessions,
-- status de membership, writers alinhados a authenticated.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Membership status (active | inactive | suspended)
-- ---------------------------------------------------------------------------

ALTER TABLE public.company_memberships
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.company_memberships
SET status = CASE
  WHEN active IS TRUE THEN 'active'
  ELSE 'inactive'
END
WHERE status IS NULL;

ALTER TABLE public.company_memberships
  ALTER COLUMN status SET DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_memberships_status_check'
      AND conrelid = 'public.company_memberships'::regclass
  ) THEN
    ALTER TABLE public.company_memberships
      ADD CONSTRAINT company_memberships_status_check
      CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text]));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_membership_active_from_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.active := (NEW.status = 'active');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_memberships_sync_active
  ON public.company_memberships;

CREATE TRIGGER trg_company_memberships_sync_active
  BEFORE INSERT OR UPDATE OF status
  ON public.company_memberships
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_membership_active_from_status();

-- ---------------------------------------------------------------------------
-- 2) permissions + role_permissions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key text NOT NULL UNIQUE,
  label_pt text NOT NULL,
  label_en text NOT NULL,
  label_es text NOT NULL,
  category_key text NOT NULL DEFAULT 'general',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL,
  permission_key text NOT NULL REFERENCES public.permissions (permission_key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_key, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role
  ON public.role_permissions (role_key);

INSERT INTO public.permissions (permission_key, label_pt, label_en, label_es, category_key)
VALUES
  ('users.view', 'Ver usuários', 'View users', 'Ver usuarios', 'users'),
  ('users.manage', 'Gerenciar usuários', 'Manage users', 'Gestionar usuarios', 'users'),
  ('users.invite', 'Convidar usuários', 'Invite users', 'Invitar usuarios', 'users'),
  ('quotes.view', 'Ver orçamentos', 'View quotes', 'Ver presupuestos', 'quotes'),
  ('quotes.manage', 'Gerenciar orçamentos', 'Manage quotes', 'Gestionar presupuestos', 'quotes'),
  ('customers.view', 'Ver clientes', 'View customers', 'Ver clientes', 'customers'),
  ('customers.manage', 'Gerenciar clientes', 'Manage customers', 'Gestionar clientes', 'customers'),
  ('catalog.view', 'Ver catálogo', 'View catalog', 'Ver catálogo', 'catalog'),
  ('catalog.manage', 'Gerenciar catálogo', 'Manage catalog', 'Gestionar catálogo', 'catalog'),
  ('company.settings', 'Configurações da empresa', 'Company settings', 'Configuración de empresa', 'company'),
  ('audit.view', 'Ver auditoria', 'View audit', 'Ver auditoría', 'audit'),
  ('support.access', 'Acesso de suporte', 'Support access', 'Acceso de soporte', 'platform')
ON CONFLICT (permission_key) DO NOTHING;

-- Seed role_permissions (owner/admin full company; others progressive)
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r.role_key, p.permission_key
FROM (
  VALUES
    ('owner'), ('admin')
) AS r(role_key)
CROSS JOIN public.permissions p
WHERE p.permission_key NOT IN ('support.access')
ON CONFLICT (role_key, permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'manager', p.permission_key
FROM public.permissions p
WHERE p.permission_key IN (
  'users.view','quotes.view','quotes.manage','customers.view','customers.manage',
  'catalog.view','catalog.manage','audit.view'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'sales', p.permission_key
FROM public.permissions p
WHERE p.permission_key IN (
  'quotes.view','quotes.manage','customers.view','customers.manage','catalog.view'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'operator', p.permission_key
FROM public.permissions p
WHERE p.permission_key IN ('quotes.view','customers.view','catalog.view')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'kitchen', p.permission_key
FROM public.permissions p
WHERE p.permission_key IN ('quotes.view','catalog.view')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'finance', p.permission_key
FROM public.permissions p
WHERE p.permission_key IN (
  'quotes.view','customers.view','audit.view','catalog.view'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'viewer', p.permission_key
FROM public.permissions p
WHERE p.permission_key IN ('quotes.view','customers.view','catalog.view')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) user_invites
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'operator',
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  token_hash text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_invites_status_check CHECK (
    status = ANY (ARRAY['pending'::text, 'accepted'::text, 'revoked'::text, 'expired'::text])
  ),
  CONSTRAINT user_invites_role_check CHECK (
    role = ANY (ARRAY[
      'owner'::text, 'admin'::text, 'manager'::text, 'sales'::text,
      'operator'::text, 'kitchen'::text, 'finance'::text, 'viewer'::text
    ])
  )
);

CREATE INDEX IF NOT EXISTS idx_user_invites_company_status
  ON public.user_invites (company_id, status);

CREATE INDEX IF NOT EXISTS idx_user_invites_email
  ON public.user_invites (lower(email));

-- ---------------------------------------------------------------------------
-- 4) support_access_sessions (Platform Admin / suporte PSCS)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.support_access_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  target_company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  reason text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_access_sessions_reason_len CHECK (char_length(btrim(reason)) >= 8)
);

CREATE INDEX IF NOT EXISTS idx_support_sessions_actor_active
  ON public.support_access_sessions (actor_user_id, active)
  WHERE active IS TRUE;

CREATE INDEX IF NOT EXISTS idx_support_sessions_company
  ON public.support_access_sessions (target_company_id, started_at DESC);

-- ---------------------------------------------------------------------------
-- 5) admin_audit_events (trilhas auth/admin; complementa audit_logs)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies (id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_company_created
  ON public.admin_audit_events (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor_created
  ON public.admin_audit_events (actor_user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 6) Helper: platform master (SECURITY DEFINER, sem user_id do cliente)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.is_platform_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users AS u
    WHERE u.auth_user_id = (SELECT auth.uid())
      AND u.is_pscs_master IS TRUE
      AND COALESCE(u.active, true) IS TRUE
  );
$$;

REVOKE ALL ON FUNCTION private.is_platform_master() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_platform_master() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_platform_master() TO service_role;

-- ---------------------------------------------------------------------------
-- 7) RLS novas tabelas
-- ---------------------------------------------------------------------------

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_access_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permissions_select_authenticated ON public.permissions;
CREATE POLICY permissions_select_authenticated
  ON public.permissions FOR SELECT TO authenticated
  USING (active IS TRUE OR private.is_platform_master());

DROP POLICY IF EXISTS role_permissions_select_authenticated ON public.role_permissions;
CREATE POLICY role_permissions_select_authenticated
  ON public.role_permissions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- Catálogo global (sem company_id): qualquer autenticado lê chaves; escrita negada.

DROP POLICY IF EXISTS role_permissions_write_denied ON public.role_permissions;
CREATE POLICY role_permissions_write_denied
  ON public.role_permissions FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS permissions_write_denied ON public.permissions;
CREATE POLICY permissions_write_denied
  ON public.permissions FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY permissions_update_denied
  ON public.permissions FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY permissions_delete_denied
  ON public.permissions FOR DELETE TO authenticated
  USING (false);

DROP POLICY IF EXISTS user_invites_select_admin ON public.user_invites;
CREATE POLICY user_invites_select_admin
  ON public.user_invites FOR SELECT TO authenticated
  USING (
    private.has_company_role(company_id, ARRAY['owner', 'admin']::text[])
    OR private.is_platform_master()
  );

DROP POLICY IF EXISTS user_invites_insert_admin ON public.user_invites;
CREATE POLICY user_invites_insert_admin
  ON public.user_invites FOR INSERT TO authenticated
  WITH CHECK (
    private.has_company_role(company_id, ARRAY['owner', 'admin']::text[])
  );

DROP POLICY IF EXISTS user_invites_update_admin ON public.user_invites;
CREATE POLICY user_invites_update_admin
  ON public.user_invites FOR UPDATE TO authenticated
  USING (private.has_company_role(company_id, ARRAY['owner', 'admin']::text[]))
  WITH CHECK (private.has_company_role(company_id, ARRAY['owner', 'admin']::text[]));

DROP POLICY IF EXISTS support_sessions_select_own_or_master ON public.support_access_sessions;
CREATE POLICY support_sessions_select_own_or_master
  ON public.support_access_sessions FOR SELECT TO authenticated
  USING (
    actor_user_id = (SELECT auth.uid())
    OR private.is_platform_master()
  );

DROP POLICY IF EXISTS support_sessions_insert_master ON public.support_access_sessions;
CREATE POLICY support_sessions_insert_master
  ON public.support_access_sessions FOR INSERT TO authenticated
  WITH CHECK (
    private.is_platform_master()
    AND actor_user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS support_sessions_update_master ON public.support_access_sessions;
CREATE POLICY support_sessions_update_master
  ON public.support_access_sessions FOR UPDATE TO authenticated
  USING (
    private.is_platform_master()
    AND actor_user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    private.is_platform_master()
    AND actor_user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS admin_audit_select ON public.admin_audit_events;
CREATE POLICY admin_audit_select
  ON public.admin_audit_events FOR SELECT TO authenticated
  USING (
    private.is_platform_master()
    OR (
      company_id IS NOT NULL
      AND private.has_company_role(company_id, ARRAY['owner', 'admin']::text[])
    )
  );

DROP POLICY IF EXISTS admin_audit_insert ON public.admin_audit_events;
CREATE POLICY admin_audit_insert
  ON public.admin_audit_events FOR INSERT TO authenticated
  WITH CHECK (
    actor_user_id = (SELECT auth.uid())
    AND (
      private.is_platform_master()
      OR (
        company_id IS NOT NULL
        AND private.is_company_member(company_id)
      )
    )
  );

DROP POLICY IF EXISTS admin_audit_update_denied ON public.admin_audit_events;
CREATE POLICY admin_audit_update_denied
  ON public.admin_audit_events FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS admin_audit_delete_denied ON public.admin_audit_events;
CREATE POLICY admin_audit_delete_denied
  ON public.admin_audit_events FOR DELETE TO authenticated
  USING (false);

GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.support_access_sessions TO authenticated;
GRANT SELECT, INSERT ON public.admin_audit_events TO authenticated;

GRANT ALL ON public.permissions TO service_role;
GRANT ALL ON public.role_permissions TO service_role;
GRANT ALL ON public.user_invites TO service_role;
GRANT ALL ON public.support_access_sessions TO service_role;
GRANT ALL ON public.admin_audit_events TO service_role;

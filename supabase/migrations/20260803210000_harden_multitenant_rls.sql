-- =============================================================================
-- harden_multitenant_rls — Catering AI Platform
-- Ambiente-alvo: Supabase DEV ONLY (yasprgtlqclwsjcshtls)
-- Nao aplicar em Production.
--
-- Objetivo:
--   Usuários authenticated só leem/alteram rows de empresas com membership ativo.
--   Remove policies permissivas (USING/WITH CHECK true e SELECT sem membership).
--   Não desativa RLS. Não apaga dados. Não recria tabelas.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Schema privado + helpers (SECURITY DEFINER para evitar recursão em RLS)
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION private.is_company_member(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    target_company_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.company_memberships AS m
      WHERE m.company_id = target_company_id
        AND m.user_id = (SELECT auth.uid())
        AND m.active IS TRUE
    );
$$;

CREATE OR REPLACE FUNCTION private.has_company_role(
  target_company_id uuid,
  allowed_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    target_company_id IS NOT NULL
    AND allowed_roles IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.company_memberships AS m
      WHERE m.company_id = target_company_id
        AND m.user_id = (SELECT auth.uid())
        AND m.active IS TRUE
        AND m.role = ANY (allowed_roles)
    );
$$;

REVOKE ALL ON FUNCTION private.is_company_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_company_role(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_company_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_company_role(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_company_member(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.has_company_role(uuid, text[]) TO service_role;

COMMENT ON FUNCTION private.is_company_member(uuid) IS
  'True se auth.uid() tem membership ativo na empresa. Não aceita user_id do cliente.';
COMMENT ON FUNCTION private.has_company_role(uuid, text[]) IS
  'True se auth.uid() tem membership ativo com role ∈ allowed_roles.';

-- ---------------------------------------------------------------------------
-- 1) Índices de suporte a membership / company_id
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_company_memberships_user_active
  ON public.company_memberships (user_id)
  WHERE active IS TRUE;

CREATE INDEX IF NOT EXISTS idx_company_memberships_company_user_active
  ON public.company_memberships (company_id, user_id)
  WHERE active IS TRUE;

CREATE INDEX IF NOT EXISTS idx_company_memberships_company_id
  ON public.company_memberships (company_id);

CREATE INDEX IF NOT EXISTS idx_packages_company_id
  ON public.packages (company_id);

CREATE INDEX IF NOT EXISTS idx_customers_company_id
  ON public.customers (company_id);

CREATE INDEX IF NOT EXISTS idx_quotes_company_id
  ON public.quotes (company_id);

CREATE INDEX IF NOT EXISTS idx_catalog_items_company_id
  ON public.catalog_items (company_id);

CREATE INDEX IF NOT EXISTS idx_events_company_id
  ON public.events (company_id);

CREATE INDEX IF NOT EXISTS idx_commercial_rules_company_id
  ON public.commercial_rules (company_id);

-- ---------------------------------------------------------------------------
-- 2) Remover policies existentes nas tabelas tenant-owned (somente essas)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
  tables text[] := ARRAY[
    'companies',
    'company_memberships',
    'customers',
    'events',
    'package_categories',
    'packages',
    'package_items',
    'package_side_items',
    'package_option_groups',
    'package_option_group_items',
    'package_option_values',
    'catalog_items',
    'catalog_item_prices',
    'quotes',
    'quote_items',
    'quote_additional_items',
    'quote_package_selections',
    'quote_package_items',
    'quote_option_selections',
    'quote_option_definitions',
    'quote_option_values',
    'commercial_rules',
    'branches',
    'app_users',
    'app_roles',
    'media_assets',
    'company_features',
    'company_assets',
    'document_sequences',
    'subscriptions',
    'audit_logs',
    'staff_rules',
    'payment_rules',
    'quote_statuses',
    'quote_text_templates',
    'users'
  ];
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (tables)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Habilitar RLS (não FORCE — service_role continua operacional)
-- ---------------------------------------------------------------------------

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_side_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_option_group_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_item_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_additional_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_package_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_option_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_option_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_text_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4) Macro helper: policies padrão company_id para authenticated
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'customers',
    'events',
    'package_categories',
    'packages',
    'package_items',
    'package_side_items',
    'package_option_groups',
    'package_option_group_items',
    'package_option_values',
    'catalog_items',
    'catalog_item_prices',
    'quotes',
    'quote_items',
    'quote_additional_items',
    'quote_package_selections',
    'quote_package_items',
    'quote_option_selections',
    'quote_option_definitions',
    'quote_option_values',
    'commercial_rules',
    'branches',
    'app_roles',
    'media_assets',
    'company_features',
    'company_assets',
    'document_sequences',
    'subscriptions',
    'staff_rules',
    'payment_rules',
    'quote_statuses',
    'quote_text_templates',
    'users'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    -- pula se a coluna company_id não existir
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'company_id'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I
         FOR SELECT TO authenticated
         USING (private.is_company_member(company_id))',
      t || '_select_member', t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I
         FOR INSERT TO authenticated
         WITH CHECK (private.is_company_member(company_id))',
      t || '_insert_member', t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I
         FOR UPDATE TO authenticated
         USING (private.is_company_member(company_id))
         WITH CHECK (private.is_company_member(company_id))',
      t || '_update_member', t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I
         FOR DELETE TO authenticated
         USING (
           private.is_company_member(company_id)
           AND private.has_company_role(
             company_id,
             ARRAY[''admin'', ''owner'']::text[]
           )
         )',
      t || '_delete_admin', t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5) companies — chave é id (não company_id)
-- ---------------------------------------------------------------------------

CREATE POLICY companies_select_member
  ON public.companies
  FOR SELECT TO authenticated
  USING (private.is_company_member(id));

CREATE POLICY companies_insert_admin
  ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY companies_update_admin
  ON public.companies
  FOR UPDATE TO authenticated
  USING (private.has_company_role(id, ARRAY['admin', 'owner']::text[]))
  WITH CHECK (private.has_company_role(id, ARRAY['admin', 'owner']::text[]));

CREATE POLICY companies_delete_denied
  ON public.companies
  FOR DELETE TO authenticated
  USING (false);

-- ---------------------------------------------------------------------------
-- 6) company_memberships — sem vazamento cross-tenant / sem autoelevação
-- ---------------------------------------------------------------------------

CREATE POLICY company_memberships_select_own_or_company
  ON public.company_memberships
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR private.is_company_member(company_id)
  );

CREATE POLICY company_memberships_insert_admin
  ON public.company_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    private.has_company_role(company_id, ARRAY['admin', 'owner']::text[])
  );

CREATE POLICY company_memberships_update_admin
  ON public.company_memberships
  FOR UPDATE TO authenticated
  USING (
    private.has_company_role(company_id, ARRAY['admin', 'owner']::text[])
  )
  WITH CHECK (
    private.has_company_role(company_id, ARRAY['admin', 'owner']::text[])
  );

CREATE POLICY company_memberships_delete_admin
  ON public.company_memberships
  FOR DELETE TO authenticated
  USING (
    private.has_company_role(company_id, ARRAY['admin', 'owner']::text[])
  );

-- Impede troca de company_id / user_id em memberships (anti autoelevação / grant externo)
CREATE OR REPLACE FUNCTION private.enforce_membership_identity_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'company_memberships.company_id is immutable';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'company_memberships.user_id is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_membership_identity_immutable() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_company_memberships_identity_immutable
  ON public.company_memberships;

CREATE TRIGGER trg_company_memberships_identity_immutable
  BEFORE UPDATE OF company_id, user_id
  ON public.company_memberships
  FOR EACH ROW
  EXECUTE PROCEDURE private.enforce_membership_identity_immutable();

-- ---------------------------------------------------------------------------
-- 7) app_users — vínculo por auth_user_id (se existir) ou company membership
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  has_auth_user_id boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_users'
      AND column_name = 'auth_user_id'
  ) INTO has_auth_user_id;

  IF has_auth_user_id THEN
    EXECUTE $p$
      CREATE POLICY app_users_select_self_or_member
        ON public.app_users
        FOR SELECT TO authenticated
        USING (
          auth_user_id = (SELECT auth.uid())
          OR (
            company_id IS NOT NULL
            AND private.is_company_member(company_id)
          )
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY app_users_insert_self_or_admin
        ON public.app_users
        FOR INSERT TO authenticated
        WITH CHECK (
          auth_user_id = (SELECT auth.uid())
          OR (
            company_id IS NOT NULL
            AND private.has_company_role(company_id, ARRAY['admin', 'owner']::text[])
          )
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY app_users_update_self_or_admin
        ON public.app_users
        FOR UPDATE TO authenticated
        USING (
          auth_user_id = (SELECT auth.uid())
          OR (
            company_id IS NOT NULL
            AND private.has_company_role(company_id, ARRAY['admin', 'owner']::text[])
          )
        )
        WITH CHECK (
          auth_user_id = (SELECT auth.uid())
          OR (
            company_id IS NOT NULL
            AND private.has_company_role(company_id, ARRAY['admin', 'owner']::text[])
          )
        )
    $p$;
  ELSE
    EXECUTE $p$
      CREATE POLICY app_users_select_member
        ON public.app_users
        FOR SELECT TO authenticated
        USING (
          company_id IS NOT NULL
          AND private.is_company_member(company_id)
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY app_users_insert_admin
        ON public.app_users
        FOR INSERT TO authenticated
        WITH CHECK (
          company_id IS NOT NULL
          AND private.has_company_role(company_id, ARRAY['admin', 'owner']::text[])
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY app_users_update_admin
        ON public.app_users
        FOR UPDATE TO authenticated
        USING (
          company_id IS NOT NULL
          AND private.has_company_role(company_id, ARRAY['admin', 'owner']::text[])
        )
        WITH CHECK (
          company_id IS NOT NULL
          AND private.has_company_role(company_id, ARRAY['admin', 'owner']::text[])
        )
    $p$;
  END IF;

  EXECUTE $p$
    CREATE POLICY app_users_delete_admin
      ON public.app_users
      FOR DELETE TO authenticated
      USING (
        company_id IS NOT NULL
        AND private.has_company_role(company_id, ARRAY['admin', 'owner']::text[])
      )
  $p$;
END $$;

-- ---------------------------------------------------------------------------
-- 8) audit_logs — leitura por membership; escrita restrita
-- ---------------------------------------------------------------------------

CREATE POLICY audit_logs_select_member
  ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    company_id IS NOT NULL
    AND private.is_company_member(company_id)
  );

CREATE POLICY audit_logs_insert_member
  ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IS NOT NULL
    AND private.is_company_member(company_id)
  );

CREATE POLICY audit_logs_update_denied
  ON public.audit_logs
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY audit_logs_delete_denied
  ON public.audit_logs
  FOR DELETE TO authenticated
  USING (false);

-- ---------------------------------------------------------------------------
-- 9) Views expostas — security_invoker para não contornar RLS
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'quote_detail_view' AND c.relkind = 'v'
  ) THEN
    EXECUTE 'ALTER VIEW public.quote_detail_view SET (security_invoker = true)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'quote_list_view' AND c.relkind = 'v'
  ) THEN
    EXECUTE 'ALTER VIEW public.quote_list_view SET (security_invoker = true)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'v_side_catalog_items' AND c.relkind = 'v'
  ) THEN
    EXECUTE 'ALTER VIEW public.v_side_catalog_items SET (security_invoker = true)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'v_customers' AND c.relkind = 'v'
  ) THEN
    EXECUTE 'ALTER VIEW public.v_customers SET (security_invoker = true)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 10) Nota operacional
-- - anon sem policy = sem acesso (intencional).
-- - APIs server-side devem usar service_role + filtro company_id na aplicação.
-- - authenticated usa membership ativo via private.is_company_member.
-- =============================================================================

-- =============================================================================
-- Issue #52 — company-configurable brand/assistant, RLS classification,
-- franchise-group membership visibility, and least-privilege grants.
--
-- Product migration: no QA Company B UUID and no DEV-only sequence seed.
-- Company B fixtures live in scripts/dev/setup-multicompany-company-b.mjs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A. Company assistant / location as commercial_rules (configuration-first)
--    Seeds only the existing CDL tenant by company_code, never by a QA UUID.
-- ---------------------------------------------------------------------------

INSERT INTO public.commercial_rules (
  company_id,
  rule_key,
  rule_type,
  rule_value,
  active
)
SELECT
  c.id,
  'assistant_persona',
  'company_setting',
  jsonb_build_object(
    'name', 'Brasinha',
    'role', 'Assistente digital da CDL Services BBQ At Home.',
    'location_label', 'Orlando, Florida',
    'occasional_emoji', '🔥'
  ),
  true
FROM public.companies AS c
WHERE c.company_code = 'CDL'
  AND NOT EXISTS (
    SELECT 1
    FROM public.commercial_rules AS r
    WHERE r.company_id = c.id
      AND r.rule_key = 'assistant_persona'
      AND r.active IS TRUE
  );

COMMENT ON TABLE public.commercial_rules IS
  'Tenant commercial configuration. company_id stays nullable only to allow optional platform-wide defaults (company_id IS NULL). Live DEV has 0 NULL rows; engine may still read global defaults. Keys such as deposit_percentage, mileage_*, schedule_turnaround_buffer, and assistant_persona are company settings — never engine constants.';

-- ---------------------------------------------------------------------------
-- B. RLS classification. Do not add policies just to silence the advisor.
-- ---------------------------------------------------------------------------

COMMENT ON TABLE public.payment_schedule_holds IS
  'SAFE_AS_IS: server-only checkout holds. RLS on, grants revoked from anon/authenticated. service_role mutates via SECURITY DEFINER RPCs.';

COMMENT ON TABLE public.public_quote_intake_sessions IS
  'SAFE_AS_IS: token-hash public intake. Browser never reads this table. RLS deny-by-default for authenticated/anon is correct.';

COMMENT ON TABLE public.public_quote_rate_limits IS
  'SAFE_AS_IS: server-only rate-limit buckets. RLS deny-by-default.';

COMMENT ON TABLE public.inventory_document_sequences IS
  'SAFE_AS_IS: internal numbering state. RLS on, no client policies, no client grants.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'v_package_id'
  ) THEN
    EXECUTE $c$
      COMMENT ON TABLE public.v_package_id IS
        'DEFERRED_WITH_REASON: compatibility relation of package ids. Not a tenant document. Do not add a dummy policy.'
    $c$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- C. languages = GLOBAL_REFERENCE (read-only for authenticated).
--    franchise_groups = membership-scoped hierarchy (not USING true).
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.franchise_groups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.languages FROM anon, authenticated;
REVOKE ALL ON TABLE public.franchise_groups FROM anon, authenticated;
GRANT SELECT ON TABLE public.languages TO authenticated;
GRANT SELECT ON TABLE public.franchise_groups TO authenticated;

DO $$
BEGIN
  IF to_regclass('public.languages') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS languages_select_authenticated ON public.languages';
    EXECUTE $p$
      CREATE POLICY languages_select_authenticated
        ON public.languages
        FOR SELECT TO authenticated
        USING (true)
    $p$;
  END IF;

  IF to_regclass('public.franchise_groups') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS franchise_groups_select_authenticated ON public.franchise_groups';
    EXECUTE $p$
      CREATE POLICY franchise_groups_select_authenticated
        ON public.franchise_groups
        FOR SELECT TO authenticated
        USING (
          private.is_platform_master()
          OR EXISTS (
            SELECT 1
            FROM public.companies AS c
            WHERE c.franchise_group_id = franchise_groups.id
              AND private.is_company_member(c.id)
          )
        )
    $p$;
  END IF;
END $$;

COMMENT ON TABLE public.languages IS
  'GLOBAL_REFERENCE: authenticated SELECT only. Writes remain platform/service-role. anon has no grant.';

COMMENT ON TABLE public.franchise_groups IS
  'TENANT_HIERARCHY: authenticated SELECT only for groups linked to a company where the caller has an active membership, or platform master. Not a global open catalog.';

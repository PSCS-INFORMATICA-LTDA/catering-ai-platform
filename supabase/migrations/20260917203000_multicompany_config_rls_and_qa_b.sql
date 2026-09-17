-- =============================================================================
-- Issue #52 — company-configurable brand/assistant, RLS classification,
-- and DEV Company B (QA MULTICOMPANY) sequences.
-- DEV ONLY. Does not invent a sentinel company. Reuses the existing isolation
-- tenant a1111111-1111-4111-8111-111111111111.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A. Company assistant / location as commercial_rules (configuration-first)
--    CDL seed preserves current Brasinha + invoice location copy.
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
  'Tenant (or optional global) commercial configuration. Keys such as deposit_percentage, mileage_*, schedule_turnaround_buffer, and assistant_persona are company settings — never engine constants.';

-- ---------------------------------------------------------------------------
-- B. Company B = existing DEV isolation tenant. Do not create a fake UUID.
-- ---------------------------------------------------------------------------

UPDATE public.companies
SET trade_name = COALESCE(NULLIF(btrim(trade_name), ''), 'QA MULTICOMPANY'),
    updated_at = now()
WHERE id = 'a1111111-1111-4111-8111-111111111111'::uuid;

INSERT INTO public.document_sequences (
  company_id, document_type, prefix, year, current_number, padding, active
)
SELECT
  'a1111111-1111-4111-8111-111111111111'::uuid,
  v.document_type,
  v.prefix,
  v.year,
  0,
  6,
  true
FROM (
  VALUES
    ('quote', 'Q', EXTRACT(YEAR FROM CURRENT_DATE)::integer),
    ('invoice', 'INV', EXTRACT(YEAR FROM CURRENT_DATE)::integer),
    ('service_order', 'SO', EXTRACT(YEAR FROM CURRENT_DATE)::integer),
    ('customer', 'AB', 0)
) AS v(document_type, prefix, year)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.document_sequences AS s
  WHERE s.company_id = 'a1111111-1111-4111-8111-111111111111'::uuid
    AND s.document_type = v.document_type
    AND s.year = v.year
);

-- ---------------------------------------------------------------------------
-- C. RLS classification. Do not add policies just to silence the advisor.
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

-- Global reference reads. Write remains deny-by-default (no INSERT/UPDATE/DELETE policy).
ALTER TABLE IF EXISTS public.languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.franchise_groups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.languages') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = 'languages'
         AND policyname = 'languages_select_authenticated'
     ) THEN
    EXECUTE $p$
      CREATE POLICY languages_select_authenticated
        ON public.languages
        FOR SELECT TO authenticated
        USING (true)
    $p$;
  END IF;

  IF to_regclass('public.franchise_groups') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = 'franchise_groups'
         AND policyname = 'franchise_groups_select_authenticated'
     ) THEN
    EXECUTE $p$
      CREATE POLICY franchise_groups_select_authenticated
        ON public.franchise_groups
        FOR SELECT TO authenticated
        USING (true)
    $p$;
  END IF;
END $$;

COMMENT ON TABLE public.languages IS
  'GLOBAL_REFERENCE: controlled SELECT for authenticated. Writes remain platform/service-role.';

COMMENT ON TABLE public.franchise_groups IS
  'GLOBAL_REFERENCE / hierarchy: controlled SELECT for authenticated. Writes remain platform/service-role.';

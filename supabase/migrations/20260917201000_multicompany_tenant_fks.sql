-- =============================================================================
-- Issue #52 — Multi-company tenant FKs, sentinel sequence freeze.
-- DEV ONLY: yasprgtlqclwsjcshtls. Do not apply to Production.
--
-- AUDIT_BEFORE (2026-09-17, live DEV):
--   document_sequences sentinel row id=2d8183d4-9bef-4fc3-a5a7-5edd21005525
--     company_id=00000000-0000-4000-8000-000000000000
--     document_type=service_order prefix=SO year=2026 current_number=13
--     created_at=2026-08-05 12:33:47  updated_at=2026-08-27 22:50:38
--   CDL service_order sequence current_number=9 updated_at=2026-09-17 14:05:13
--   Remaining service_orders: SO-2026-000004..000009, all company=CDL
--   Missing numbers 000001-000003 and 000010-000013 have no surviving rows
--   Sentinel company does not exist in public.companies
--
-- LINEAGE DECISION:
--   Do not delete or reassign the sentinel counter.
--   Do not add document_sequences.company_id → companies(id) while it remains.
--   Deactivate the row and reject future sentinel allocations.
--
-- ROLLBACK:
--   SET active=true on the sentinel row; DROP the new FKs/triggers.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS private;

-- ---------------------------------------------------------------------------
-- 1) Freeze sentinel sequence (no delete, no reassign)
-- ---------------------------------------------------------------------------

UPDATE public.document_sequences
SET active = false,
    updated_at = now()
WHERE company_id = '00000000-0000-4000-8000-000000000000'::uuid
  AND document_type = 'service_order'
  AND year = 2026;

COMMENT ON TABLE public.document_sequences IS
  'Per-company document counters. Sentinel company UUID 00000000-0000-4000-8000-000000000000 is a frozen legacy exception; new sentinel IDs are forbidden. Live CDL service_order numbering uses the CDL row, not the sentinel.';

CREATE OR REPLACE FUNCTION private.reject_sentinel_company_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  sentinel uuid := '00000000-0000-4000-8000-000000000000';
BEGIN
  IF NEW.company_id IS DISTINCT FROM sentinel THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'sentinel company IDs are forbidden'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.company_id IS DISTINCT FROM sentinel THEN
    RAISE EXCEPTION 'sentinel company IDs are forbidden'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_sequences_reject_sentinel
  ON public.document_sequences;

CREATE TRIGGER trg_document_sequences_reject_sentinel
  BEFORE INSERT OR UPDATE OF company_id
  ON public.document_sequences
  FOR EACH ROW
  EXECUTE PROCEDURE private.reject_sentinel_company_id();

CREATE OR REPLACE FUNCTION private.company_id_exists(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT p_company_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.companies AS c
      WHERE c.id = p_company_id
    );
$$;

-- Guard the allocator without replacing numbering math.
CREATE OR REPLACE FUNCTION public.get_next_document_number(
  p_company_id uuid,
  p_document_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year integer;
  v_prefix text := public.resolve_document_prefix(p_document_type);
  v_padding integer := 6;
  v_next integer;
  sentinel uuid := '00000000-0000-4000-8000-000000000000';
BEGIN
  IF p_company_id IS NULL OR p_company_id = sentinel THEN
    RAISE EXCEPTION 'p_company_id must be a real company; sentinel IDs are forbidden';
  END IF;

  IF NOT private.company_id_exists(p_company_id) THEN
    RAISE EXCEPTION 'p_company_id % does not exist in companies', p_company_id;
  END IF;

  IF p_document_type = 'customer' THEN
    v_year := 0;
  ELSE
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  END IF;

  INSERT INTO public.document_sequences (
    company_id,
    document_type,
    prefix,
    year,
    current_number,
    padding,
    active
  )
  VALUES (
    p_company_id,
    p_document_type,
    v_prefix,
    v_year,
    1,
    v_padding,
    true
  )
  ON CONFLICT (company_id, document_type, year)
  DO UPDATE SET
    current_number = public.document_sequences.current_number + 1,
    updated_at = now()
  RETURNING current_number, padding, prefix
  INTO v_next, v_padding, v_prefix;

  IF p_document_type = 'customer' THEN
    RETURN v_prefix || lpad(v_next::text, v_padding, '0');
  END IF;

  RETURN v_prefix || '-' || v_year::text || '-' || lpad(v_next::text, v_padding, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_next_document_number(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_document_number(uuid, text)
  TO service_role;

COMMENT ON FUNCTION public.get_next_document_number(uuid, text) IS
  'Allocates next document number for a real companies.id. Sentinel UUIDs are rejected. service_role only.';

-- ---------------------------------------------------------------------------
-- 2) Add missing company_id → companies(id) FKs after orphan preflight
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.add_company_fk_if_safe(
  p_table text,
  p_conname text,
  p_on_delete text,
  p_nullable boolean
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  orphan_count integer;
  null_count integer;
  sql_on_delete text;
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table
      AND column_name = 'company_id'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = p_conname
      AND conrelid = ('public.' || p_table)::regclass
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = ('public.' || p_table)::regclass
      AND c.contype = 'f'
      AND a.attname = 'company_id'
      AND pg_get_constraintdef(c.oid) ILIKE '%companies%'
  ) THEN
    RETURN;
  END IF;

  EXECUTE format(
    'SELECT count(*) FROM public.%I t
      WHERE t.company_id IS NOT NULL
        AND t.company_id <> %L::uuid
        AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = t.company_id)',
    p_table,
    '00000000-0000-4000-8000-000000000000'
  ) INTO orphan_count;

  IF COALESCE(orphan_count, 0) > 0 THEN
    RAISE EXCEPTION
      'Issue #52 blocked: public.% has % orphan company_id values',
      p_table, orphan_count;
  END IF;

  sql_on_delete := CASE upper(p_on_delete)
    WHEN 'CASCADE' THEN 'ON DELETE CASCADE'
    WHEN 'SET NULL' THEN 'ON DELETE SET NULL'
    ELSE 'ON DELETE RESTRICT'
  END;

  EXECUTE format(
    'ALTER TABLE public.%I ADD CONSTRAINT %I
       FOREIGN KEY (company_id) REFERENCES public.companies (id) %s',
    p_table, p_conname, sql_on_delete
  );

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id)',
    'idx_' || p_table || '_company_id_fk',
    p_table
  );

  IF NOT p_nullable THEN
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE company_id IS NULL',
      p_table
    ) INTO null_count;
    IF COALESCE(null_count, 0) = 0 THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN company_id SET NOT NULL',
        p_table
      );
    END IF;
  END IF;
END;
$$;

-- Tenant-owned tables from the DEV audit that lacked a companies FK.
SELECT private.add_company_fk_if_safe('app_roles', 'app_roles_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('app_users', 'app_users_company_id_fkey', 'SET NULL', true);
SELECT private.add_company_fk_if_safe('catalog_item_prices', 'catalog_item_prices_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('catalog_items', 'catalog_items_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('commercial_rules', 'commercial_rules_company_id_fkey', 'RESTRICT', true);
SELECT private.add_company_fk_if_safe('customers', 'customers_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('media_assets', 'media_assets_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('package_categories', 'package_categories_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('package_items', 'package_items_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('package_option_groups', 'package_option_groups_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('package_option_values', 'package_option_values_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('package_side_items', 'package_side_items_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('packages', 'packages_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('payment_rules', 'payment_rules_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('quote_additional_items', 'quote_additional_items_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('quote_items', 'quote_items_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('quote_option_selections', 'quote_option_selections_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('quote_package_items', 'quote_package_items_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('quote_package_selections', 'quote_package_selections_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('quote_statuses', 'quote_statuses_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('quote_text_templates', 'quote_text_templates_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('quotes', 'quotes_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('staff_rules', 'staff_rules_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('users', 'users_company_id_fkey', 'SET NULL', true);
SELECT private.add_company_fk_if_safe('company_assets', 'company_assets_company_id_fkey', 'RESTRICT', false);
SELECT private.add_company_fk_if_safe('company_features', 'company_features_company_id_fkey', 'RESTRICT', false);

-- Explicit classifications
COMMENT ON TABLE public.app_users IS
  'Platform identity (login/person). company_id is a legacy denormalized hint and MUST remain nullable. Source of truth is company_memberships + auth.users. Do not backfill company_id.';

COMMENT ON TABLE public.inventory_movement_types IS
  'Global codebook when company_id IS NULL. Tenant custom types may set company_id. Do not force NOT NULL. Unique (code) for globals and (company_id, code) for tenant overrides.';

COMMENT ON TABLE public.languages IS
  'Global reference. Empty on DEV at Issue #52 audit. Not tenant-owned.';

COMMENT ON TABLE public.permissions IS
  'Platform permission catalog. Not tenant-owned.';

COMMENT ON TABLE public.role_permissions IS
  'Platform role-to-permission map. Not tenant-owned.';

COMMENT ON TABLE public.franchise_groups IS
  'Brand/network hierarchy above companies. Not a global open catalog. Visibility is limited to groups linked to a caller membership (or platform master).';

DROP FUNCTION IF EXISTS private.add_company_fk_if_safe(text, text, text, boolean);

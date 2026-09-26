-- =============================================================================
-- Issue #52 — Composite tenant integrity.
-- DEV ONLY. Makes it structurally impossible to attach a child row of
-- company A to a parent row of company B.
--
-- AUDIT_BEFORE: live DEV child/parent company_id mismatches were 0 on the
-- pairs we could join in application code. Embed metadata showed some
-- single-column FKs already exist; these composite FKs add tenant equality.
-- Financial tables already received composite FKs in
-- 20260911153500_finance_tenant_integrity.sql. Brasinha already has
-- (conversation_id, company_id).
--
-- ON DELETE:
--   quote children RESTRICT/CASCADE follows the existing single-column FK
--   intent. Financial children stay RESTRICT. Inventory lines CASCADE with
--   the parent document (document delete is an operational action).
--
-- ROLLBACK: drop the new composite FKs and unique (id, company_id) keys.
-- =============================================================================

CREATE OR REPLACE FUNCTION private.add_unique_id_company(p_table text, p_conname text)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = p_conname
      AND conrelid = ('public.' || p_table)::regclass
  ) THEN
    RETURN;
  END IF;
  EXECUTE format(
    'ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (id, company_id)',
    p_table, p_conname
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.add_composite_company_fk(
  p_table text,
  p_conname text,
  p_cols text,
  p_parent text,
  p_parent_cols text,
  p_on_delete text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  mismatch integer;
  child_a text;
  child_b text;
  parent_a text;
BEGIN
  IF to_regclass('public.' || p_table) IS NULL
     OR to_regclass('public.' || p_parent) IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = p_conname
      AND conrelid = ('public.' || p_table)::regclass
  ) THEN
    RETURN;
  END IF;

  child_a := split_part(replace(p_cols, ' ', ''), ',', 1);
  child_b := split_part(replace(p_cols, ' ', ''), ',', 2);
  parent_a := split_part(replace(p_parent_cols, ' ', ''), ',', 1);

  EXECUTE format(
    'SELECT count(*) FROM public.%I child
       JOIN public.%I parent ON parent.%I = child.%I
      WHERE child.%I IS NOT NULL
        AND parent.company_id IS DISTINCT FROM child.company_id',
    p_table, p_parent, parent_a, child_a, child_a
  ) INTO mismatch;

  IF COALESCE(mismatch, 0) > 0 THEN
    RAISE EXCEPTION
      'Issue #52 blocked: public.% has % cross-tenant % → % rows',
      p_table, mismatch, child_a, p_parent;
  END IF;

  EXECUTE format(
    'ALTER TABLE public.%I ADD CONSTRAINT %I
       FOREIGN KEY (%s) REFERENCES public.%I (%s) %s',
    p_table,
    p_conname,
    p_cols,
    p_parent,
    p_parent_cols,
    CASE upper(p_on_delete)
      WHEN 'CASCADE' THEN 'ON DELETE CASCADE'
      WHEN 'SET NULL' THEN 'ON DELETE SET NULL'
      ELSE 'ON DELETE RESTRICT'
    END
  );
END;
$$;

SELECT private.add_unique_id_company('quote_versions', 'quote_versions_id_company_key');
SELECT private.add_unique_id_company('service_orders', 'service_orders_id_company_key');
SELECT private.add_unique_id_company('packages', 'packages_id_company_key');
SELECT private.add_unique_id_company('catalog_items', 'catalog_items_id_company_key');
SELECT private.add_unique_id_company('customers', 'customers_id_company_key');
SELECT private.add_unique_id_company('inventory_documents', 'inventory_documents_id_company_key');
SELECT private.add_unique_id_company('event_financial_closeouts', 'event_financial_closeouts_id_company_key');
SELECT private.add_unique_id_company('brasinha_conversations', 'brasinha_conversations_id_company_key');

-- Quote graph
SELECT private.add_composite_company_fk(
  'quote_versions', 'quote_versions_quote_company_fkey',
  'quote_id, company_id', 'quotes', 'id, company_id', 'CASCADE'
);
SELECT private.add_composite_company_fk(
  'quote_items', 'quote_items_quote_company_fkey',
  'quote_id, company_id', 'quotes', 'id, company_id', 'CASCADE'
);
SELECT private.add_composite_company_fk(
  'quote_additional_items', 'quote_additional_items_quote_company_fkey',
  'quote_id, company_id', 'quotes', 'id, company_id', 'CASCADE'
);
SELECT private.add_composite_company_fk(
  'quote_package_selections', 'quote_package_selections_quote_company_fkey',
  'quote_id, company_id', 'quotes', 'id, company_id', 'CASCADE'
);
SELECT private.add_composite_company_fk(
  'quote_package_items', 'quote_package_items_quote_company_fkey',
  'quote_id, company_id', 'quotes', 'id, company_id', 'CASCADE'
);
SELECT private.add_composite_company_fk(
  'quote_option_selections', 'quote_option_selections_quote_company_fkey',
  'quote_id, company_id', 'quotes', 'id, company_id', 'CASCADE'
);
-- quote_coupon_applications already has (quote_id, company_id) → quotes.

-- Orders
SELECT private.add_composite_company_fk(
  'service_orders', 'service_orders_quote_company_fkey',
  'quote_id, company_id', 'quotes', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'service_orders', 'service_orders_quote_version_company_fkey',
  'quote_version_id, company_id', 'quote_versions', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'service_order_items', 'service_order_items_order_company_fkey',
  'service_order_id, company_id', 'service_orders', 'id, company_id', 'CASCADE'
);
SELECT private.add_composite_company_fk(
  'service_order_status_history', 'service_order_status_history_order_company_fkey',
  'service_order_id, company_id', 'service_orders', 'id, company_id', 'CASCADE'
);
SELECT private.add_composite_company_fk(
  'service_order_materials', 'service_order_materials_order_company_fkey',
  'service_order_id, company_id', 'service_orders', 'id, company_id', 'CASCADE'
);

-- Agenda quote_id/service_order_id stay single-column FKs with ON DELETE SET NULL.
-- A composite FK would SET NULL on company_id as well, which is unsafe.

-- Inventory documents → lines
SELECT private.add_composite_company_fk(
  'inventory_document_lines', 'inventory_document_lines_document_company_fkey',
  'document_id, company_id', 'inventory_documents', 'id, company_id', 'CASCADE'
);

-- Closeout lines
SELECT private.add_composite_company_fk(
  'event_financial_closeout_lines', 'event_financial_closeout_lines_closeout_company_fkey',
  'closeout_id, company_id', 'event_financial_closeouts', 'id, company_id', 'CASCADE'
);

-- Covering indexes for the new composite FKs (tenant key paths only)
CREATE INDEX IF NOT EXISTS idx_quote_versions_quote_company
  ON public.quote_versions (quote_id, company_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_company
  ON public.quote_items (quote_id, company_id);
CREATE INDEX IF NOT EXISTS idx_quote_additional_items_quote_company
  ON public.quote_additional_items (quote_id, company_id);
CREATE INDEX IF NOT EXISTS idx_quote_package_selections_quote_company
  ON public.quote_package_selections (quote_id, company_id);
CREATE INDEX IF NOT EXISTS idx_quote_package_items_quote_company
  ON public.quote_package_items (quote_id, company_id);
CREATE INDEX IF NOT EXISTS idx_quote_option_selections_quote_company
  ON public.quote_option_selections (quote_id, company_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_quote_company
  ON public.service_orders (quote_id, company_id);
CREATE INDEX IF NOT EXISTS idx_service_order_items_order_company
  ON public.service_order_items (service_order_id, company_id);
CREATE INDEX IF NOT EXISTS idx_agenda_events_quote_company
  ON public.agenda_events (quote_id, company_id)
  WHERE quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_document_lines_document_company
  ON public.inventory_document_lines (document_id, company_id);
CREATE INDEX IF NOT EXISTS idx_event_financial_closeout_lines_closeout_company
  ON public.event_financial_closeout_lines (closeout_id, company_id);

DROP FUNCTION IF EXISTS private.add_unique_id_company(text, text);
DROP FUNCTION IF EXISTS private.add_composite_company_fk(text, text, text, text, text, text);

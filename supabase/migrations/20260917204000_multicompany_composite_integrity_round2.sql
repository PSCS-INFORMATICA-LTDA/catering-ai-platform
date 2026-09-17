-- =============================================================================
-- Issue #52 — Composite tenant integrity round 2.
-- Structurally prevent child.company_id <> parent.company_id for tenant→tenant
-- graphs that were still single-column after 20260917202000.
--
-- Rules:
--   * Abort if a live mismatch exists.
--   * Do not duplicate an existing composite FK.
--   * MATCH SIMPLE: a NULL parent id skips the composite check.
--   * ON DELETE SET NULL relationships use a same-company trigger instead of
--     a composite FK (composite SET NULL would also null company_id).
--   * Financial tables stay RESTRICT. No new CASCADE on invoices/payments.
--
-- ON DELETE (composite FKs in this file): RESTRICT unless documented.
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
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = 'company_id'
  ) THEN
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
  parent_a := split_part(replace(p_parent_cols, ' ', ''), ',', 1);

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = child_a
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = 'company_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_parent AND column_name = parent_a
  ) THEN
    RETURN;
  END IF;

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

CREATE OR REPLACE FUNCTION private.assert_same_company_ref()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  fk_col text := TG_ARGV[0];
  parent_table text := TG_ARGV[1];
  fk_val uuid;
  parent_company uuid;
BEGIN
  EXECUTE format('SELECT ($1).%I', fk_col) USING NEW INTO fk_val;
  IF fk_val IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format(
    'SELECT company_id FROM public.%I WHERE id = $1',
    parent_table
  ) USING fk_val INTO parent_company;

  IF parent_company IS NULL THEN
    RETURN NEW;
  END IF;

  IF parent_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'cross-tenant % on public.%', fk_col, TG_TABLE_NAME
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.install_same_company_trigger(
  p_table text,
  p_fk_col text,
  p_parent text,
  p_trigger text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF to_regclass('public.' || p_table) IS NULL
     OR to_regclass('public.' || p_parent) IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = p_fk_col
  ) THEN
    RETURN;
  END IF;

  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', p_trigger, p_table);
  EXECUTE format(
    'CREATE TRIGGER %I
       BEFORE INSERT OR UPDATE OF %I, company_id
       ON public.%I
       FOR EACH ROW
       EXECUTE PROCEDURE private.assert_same_company_ref(%L, %L)',
    p_trigger, p_fk_col, p_table, p_fk_col, p_parent
  );
END;
$$;

-- Parent unique keys required by new composite FKs
SELECT private.add_unique_id_company('branches', 'branches_id_company_key');
SELECT private.add_unique_id_company('events', 'events_id_company_key');
SELECT private.add_unique_id_company('operational_teams', 'operational_teams_id_company_key');
SELECT private.add_unique_id_company('inventory_locations', 'inventory_locations_id_company_key');
SELECT private.add_unique_id_company('inventory_lots', 'inventory_lots_id_company_key');
SELECT private.add_unique_id_company('package_option_groups', 'package_option_groups_id_company_key');
SELECT private.add_unique_id_company('package_categories', 'package_categories_id_company_key');
SELECT private.add_unique_id_company('coupons', 'coupons_id_company_key');
SELECT private.add_unique_id_company('agenda_events', 'agenda_events_id_company_key');
SELECT private.add_unique_id_company('service_order_materials', 'service_order_materials_id_company_key');
SELECT private.add_unique_id_company('quote_option_definitions', 'quote_option_definitions_id_company_key');
SELECT private.add_unique_id_company('package_option_group_items', 'package_option_group_items_id_company_key');

-- ---------------------------------------------------------------------------
-- QUOTES → tenant parents (RESTRICT; existing single-column FKs are RESTRICT)
-- ---------------------------------------------------------------------------
SELECT private.add_composite_company_fk(
  'quotes', 'quotes_customer_company_fkey',
  'customer_id, company_id', 'customers', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'quotes', 'quotes_event_company_fkey',
  'event_id, company_id', 'events', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'quotes', 'quotes_package_company_fkey',
  'package_id, company_id', 'packages', 'id, company_id', 'RESTRICT'
);

-- SET NULL quote refs: trigger only (do not composite-SET-NULL company_id)
SELECT private.install_same_company_trigger(
  'quotes', 'branch_id', 'branches', 'trg_quotes_branch_same_company'
);
SELECT private.install_same_company_trigger(
  'quotes', 'designated_team_id', 'operational_teams', 'trg_quotes_team_same_company'
);
SELECT private.install_same_company_trigger(
  'quotes', 'accepted_version_id', 'quote_versions', 'trg_quotes_accepted_version_same_company'
);
SELECT private.install_same_company_trigger(
  'quotes', 'proposal_shared_version_id', 'quote_versions', 'trg_quotes_shared_version_same_company'
);
-- converted_service_order_id is SET NULL and would cycle with service_orders.quote_id.
-- Trigger enforces tenant match without creating a second FK cycle.
SELECT private.install_same_company_trigger(
  'quotes', 'converted_service_order_id', 'service_orders', 'trg_quotes_converted_so_same_company'
);

-- ---------------------------------------------------------------------------
-- QUOTE CHILDREN → catalog / package / options / coupons
-- ---------------------------------------------------------------------------
SELECT private.add_composite_company_fk(
  'quote_items', 'quote_items_catalog_company_fkey',
  'additional_item_id, company_id', 'catalog_items', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'quote_additional_items', 'quote_additional_items_catalog_company_fkey',
  'additional_item_id, company_id', 'catalog_items', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'quote_option_values', 'quote_option_values_quote_company_fkey',
  'quote_id, company_id', 'quotes', 'id, company_id', 'CASCADE'
);
SELECT private.add_composite_company_fk(
  'quote_option_values', 'quote_option_values_definition_company_fkey',
  'option_definition_id, company_id', 'quote_option_definitions', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'quote_package_selections', 'quote_package_selections_package_company_fkey',
  'package_id, company_id', 'packages', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'quote_package_selections', 'quote_package_selections_group_company_fkey',
  'option_group_id, company_id', 'package_option_groups', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'quote_package_selections', 'quote_package_selections_item_company_fkey',
  'option_item_id, company_id', 'package_option_group_items', 'id, company_id', 'RESTRICT'
);
SELECT private.install_same_company_trigger(
  'quote_package_selections', 'branch_id', 'branches', 'trg_quote_package_selections_branch_same_company'
);
SELECT private.add_composite_company_fk(
  'quote_coupon_applications', 'quote_coupon_applications_coupon_company_fkey',
  'coupon_id, company_id', 'coupons', 'id, company_id', 'RESTRICT'
);

-- ---------------------------------------------------------------------------
-- CATALOG / PACKAGE graph
-- ---------------------------------------------------------------------------
SELECT private.add_composite_company_fk(
  'catalog_item_prices', 'catalog_item_prices_item_company_fkey',
  'catalog_item_id, company_id', 'catalog_items', 'id, company_id', 'CASCADE'
);
SELECT private.install_same_company_trigger(
  'catalog_items', 'branch_id', 'branches', 'trg_catalog_items_branch_same_company'
);
SELECT private.add_composite_company_fk(
  'package_items', 'package_items_package_company_fkey',
  'package_id, company_id', 'packages', 'id, company_id', 'CASCADE'
);
SELECT private.add_composite_company_fk(
  'package_items', 'package_items_catalog_company_fkey',
  'additional_item_id, company_id', 'catalog_items', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'package_items', 'package_items_category_company_fkey',
  'category_id, company_id', 'package_categories', 'id, company_id', 'RESTRICT'
);
SELECT private.install_same_company_trigger(
  'package_items', 'branch_id', 'branches', 'trg_package_items_branch_same_company'
);
SELECT private.add_composite_company_fk(
  'package_side_items', 'package_side_items_package_company_fkey',
  'package_id, company_id', 'packages', 'id, company_id', 'CASCADE'
);
SELECT private.add_composite_company_fk(
  'package_side_items', 'package_side_items_catalog_company_fkey',
  'additional_item_id, company_id', 'catalog_items', 'id, company_id', 'RESTRICT'
);
SELECT private.install_same_company_trigger(
  'package_side_items', 'branch_id', 'branches', 'trg_package_side_items_branch_same_company'
);
SELECT private.add_composite_company_fk(
  'package_option_groups', 'package_option_groups_package_company_fkey',
  'package_id, company_id', 'packages', 'id, company_id', 'CASCADE'
);
SELECT private.install_same_company_trigger(
  'package_option_groups', 'branch_id', 'branches', 'trg_package_option_groups_branch_same_company'
);
SELECT private.add_composite_company_fk(
  'package_option_group_items', 'package_option_group_items_group_company_fkey',
  'option_group_id, company_id', 'package_option_groups', 'id, company_id', 'CASCADE'
);
SELECT private.add_composite_company_fk(
  'package_option_group_items', 'package_option_group_items_catalog_company_fkey',
  'additional_item_id, company_id', 'catalog_items', 'id, company_id', 'RESTRICT'
);
SELECT private.install_same_company_trigger(
  'package_option_group_items', 'branch_id', 'branches', 'trg_package_option_group_items_branch_same_company'
);
SELECT private.install_same_company_trigger(
  'packages', 'branch_id', 'branches', 'trg_packages_branch_same_company'
);

-- ---------------------------------------------------------------------------
-- EVENTS / ORDERS
-- ---------------------------------------------------------------------------
SELECT private.add_composite_company_fk(
  'events', 'events_customer_company_fkey',
  'customer_id, company_id', 'customers', 'id, company_id', 'RESTRICT'
);
SELECT private.install_same_company_trigger(
  'service_orders', 'event_id', 'events', 'trg_service_orders_event_same_company'
);
SELECT private.install_same_company_trigger(
  'service_orders', 'customer_id', 'customers', 'trg_service_orders_customer_same_company'
);

-- ---------------------------------------------------------------------------
-- AGENDA
-- ---------------------------------------------------------------------------
SELECT private.add_composite_company_fk(
  'agenda_events', 'agenda_events_team_company_fkey',
  'team_id, company_id', 'operational_teams', 'id, company_id', 'RESTRICT'
);
SELECT private.install_same_company_trigger(
  'agenda_events', 'quote_id', 'quotes', 'trg_agenda_events_quote_same_company'
);
SELECT private.install_same_company_trigger(
  'agenda_events', 'service_order_id', 'service_orders', 'trg_agenda_events_so_same_company'
);
SELECT private.add_composite_company_fk(
  'agenda_event_member_confirmations', 'agenda_confirmations_event_company_fkey',
  'agenda_event_id, company_id', 'agenda_events', 'id, company_id', 'CASCADE'
);
SELECT private.add_composite_company_fk(
  'agenda_event_member_confirmations', 'agenda_confirmations_team_company_fkey',
  'team_id, company_id', 'operational_teams', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'agenda_event_member_confirmations', 'agenda_confirmations_person_company_fkey',
  'person_id, company_id', 'customers', 'id, company_id', 'RESTRICT'
);

-- ---------------------------------------------------------------------------
-- INVENTORY
-- ---------------------------------------------------------------------------
SELECT private.add_composite_company_fk(
  'inventory_locations', 'inventory_locations_branch_company_fkey',
  'branch_id, company_id', 'branches', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'inventory_lots', 'inventory_lots_branch_company_fkey',
  'branch_id, company_id', 'branches', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'inventory_lots', 'inventory_lots_catalog_company_fkey',
  'catalog_item_id, company_id', 'catalog_items', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'inventory_documents', 'inventory_documents_branch_company_fkey',
  'branch_id, company_id', 'branches', 'id, company_id', 'RESTRICT'
);
SELECT private.install_same_company_trigger(
  'inventory_documents', 'event_id', 'events', 'trg_inventory_documents_event_same_company'
);
SELECT private.install_same_company_trigger(
  'inventory_documents', 'service_order_id', 'service_orders', 'trg_inventory_documents_so_same_company'
);
SELECT private.install_same_company_trigger(
  'inventory_documents', 'from_location_id', 'inventory_locations', 'trg_inventory_documents_from_loc_same_company'
);
SELECT private.install_same_company_trigger(
  'inventory_documents', 'to_location_id', 'inventory_locations', 'trg_inventory_documents_to_loc_same_company'
);
SELECT private.add_composite_company_fk(
  'inventory_document_lines', 'inventory_document_lines_catalog_company_fkey',
  'catalog_item_id, company_id', 'catalog_items', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'inventory_document_lines', 'inventory_document_lines_location_company_fkey',
  'location_id, company_id', 'inventory_locations', 'id, company_id', 'RESTRICT'
);
SELECT private.install_same_company_trigger(
  'inventory_document_lines', 'lot_id', 'inventory_lots', 'trg_inventory_document_lines_lot_same_company'
);
SELECT private.install_same_company_trigger(
  'inventory_document_lines', 'service_order_material_id', 'service_order_materials', 'trg_inventory_document_lines_som_same_company'
);
SELECT private.add_composite_company_fk(
  'inventory_movements', 'inventory_movements_location_company_fkey',
  'location_id, company_id', 'inventory_locations', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'inventory_movements', 'inventory_movements_catalog_company_fkey',
  'catalog_item_id, company_id', 'catalog_items', 'id, company_id', 'RESTRICT'
);
SELECT private.install_same_company_trigger(
  'inventory_movements', 'service_order_id', 'service_orders', 'trg_inventory_movements_so_same_company'
);
SELECT private.add_composite_company_fk(
  'inventory_balances', 'inventory_balances_location_company_fkey',
  'location_id, company_id', 'inventory_locations', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'inventory_balances', 'inventory_balances_catalog_company_fkey',
  'catalog_item_id, company_id', 'catalog_items', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'inventory_commitments', 'inventory_commitments_branch_company_fkey',
  'branch_id, company_id', 'branches', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'inventory_commitments', 'inventory_commitments_location_company_fkey',
  'location_id, company_id', 'inventory_locations', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'inventory_commitments', 'inventory_commitments_catalog_company_fkey',
  'catalog_item_id, company_id', 'catalog_items', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'inventory_commitments', 'inventory_commitments_order_company_fkey',
  'service_order_id, company_id', 'service_orders', 'id, company_id', 'CASCADE'
);
SELECT private.add_composite_company_fk(
  'inventory_commitments', 'inventory_commitments_material_company_fkey',
  'service_order_material_id, company_id', 'service_order_materials', 'id, company_id', 'CASCADE'
);
SELECT private.install_same_company_trigger(
  'inventory_commitments', 'lot_id', 'inventory_lots', 'trg_inventory_commitments_lot_same_company'
);

-- ---------------------------------------------------------------------------
-- PUBLIC QUOTE
-- ---------------------------------------------------------------------------
SELECT private.install_same_company_trigger(
  'public_quote_intake_sessions', 'quote_id', 'quotes', 'trg_public_quote_intake_quote_same_company'
);

-- ---------------------------------------------------------------------------
-- OPERATIONS
-- ---------------------------------------------------------------------------
SELECT private.add_composite_company_fk(
  'operational_team_members', 'operational_team_members_team_company_fkey',
  'team_id, company_id', 'operational_teams', 'id, company_id', 'CASCADE'
);
SELECT private.add_composite_company_fk(
  'operational_team_members', 'operational_team_members_person_company_fkey',
  'person_id, company_id', 'customers', 'id, company_id', 'RESTRICT'
);
SELECT private.install_same_company_trigger(
  'operational_teams', 'contact_person_id', 'customers', 'trg_operational_teams_contact_same_company'
);
SELECT private.install_same_company_trigger(
  'operational_material_rules', 'material_catalog_item_id', 'catalog_items', 'trg_operational_material_rules_catalog_same_company'
);
SELECT private.add_composite_company_fk(
  'service_order_materials', 'service_order_materials_catalog_company_fkey',
  'catalog_item_id, company_id', 'catalog_items', 'id, company_id', 'RESTRICT'
);
SELECT private.add_composite_company_fk(
  'service_order_material_dispatch_confirmations', 'som_dispatch_order_company_fkey',
  'service_order_id, company_id', 'service_orders', 'id, company_id', 'CASCADE'
);
SELECT private.install_same_company_trigger(
  'service_order_material_dispatch_confirmations', 'team_id', 'operational_teams', 'trg_som_dispatch_team_same_company'
);
SELECT private.install_same_company_trigger(
  'service_order_material_dispatch_confirmations', 'leader_person_id', 'customers', 'trg_som_dispatch_person_same_company'
);

-- Covering indexes for the new tenant-key paths (finance/quote/order/inventory/agenda)
CREATE INDEX IF NOT EXISTS idx_quotes_customer_company
  ON public.quotes (customer_id, company_id)
  WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_event_company
  ON public.quotes (event_id, company_id)
  WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_package_company
  ON public.quotes (package_id, company_id)
  WHERE package_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_customer_company
  ON public.events (customer_id, company_id)
  WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agenda_events_team_company
  ON public.agenda_events (team_id, company_id);
CREATE INDEX IF NOT EXISTS idx_agenda_events_so_company
  ON public.agenda_events (service_order_id, company_id)
  WHERE service_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_documents_branch_company
  ON public.inventory_documents (branch_id, company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_document_lines_catalog_company
  ON public.inventory_document_lines (catalog_item_id, company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_catalog_company
  ON public.inventory_movements (catalog_item_id, company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_commitments_order_company
  ON public.inventory_commitments (service_order_id, company_id);
CREATE INDEX IF NOT EXISTS idx_package_items_package_company
  ON public.package_items (package_id, company_id);
CREATE INDEX IF NOT EXISTS idx_quote_package_selections_package_company
  ON public.quote_package_selections (package_id, company_id);
CREATE INDEX IF NOT EXISTS idx_public_quote_intake_quote_company
  ON public.public_quote_intake_sessions (quote_id, company_id)
  WHERE quote_id IS NOT NULL;

DROP FUNCTION IF EXISTS private.add_unique_id_company(text, text);
DROP FUNCTION IF EXISTS private.add_composite_company_fk(text, text, text, text, text, text);
DROP FUNCTION IF EXISTS private.install_same_company_trigger(text, text, text, text);

COMMENT ON FUNCTION private.assert_same_company_ref() IS
  'Issue #52: enforces child.company_id = parent.company_id for SET NULL / nullable tenant refs where a composite FK would null company_id.';

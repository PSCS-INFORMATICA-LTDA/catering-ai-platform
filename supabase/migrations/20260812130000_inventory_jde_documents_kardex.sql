-- =============================================================================
-- Inventory JDE Foundation V1 — Documents + Movement types + Kardex extensions
-- DEV ONLY: yasprgtlqclwsjcshtls
--
-- Códigos de movimento PROVISÓRIOS — PENDING PHILIPPE VALIDATION:
--   IB=Initial Balance, ED=Event Dispatch, ER=Event Return,
--   LR=Leftover Return, AI=Adjustment In, AO=Adjustment Out, TR=Transfer
--
-- Ledger permanece imutável (INSERT only). Correção = movimento compensatório.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) inventory_movement_types (platform standard; company_id NULL = global)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_movement_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  direction text NOT NULL,
  category text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movement_types_code_not_blank CHECK (length(trim(code)) > 0),
  CONSTRAINT inventory_movement_types_direction_check CHECK (direction IN ('in', 'out', 'both')),
  CONSTRAINT inventory_movement_types_category_check CHECK (
    category IN ('balance', 'event', 'adjustment', 'transfer', 'other')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_movement_types_global_code
  ON public.inventory_movement_types (code)
  WHERE company_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_movement_types_company_code
  ON public.inventory_movement_types (company_id, code)
  WHERE company_id IS NOT NULL;

COMMENT ON TABLE public.inventory_movement_types IS
  'Tipos/códigos de movimento. Seeds globais = PENDING PHILIPPE VALIDATION. Tenant pode estender.';

INSERT INTO public.inventory_movement_types (company_id, code, name, direction, category, description)
SELECT NULL, v.code, v.name, v.direction, v.category, v.description
FROM (VALUES
  ('IB', 'Initial Balance', 'in', 'balance', 'PENDING PHILIPPE VALIDATION'),
  ('ED', 'Event Dispatch', 'out', 'event', 'PENDING PHILIPPE VALIDATION'),
  ('ER', 'Event Return', 'in', 'event', 'PENDING PHILIPPE VALIDATION'),
  ('LR', 'Leftover Return', 'in', 'event', 'PENDING PHILIPPE VALIDATION'),
  ('AI', 'Adjustment In', 'in', 'adjustment', 'PENDING PHILIPPE VALIDATION — app definitivo futuro'),
  ('AO', 'Adjustment Out', 'out', 'adjustment', 'PENDING PHILIPPE VALIDATION — app definitivo futuro'),
  ('TR', 'Transfer', 'both', 'transfer', 'PENDING PHILIPPE VALIDATION — não implementar nesta fase')
) AS v(code, name, direction, category, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.inventory_movement_types t
  WHERE t.company_id IS NULL AND t.code = v.code
);

ALTER TABLE public.inventory_movement_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_movement_types_select ON public.inventory_movement_types;
CREATE POLICY inventory_movement_types_select
  ON public.inventory_movement_types FOR SELECT TO authenticated
  USING (company_id IS NULL OR private.is_company_member(company_id));

GRANT SELECT ON public.inventory_movement_types TO authenticated;
GRANT ALL ON public.inventory_movement_types TO service_role;

-- ---------------------------------------------------------------------------
-- 2) inventory_documents + lines
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  document_number text NOT NULL,
  document_type text NOT NULL,
  movement_code text NOT NULL,
  document_date date NOT NULL DEFAULT (timezone('utc', now()))::date,
  service_order_id uuid NULL REFERENCES public.service_orders (id) ON DELETE SET NULL,
  event_id uuid NULL REFERENCES public.events (id) ON DELETE SET NULL,
  from_location_id uuid NULL REFERENCES public.inventory_locations (id) ON DELETE SET NULL,
  to_location_id uuid NULL REFERENCES public.inventory_locations (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'posted',
  notes text NULL,
  idempotency_key text NOT NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_documents_number_not_blank CHECK (length(trim(document_number)) > 0),
  CONSTRAINT inventory_documents_type_check CHECK (
    document_type IN (
      'INITIAL_BALANCE',
      'EVENT_DISPATCH',
      'EVENT_RETURN',
      'LEFTOVER_RETURN',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
      'TRANSFER'
    )
  ),
  CONSTRAINT inventory_documents_status_check CHECK (
    status IN ('draft', 'posted', 'cancelled')
  ),
  CONSTRAINT inventory_documents_idempotency_not_blank CHECK (length(trim(idempotency_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_documents_idempotency
  ON public.inventory_documents (company_id, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_documents_number
  ON public.inventory_documents (company_id, branch_id, document_type, document_number);

CREATE INDEX IF NOT EXISTS idx_inventory_documents_branch_date
  ON public.inventory_documents (company_id, branch_id, document_date DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_documents_order
  ON public.inventory_documents (service_order_id)
  WHERE service_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.inventory_document_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.inventory_documents (id) ON DELETE CASCADE,
  line_number integer NOT NULL,
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items (id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES public.inventory_locations (id) ON DELETE RESTRICT,
  lot_id uuid NULL REFERENCES public.inventory_lots (id) ON DELETE RESTRICT,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  service_order_material_id uuid NULL REFERENCES public.service_order_materials (id) ON DELETE SET NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_document_lines_qty_nonzero CHECK (quantity <> 0),
  CONSTRAINT inventory_document_lines_unit_not_blank CHECK (length(trim(unit)) > 0),
  CONSTRAINT inventory_document_lines_unique UNIQUE (document_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_inventory_document_lines_doc
  ON public.inventory_document_lines (document_id);

ALTER TABLE public.inventory_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_document_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_documents_select ON public.inventory_documents;
CREATE POLICY inventory_documents_select
  ON public.inventory_documents FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS inventory_documents_insert ON public.inventory_documents;
CREATE POLICY inventory_documents_insert
  ON public.inventory_documents FOR INSERT TO authenticated
  WITH CHECK (private.is_company_member(company_id));

DROP POLICY IF EXISTS inventory_document_lines_select ON public.inventory_document_lines;
CREATE POLICY inventory_document_lines_select
  ON public.inventory_document_lines FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS inventory_document_lines_insert ON public.inventory_document_lines;
CREATE POLICY inventory_document_lines_insert
  ON public.inventory_document_lines FOR INSERT TO authenticated
  WITH CHECK (private.is_company_member(company_id));

GRANT SELECT, INSERT ON public.inventory_documents TO authenticated;
GRANT SELECT, INSERT ON public.inventory_document_lines TO authenticated;
GRANT ALL ON public.inventory_documents TO service_role;
GRANT ALL ON public.inventory_document_lines TO service_role;

-- Numbering sequence helper (per company/branch/type)
CREATE TABLE IF NOT EXISTS public.inventory_document_sequences (
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE CASCADE,
  document_type text NOT NULL,
  last_number bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, branch_id, document_type)
);

GRANT ALL ON public.inventory_document_sequences TO service_role;

CREATE OR REPLACE FUNCTION public.next_inventory_document_number(
  p_company_id uuid,
  p_branch_id uuid,
  p_document_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
BEGIN
  INSERT INTO public.inventory_document_sequences (company_id, branch_id, document_type, last_number)
  VALUES (p_company_id, p_branch_id, p_document_type, 1)
  ON CONFLICT (company_id, branch_id, document_type)
  DO UPDATE SET last_number = public.inventory_document_sequences.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN lpad(v_next::text, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_inventory_document_number(uuid, uuid, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Extend inventory_movements (Kardex / F4111-like)
-- ---------------------------------------------------------------------------

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS branch_id uuid NULL REFERENCES public.branches (id) ON DELETE RESTRICT;

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS lot_id uuid NULL REFERENCES public.inventory_lots (id) ON DELETE RESTRICT;

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS inventory_document_id uuid NULL REFERENCES public.inventory_documents (id) ON DELETE SET NULL;

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS document_number text NULL;

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS document_type text NULL;

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS movement_code text NULL;

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS line_number integer NULL;

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS direction text NULL;

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS event_id uuid NULL REFERENCES public.events (id) ON DELETE SET NULL;

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS transaction_uom text NULL;

-- Backfill branch from location
UPDATE public.inventory_movements m
SET
  branch_id = l.branch_id,
  direction = CASE WHEN m.quantity < 0 THEN 'out' ELSE 'in' END,
  transaction_uom = m.unit,
  movement_code = CASE m.movement_type
    WHEN 'initial_balance' THEN 'IB'
    WHEN 'event_dispatch' THEN 'ED'
    WHEN 'event_return' THEN 'ER'
    WHEN 'event_leftover_return' THEN 'LR'
    WHEN 'adjustment_in' THEN 'AI'
    WHEN 'adjustment_out' THEN 'AO'
    ELSE NULL
  END,
  document_type = CASE m.movement_type
    WHEN 'initial_balance' THEN 'INITIAL_BALANCE'
    WHEN 'event_dispatch' THEN 'EVENT_DISPATCH'
    WHEN 'event_return' THEN 'EVENT_RETURN'
    WHEN 'event_leftover_return' THEN 'LEFTOVER_RETURN'
    WHEN 'adjustment_in' THEN 'ADJUSTMENT_IN'
    WHEN 'adjustment_out' THEN 'ADJUSTMENT_OUT'
    ELSE NULL
  END
FROM public.inventory_locations l
WHERE m.location_id = l.id
  AND m.branch_id IS NULL;

DO $$
DECLARE
  r record;
  v_branch uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT company_id FROM public.inventory_movements WHERE branch_id IS NULL
  LOOP
    v_branch := public.ensure_default_branch(r.company_id);
    UPDATE public.inventory_movements
    SET branch_id = v_branch
    WHERE company_id = r.company_id AND branch_id IS NULL;
  END LOOP;
END $$;

ALTER TABLE public.inventory_movements
  ALTER COLUMN branch_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_document
  ON public.inventory_movements (inventory_document_id)
  WHERE inventory_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_branch_item
  ON public.inventory_movements (company_id, branch_id, catalog_item_id, occurred_at DESC);

COMMENT ON COLUMN public.inventory_movements.movement_code IS
  'Código provisório (IB/ED/ER/LR/AI/AO/TR) — PENDING PHILIPPE VALIDATION.';

-- ---------------------------------------------------------------------------
-- 4) Map helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.inventory_movement_code_for_type(p_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_type
    WHEN 'initial_balance' THEN 'IB'
    WHEN 'event_dispatch' THEN 'ED'
    WHEN 'event_return' THEN 'ER'
    WHEN 'event_leftover_return' THEN 'LR'
    WHEN 'adjustment_in' THEN 'AI'
    WHEN 'adjustment_out' THEN 'AO'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_document_type_for_movement(p_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_type
    WHEN 'initial_balance' THEN 'INITIAL_BALANCE'
    WHEN 'event_dispatch' THEN 'EVENT_DISPATCH'
    WHEN 'event_return' THEN 'EVENT_RETURN'
    WHEN 'event_leftover_return' THEN 'LEFTOVER_RETURN'
    WHEN 'adjustment_in' THEN 'ADJUSTMENT_IN'
    WHEN 'adjustment_out' THEN 'ADJUSTMENT_OUT'
    ELSE NULL
  END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Replace post_inventory_movement — branch/lot/document + in_event
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.post_inventory_movement(
  uuid, uuid, uuid, text, numeric, text, text, text, text, uuid, uuid, text, uuid, timestamptz, boolean
);

CREATE OR REPLACE FUNCTION public.post_inventory_movement(
  p_company_id uuid,
  p_location_id uuid,
  p_catalog_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_unit text,
  p_idempotency_key text,
  p_source_type text DEFAULT NULL,
  p_source_id text DEFAULT NULL,
  p_service_order_id uuid DEFAULT NULL,
  p_service_order_material_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_actor uuid DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT NULL,
  p_allow_negative boolean DEFAULT false,
  p_lot_id uuid DEFAULT NULL,
  p_inventory_document_id uuid DEFAULT NULL,
  p_document_number text DEFAULT NULL,
  p_line_number integer DEFAULT NULL,
  p_event_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.inventory_movements%ROWTYPE;
  v_bal public.inventory_balances%ROWTYPE;
  v_item record;
  v_loc record;
  v_unit text;
  v_new_qty numeric;
  v_new_in_event numeric;
  v_movement_id uuid;
  v_occurred timestamptz;
  v_code text;
  v_doc_type text;
  v_direction text;
BEGIN
  IF p_company_id IS NULL OR p_location_id IS NULL OR p_catalog_item_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_required_ids');
  END IF;
  IF p_quantity IS NULL OR p_quantity = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_quantity');
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'idempotency_required');
  END IF;

  v_unit := lower(trim(COALESCE(p_unit, '')));
  IF length(v_unit) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unit_required');
  END IF;

  v_occurred := COALESCE(p_occurred_at, now());
  v_code := public.inventory_movement_code_for_type(p_movement_type);
  v_doc_type := public.inventory_document_type_for_movement(p_movement_type);
  v_direction := CASE WHEN p_quantity < 0 THEN 'out' ELSE 'in' END;

  SELECT * INTO v_existing
  FROM public.inventory_movements
  WHERE company_id = p_company_id
    AND idempotency_key = trim(p_idempotency_key);

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'movement_id', v_existing.id,
      'inventory_document_id', v_existing.inventory_document_id,
      'quantity_on_hand', (
        SELECT quantity_on_hand FROM public.inventory_balances
        WHERE company_id = p_company_id
          AND location_id = p_location_id
          AND catalog_item_id = p_catalog_item_id
          AND lot_id IS NOT DISTINCT FROM p_lot_id
      )
    );
  END IF;

  SELECT
    id, company_id, inventory_enabled, lot_control_enabled,
    lower(trim(COALESCE(unit, stock_unit, ''))) AS item_unit
  INTO v_item
  FROM public.catalog_items
  WHERE id = p_catalog_item_id
  FOR SHARE;

  IF NOT FOUND OR v_item.company_id <> p_company_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'catalog_item_not_found');
  END IF;

  IF COALESCE(v_item.inventory_enabled, false) IS NOT TRUE
     AND p_movement_type NOT IN ('initial_balance', 'adjustment_in', 'adjustment_out') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'inventory_not_enabled');
  END IF;

  IF COALESCE(v_item.lot_control_enabled, false) IS TRUE
     AND p_lot_id IS NULL
     AND p_movement_type IN ('event_dispatch', 'event_return', 'event_leftover_return', 'initial_balance') THEN
    -- Foundation: warn via soft allow for now? Plan says selection should exist.
    -- Keep soft: allow NULL in V1 foundation seed; enforce later.
    NULL;
  END IF;

  SELECT id, company_id, branch_id, active INTO v_loc
  FROM public.inventory_locations
  WHERE id = p_location_id
  FOR SHARE;

  IF NOT FOUND OR v_loc.company_id <> p_company_id OR v_loc.active IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_invalid');
  END IF;

  IF v_item.item_unit IS NOT NULL AND length(v_item.item_unit) > 0 AND v_item.item_unit <> v_unit THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'unit_mismatch',
      'expected_unit', v_item.item_unit,
      'got_unit', v_unit
    );
  END IF;

  SELECT * INTO v_bal
  FROM public.inventory_balances
  WHERE company_id = p_company_id
    AND branch_id = v_loc.branch_id
    AND location_id = p_location_id
    AND catalog_item_id = p_catalog_item_id
    AND lot_id IS NOT DISTINCT FROM p_lot_id
  FOR UPDATE;

  IF FOUND THEN
    IF lower(trim(v_bal.unit)) <> v_unit THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'unit_mismatch',
        'expected_unit', lower(trim(v_bal.unit)),
        'got_unit', v_unit
      );
    END IF;
    v_new_qty := v_bal.quantity_on_hand + p_quantity;
    v_new_in_event := COALESCE(v_bal.quantity_in_event, 0);
  ELSE
    v_new_qty := p_quantity;
    v_new_in_event := 0;
  END IF;

  -- Negative stock BLOCK for physical OUT
  IF p_allow_negative IS NOT TRUE
     AND v_new_qty < 0
     AND p_movement_type IN ('event_dispatch', 'adjustment_out') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'negative_stock_blocked',
      'quantity_on_hand', COALESCE(v_bal.quantity_on_hand, 0),
      'requested_delta', p_quantity
    );
  END IF;

  -- In Event bucket
  IF p_movement_type = 'event_dispatch' THEN
    v_new_in_event := v_new_in_event + ABS(p_quantity);
  ELSIF p_movement_type IN ('event_return', 'event_leftover_return') AND p_quantity > 0 THEN
    v_new_in_event := GREATEST(0, v_new_in_event - p_quantity);
  END IF;

  INSERT INTO public.inventory_movements (
    company_id, branch_id, location_id, catalog_item_id, lot_id,
    movement_type, movement_code, document_type, document_number,
    inventory_document_id, line_number, direction,
    quantity, unit, transaction_uom,
    source_type, source_id, service_order_id, service_order_material_id, event_id,
    idempotency_key, occurred_at, notes, created_by
  ) VALUES (
    p_company_id, v_loc.branch_id, p_location_id, p_catalog_item_id, p_lot_id,
    p_movement_type, v_code, v_doc_type, p_document_number,
    p_inventory_document_id, p_line_number, v_direction,
    p_quantity, v_unit, v_unit,
    p_source_type, p_source_id, p_service_order_id, p_service_order_material_id, p_event_id,
    trim(p_idempotency_key), v_occurred, NULLIF(trim(COALESCE(p_notes, '')), ''), p_actor
  )
  RETURNING id INTO v_movement_id;

  IF v_bal.id IS NOT NULL THEN
    UPDATE public.inventory_balances
    SET
      quantity_on_hand = v_new_qty,
      quantity_in_event = v_new_in_event,
      last_movement_at = v_occurred,
      updated_at = now()
    WHERE id = v_bal.id;
  ELSE
    INSERT INTO public.inventory_balances (
      company_id, branch_id, location_id, catalog_item_id, lot_id,
      quantity_on_hand, quantity_committed, quantity_in_event, quantity_on_receipt,
      unit, last_movement_at
    ) VALUES (
      p_company_id, v_loc.branch_id, p_location_id, p_catalog_item_id, p_lot_id,
      v_new_qty, 0, v_new_in_event, 0,
      v_unit, v_occurred
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'movement_id', v_movement_id,
    'inventory_document_id', p_inventory_document_id,
    'quantity_on_hand', v_new_qty,
    'quantity_in_event', v_new_in_event
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.inventory_movements
    WHERE company_id = p_company_id
      AND idempotency_key = trim(p_idempotency_key);
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'movement_id', v_existing.id,
      'inventory_document_id', v_existing.inventory_document_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_inventory_movement(
  uuid, uuid, uuid, text, numeric, text, text, text, text, uuid, uuid, text, uuid, timestamptz, boolean,
  uuid, uuid, text, integer, uuid
) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6) Post OS dispatch as EVENT_DISPATCH document (header + lines + kardex)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.post_inventory_for_order_dispatch(
  p_company_id uuid,
  p_service_order_id uuid,
  p_actor uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loc uuid;
  v_branch uuid;
  v_mat record;
  v_item record;
  v_res jsonb;
  v_posted int := 0;
  v_skipped int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_doc_id uuid;
  v_doc_number text;
  v_doc_key text;
  v_line int := 0;
  v_event_id uuid;
  v_commitment_id uuid;
BEGIN
  v_loc := public.ensure_default_inventory_location(p_company_id, p_actor, 'Main Stock');
  SELECT branch_id INTO v_branch FROM public.inventory_locations WHERE id = v_loc;
  SELECT event_id INTO v_event_id FROM public.service_orders WHERE id = p_service_order_id;

  v_doc_key := 'EVENT_DISPATCH:' || p_service_order_id::text;

  SELECT id, document_number INTO v_doc_id, v_doc_number
  FROM public.inventory_documents
  WHERE company_id = p_company_id AND idempotency_key = v_doc_key;

  IF v_doc_id IS NULL THEN
    v_doc_number := public.next_inventory_document_number(
      p_company_id, v_branch, 'EVENT_DISPATCH'
    );
    INSERT INTO public.inventory_documents (
      company_id, branch_id, document_number, document_type, movement_code,
      document_date, service_order_id, event_id, from_location_id,
      status, idempotency_key, created_by
    ) VALUES (
      p_company_id, v_branch, v_doc_number, 'EVENT_DISPATCH', 'ED',
      (timezone('utc', now()))::date, p_service_order_id, v_event_id, v_loc,
      'posted', v_doc_key, p_actor
    )
    RETURNING id INTO v_doc_id;
  END IF;

  FOR v_mat IN
    SELECT *
    FROM public.service_order_materials
    WHERE company_id = p_company_id
      AND service_order_id = p_service_order_id
      AND status = 'dispatched'
      AND COALESCE(dispatched_quantity, 0) > 0
    FOR UPDATE
  LOOP
    IF v_mat.catalog_item_id IS NULL THEN
      UPDATE public.service_order_materials
      SET stock_posting_status = 'not_applicable', updated_at = now()
      WHERE id = v_mat.id
        AND COALESCE(stock_posting_status, '') IS DISTINCT FROM 'posted';
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT id, inventory_enabled, lower(trim(COALESCE(unit, stock_unit, ''))) AS item_unit
    INTO v_item
    FROM public.catalog_items
    WHERE id = v_mat.catalog_item_id
      AND company_id = p_company_id;

    IF NOT FOUND OR COALESCE(v_item.inventory_enabled, false) IS NOT TRUE THEN
      UPDATE public.service_order_materials
      SET stock_posting_status = 'not_applicable', updated_at = now()
      WHERE id = v_mat.id;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF v_mat.material_type = 'disposable'
       AND COALESCE(v_mat.stock_posting_status, '') = 'not_applicable' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_line := v_line + 1;

    IF NOT EXISTS (
      SELECT 1 FROM public.inventory_document_lines
      WHERE document_id = v_doc_id AND service_order_material_id = v_mat.id
    ) THEN
      INSERT INTO public.inventory_document_lines (
        company_id, document_id, line_number, catalog_item_id, location_id,
        quantity, unit, service_order_material_id
      ) VALUES (
        p_company_id, v_doc_id, v_line, v_mat.catalog_item_id, v_loc,
        -ABS(v_mat.dispatched_quantity), lower(trim(v_mat.unit)), v_mat.id
      );
    END IF;

    v_res := public.post_inventory_movement(
      p_company_id,
      v_loc,
      v_mat.catalog_item_id,
      'event_dispatch',
      -ABS(v_mat.dispatched_quantity),
      lower(trim(v_mat.unit)),
      'event_dispatch:' || v_mat.id::text,
      'service_order_material',
      v_mat.id::text,
      p_service_order_id,
      v_mat.id,
      NULL,
      p_actor,
      v_mat.dispatched_at,
      false,
      NULL,
      v_doc_id,
      v_doc_number,
      v_line,
      v_event_id
    );

    IF COALESCE((v_res->>'ok')::boolean, false) IS NOT TRUE THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'material_id', v_mat.id,
        'error', v_res->>'error'
      ));
      CONTINUE;
    END IF;

    SELECT id INTO v_commitment_id
    FROM public.inventory_commitments
    WHERE company_id = p_company_id
      AND service_order_material_id = v_mat.id
      AND status = 'active'
    LIMIT 1;

    IF v_commitment_id IS NOT NULL THEN
      PERFORM public.release_inventory_commitment(
        p_company_id, v_commitment_id, 'consumed', p_actor
      );
    END IF;

    UPDATE public.service_order_materials
    SET stock_posting_status = 'posted', updated_at = now()
    WHERE id = v_mat.id;
    v_posted := v_posted + 1;
  END LOOP;

  IF jsonb_array_length(v_errors) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'inventory_posting_failed',
      'document_id', v_doc_id,
      'document_number', v_doc_number,
      'posted', v_posted,
      'skipped', v_skipped,
      'errors', v_errors
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'document_id', v_doc_id,
    'document_number', v_doc_number,
    'posted', v_posted,
    'skipped', v_skipped
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_inventory_for_order_dispatch(uuid, uuid, uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7) Return / leftover as separate documents
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.post_inventory_for_material_return(
  p_company_id uuid,
  p_material_id uuid,
  p_actor uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mat public.service_order_materials%ROWTYPE;
  v_item record;
  v_loc uuid;
  v_branch uuid;
  v_posted_return numeric;
  v_posted_leftover numeric;
  v_delta numeric;
  v_target numeric;
  v_res jsonb;
  v_results jsonb := '[]'::jsonb;
  v_doc_id uuid;
  v_doc_number text;
  v_doc_key text;
  v_event_id uuid;
BEGIN
  SELECT * INTO v_mat
  FROM public.service_order_materials
  WHERE id = p_material_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'material_not_found');
  END IF;

  IF v_mat.catalog_item_id IS NULL THEN
    UPDATE public.service_order_materials
    SET stock_posting_status = 'not_applicable', updated_at = now()
    WHERE id = v_mat.id;
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'no_catalog_item');
  END IF;

  SELECT id, inventory_enabled INTO v_item
  FROM public.catalog_items
  WHERE id = v_mat.catalog_item_id AND company_id = p_company_id;

  IF NOT FOUND OR COALESCE(v_item.inventory_enabled, false) IS NOT TRUE THEN
    UPDATE public.service_order_materials
    SET stock_posting_status = 'not_applicable', updated_at = now()
    WHERE id = v_mat.id;
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'inventory_disabled');
  END IF;

  v_loc := public.ensure_default_inventory_location(p_company_id, p_actor, 'Main Stock');
  SELECT branch_id INTO v_branch FROM public.inventory_locations WHERE id = v_loc;
  SELECT event_id INTO v_event_id FROM public.service_orders WHERE id = v_mat.service_order_id;

  IF v_mat.material_type IN ('returnable', 'equipment') THEN
    SELECT COALESCE(SUM(quantity), 0) INTO v_posted_return
    FROM public.inventory_movements
    WHERE company_id = p_company_id
      AND service_order_material_id = v_mat.id
      AND movement_type = 'event_return';

    v_target := COALESCE(v_mat.returned_quantity, 0);
    v_delta := v_target - v_posted_return;

    IF v_delta <> 0 THEN
      v_doc_key := 'EVENT_RETURN:' || v_mat.id::text || ':to:' || trim(to_char(v_target, 'FM999999999.999999'));
      SELECT id, document_number INTO v_doc_id, v_doc_number
      FROM public.inventory_documents
      WHERE company_id = p_company_id AND idempotency_key = v_doc_key;

      IF v_doc_id IS NULL THEN
        v_doc_number := public.next_inventory_document_number(
          p_company_id, v_branch, 'EVENT_RETURN'
        );
        INSERT INTO public.inventory_documents (
          company_id, branch_id, document_number, document_type, movement_code,
          document_date, service_order_id, event_id, to_location_id,
          status, idempotency_key, created_by
        ) VALUES (
          p_company_id, v_branch, v_doc_number, 'EVENT_RETURN', 'ER',
          (timezone('utc', now()))::date, v_mat.service_order_id, v_event_id, v_loc,
          'posted', v_doc_key, p_actor
        )
        RETURNING id INTO v_doc_id;

        INSERT INTO public.inventory_document_lines (
          company_id, document_id, line_number, catalog_item_id, location_id,
          quantity, unit, service_order_material_id
        ) VALUES (
          p_company_id, v_doc_id, 1, v_mat.catalog_item_id, v_loc,
          v_delta, lower(trim(v_mat.unit)), v_mat.id
        );
      END IF;

      v_res := public.post_inventory_movement(
        p_company_id, v_loc, v_mat.catalog_item_id,
        'event_return', v_delta, lower(trim(v_mat.unit)),
        'event_return:' || v_mat.id::text || ':to:' || trim(to_char(v_target, 'FM999999999.999999')),
        'service_order_material', v_mat.id::text,
        v_mat.service_order_id, v_mat.id,
        NULL, p_actor, COALESCE(v_mat.returned_at, now()), true,
        NULL, v_doc_id, v_doc_number, 1, v_event_id
      );
      IF COALESCE((v_res->>'ok')::boolean, false) IS NOT TRUE THEN
        RETURN jsonb_build_object('ok', false, 'error', v_res->>'error', 'phase', 'return');
      END IF;
      v_results := v_results || jsonb_build_array(v_res);
    END IF;
  END IF;

  IF v_mat.material_type = 'consumable' THEN
    SELECT COALESCE(SUM(quantity), 0) INTO v_posted_leftover
    FROM public.inventory_movements
    WHERE company_id = p_company_id
      AND service_order_material_id = v_mat.id
      AND movement_type = 'event_leftover_return';

    v_target := COALESCE(v_mat.leftover_quantity, 0);
    v_delta := v_target - v_posted_leftover;

    IF v_delta <> 0 THEN
      v_doc_key := 'LEFTOVER_RETURN:' || v_mat.id::text || ':to:' || trim(to_char(v_target, 'FM999999999.999999'));
      SELECT id, document_number INTO v_doc_id, v_doc_number
      FROM public.inventory_documents
      WHERE company_id = p_company_id AND idempotency_key = v_doc_key;

      IF v_doc_id IS NULL THEN
        v_doc_number := public.next_inventory_document_number(
          p_company_id, v_branch, 'LEFTOVER_RETURN'
        );
        INSERT INTO public.inventory_documents (
          company_id, branch_id, document_number, document_type, movement_code,
          document_date, service_order_id, event_id, to_location_id,
          status, idempotency_key, created_by
        ) VALUES (
          p_company_id, v_branch, v_doc_number, 'LEFTOVER_RETURN', 'LR',
          (timezone('utc', now()))::date, v_mat.service_order_id, v_event_id, v_loc,
          'posted', v_doc_key, p_actor
        )
        RETURNING id INTO v_doc_id;

        INSERT INTO public.inventory_document_lines (
          company_id, document_id, line_number, catalog_item_id, location_id,
          quantity, unit, service_order_material_id
        ) VALUES (
          p_company_id, v_doc_id, 1, v_mat.catalog_item_id, v_loc,
          v_delta, lower(trim(v_mat.unit)), v_mat.id
        );
      END IF;

      v_res := public.post_inventory_movement(
        p_company_id, v_loc, v_mat.catalog_item_id,
        'event_leftover_return', v_delta, lower(trim(v_mat.unit)),
        'event_leftover_return:' || v_mat.id::text || ':to:' || trim(to_char(v_target, 'FM999999999.999999')),
        'service_order_material', v_mat.id::text,
        v_mat.service_order_id, v_mat.id,
        NULL, p_actor, COALESCE(v_mat.returned_at, now()), true,
        NULL, v_doc_id, v_doc_number, 1, v_event_id
      );
      IF COALESCE((v_res->>'ok')::boolean, false) IS NOT TRUE THEN
        RETURN jsonb_build_object('ok', false, 'error', v_res->>'error', 'phase', 'leftover');
      END IF;
      v_results := v_results || jsonb_build_array(v_res);
    END IF;
  END IF;

  UPDATE public.service_order_materials
  SET stock_posting_status = 'posted', updated_at = now()
  WHERE id = v_mat.id;

  RETURN jsonb_build_object('ok', true, 'results', v_results);
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_inventory_for_material_return(uuid, uuid, uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8) Rebuild with lot/branch from movements
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rebuild_inventory_balances(
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows int := 0;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS tmp_inv_bal_buckets (
    company_id uuid,
    branch_id uuid,
    location_id uuid,
    catalog_item_id uuid,
    lot_id uuid,
    quantity_committed numeric,
    quantity_in_event numeric,
    quantity_on_receipt numeric
  ) ON COMMIT DROP;

  DELETE FROM tmp_inv_bal_buckets;

  INSERT INTO tmp_inv_bal_buckets
  SELECT
    company_id, branch_id, location_id, catalog_item_id, lot_id,
    quantity_committed, quantity_in_event, quantity_on_receipt
  FROM public.inventory_balances
  WHERE p_company_id IS NULL OR company_id = p_company_id;

  IF p_company_id IS NULL THEN
    DELETE FROM public.inventory_balances;
  ELSE
    DELETE FROM public.inventory_balances WHERE company_id = p_company_id;
  END IF;

  INSERT INTO public.inventory_balances (
    company_id, branch_id, location_id, catalog_item_id, lot_id,
    quantity_on_hand, quantity_committed, quantity_in_event, quantity_on_receipt,
    unit, last_movement_at
  )
  SELECT
    m.company_id,
    COALESCE(m.branch_id, l.branch_id),
    m.location_id,
    m.catalog_item_id,
    m.lot_id,
    SUM(m.quantity),
    0,
    0,
    0,
    MIN(m.unit),
    MAX(m.occurred_at)
  FROM public.inventory_movements m
  JOIN public.inventory_locations l ON l.id = m.location_id
  WHERE p_company_id IS NULL OR m.company_id = p_company_id
  GROUP BY
    m.company_id,
    COALESCE(m.branch_id, l.branch_id),
    m.location_id,
    m.catalog_item_id,
    m.lot_id;

  UPDATE public.inventory_balances b
  SET
    quantity_committed = t.quantity_committed,
    quantity_in_event = t.quantity_in_event,
    quantity_on_receipt = t.quantity_on_receipt,
    updated_at = now()
  FROM tmp_inv_bal_buckets t
  WHERE b.company_id = t.company_id
    AND b.branch_id = t.branch_id
    AND b.location_id = t.location_id
    AND b.catalog_item_id = t.catalog_item_id
    AND b.lot_id IS NOT DISTINCT FROM t.lot_id;

  -- Re-sync committed from active commitments
  UPDATE public.inventory_balances b
  SET quantity_committed = COALESCE((
    SELECT SUM(c.quantity)
    FROM public.inventory_commitments c
    WHERE c.company_id = b.company_id
      AND c.branch_id = b.branch_id
      AND c.location_id = b.location_id
      AND c.catalog_item_id = b.catalog_item_id
      AND c.lot_id IS NOT DISTINCT FROM b.lot_id
      AND c.status = 'active'
  ), 0)
  WHERE p_company_id IS NULL OR b.company_id = p_company_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'balances', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rebuild_inventory_balances(uuid)
  TO service_role;

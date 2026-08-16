-- =============================================================================
-- Inventory JDE Foundation V1 — Commitments (reservas por OS)
-- DEV ONLY: yasprgtlqclwsjcshtls
-- Reserva NÃO gera Kardex e NÃO reduz On Hand.
-- AVAILABLE = On Hand - Committed.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES public.inventory_locations (id) ON DELETE RESTRICT,
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items (id) ON DELETE RESTRICT,
  lot_id uuid NULL REFERENCES public.inventory_lots (id) ON DELETE RESTRICT,
  service_order_id uuid NOT NULL REFERENCES public.service_orders (id) ON DELETE CASCADE,
  service_order_material_id uuid NOT NULL REFERENCES public.service_order_materials (id) ON DELETE CASCADE,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  committed_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz NULL,
  consumed_at timestamptz NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_commitments_qty_positive CHECK (quantity > 0),
  CONSTRAINT inventory_commitments_unit_not_blank CHECK (length(trim(unit)) > 0),
  CONSTRAINT inventory_commitments_status_check CHECK (
    status IN ('active', 'released', 'consumed', 'cancelled')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_commitments_active_material
  ON public.inventory_commitments (company_id, service_order_material_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_inventory_commitments_item_active
  ON public.inventory_commitments (company_id, branch_id, location_id, catalog_item_id, status);

CREATE INDEX IF NOT EXISTS idx_inventory_commitments_order
  ON public.inventory_commitments (service_order_id, status);

COMMENT ON TABLE public.inventory_commitments IS
  'Reservas rastreadas por linha de material da OS. Não postam Kardex.';

ALTER TABLE public.inventory_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_commitments_select ON public.inventory_commitments;
CREATE POLICY inventory_commitments_select
  ON public.inventory_commitments FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS inventory_commitments_write ON public.inventory_commitments;
CREATE POLICY inventory_commitments_write
  ON public.inventory_commitments FOR ALL TO authenticated
  USING (private.is_company_member(company_id))
  WITH CHECK (private.is_company_member(company_id));

GRANT SELECT, INSERT, UPDATE ON public.inventory_commitments TO authenticated;
GRANT ALL ON public.inventory_commitments TO service_role;

-- ---------------------------------------------------------------------------
-- Helper: sync quantity_committed on balance row
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_inventory_committed_qty(
  p_company_id uuid,
  p_branch_id uuid,
  p_location_id uuid,
  p_catalog_item_id uuid,
  p_lot_id uuid,
  p_unit text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum numeric;
  v_unit text;
  v_id uuid;
BEGIN
  v_unit := lower(trim(COALESCE(p_unit, 'unit')));

  SELECT COALESCE(SUM(quantity), 0) INTO v_sum
  FROM public.inventory_commitments
  WHERE company_id = p_company_id
    AND branch_id = p_branch_id
    AND location_id = p_location_id
    AND catalog_item_id = p_catalog_item_id
    AND lot_id IS NOT DISTINCT FROM p_lot_id
    AND status = 'active';

  SELECT id INTO v_id
  FROM public.inventory_balances
  WHERE company_id = p_company_id
    AND branch_id = p_branch_id
    AND location_id = p_location_id
    AND catalog_item_id = p_catalog_item_id
    AND lot_id IS NOT DISTINCT FROM p_lot_id
  FOR UPDATE;

  IF v_id IS NOT NULL THEN
    UPDATE public.inventory_balances
    SET quantity_committed = v_sum, updated_at = now()
    WHERE id = v_id;
  ELSE
    INSERT INTO public.inventory_balances (
      company_id, branch_id, location_id, catalog_item_id, lot_id,
      quantity_on_hand, quantity_committed, quantity_in_event, quantity_on_receipt,
      unit, updated_at
    ) VALUES (
      p_company_id, p_branch_id, p_location_id, p_catalog_item_id, p_lot_id,
      0, v_sum, 0, 0, v_unit, now()
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_inventory_committed_qty(uuid, uuid, uuid, uuid, uuid, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- create / release / consume commitment
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_inventory_commitment(
  p_company_id uuid,
  p_service_order_material_id uuid,
  p_quantity numeric DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_lot_id uuid DEFAULT NULL,
  p_actor uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mat public.service_order_materials%ROWTYPE;
  v_loc public.inventory_locations%ROWTYPE;
  v_qty numeric;
  v_id uuid;
  v_existing uuid;
BEGIN
  SELECT * INTO v_mat
  FROM public.service_order_materials
  WHERE id = p_service_order_material_id
    AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'material_not_found');
  END IF;

  IF v_mat.catalog_item_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'catalog_item_required');
  END IF;

  SELECT id INTO v_existing
  FROM public.inventory_commitments
  WHERE company_id = p_company_id
    AND service_order_material_id = v_mat.id
    AND status = 'active'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'commitment_id', v_existing);
  END IF;

  v_qty := COALESCE(p_quantity, v_mat.required_quantity, 0);
  IF v_qty <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_quantity');
  END IF;

  IF p_location_id IS NOT NULL THEN
    SELECT * INTO v_loc FROM public.inventory_locations WHERE id = p_location_id;
  ELSE
    SELECT * INTO v_loc
    FROM public.inventory_locations
    WHERE id = public.ensure_default_inventory_location(p_company_id, p_actor);
  END IF;

  IF NOT FOUND OR v_loc.company_id <> p_company_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_invalid');
  END IF;

  INSERT INTO public.inventory_commitments (
    company_id, branch_id, location_id, catalog_item_id, lot_id,
    service_order_id, service_order_material_id,
    quantity, unit, status, created_by
  ) VALUES (
    p_company_id, v_loc.branch_id, v_loc.id, v_mat.catalog_item_id, p_lot_id,
    v_mat.service_order_id, v_mat.id,
    v_qty, lower(trim(v_mat.unit)), 'active', p_actor
  )
  RETURNING id INTO v_id;

  PERFORM public.sync_inventory_committed_qty(
    p_company_id, v_loc.branch_id, v_loc.id, v_mat.catalog_item_id, p_lot_id,
    lower(trim(v_mat.unit))
  );

  RETURN jsonb_build_object('ok', true, 'commitment_id', v_id, 'quantity', v_qty);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_inventory_commitment(uuid, uuid, numeric, uuid, uuid, uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.release_inventory_commitment(
  p_company_id uuid,
  p_commitment_id uuid,
  p_new_status text DEFAULT 'released',
  p_actor uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.inventory_commitments%ROWTYPE;
BEGIN
  IF p_new_status NOT IN ('released', 'cancelled', 'consumed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  SELECT * INTO v_row
  FROM public.inventory_commitments
  WHERE id = p_commitment_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'commitment_not_found');
  END IF;

  IF v_row.status <> 'active' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'status', v_row.status);
  END IF;

  UPDATE public.inventory_commitments
  SET
    status = p_new_status,
    released_at = CASE WHEN p_new_status IN ('released', 'cancelled') THEN now() ELSE released_at END,
    consumed_at = CASE WHEN p_new_status = 'consumed' THEN now() ELSE consumed_at END
  WHERE id = v_row.id;

  PERFORM public.sync_inventory_committed_qty(
    v_row.company_id, v_row.branch_id, v_row.location_id, v_row.catalog_item_id,
    v_row.lot_id, v_row.unit
  );

  RETURN jsonb_build_object('ok', true, 'status', p_new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_inventory_commitment(uuid, uuid, text, uuid)
  TO authenticated, service_role;

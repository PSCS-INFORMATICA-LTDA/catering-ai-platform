-- =============================================================================
-- Fix rebuild_inventory_balances — DELETE requires WHERE (DEV safety)
-- DEV ONLY: yasprgtlqclwsjcshtls
-- Already applied on remote DEV; present here to sync Git ↔ Supabase history.
-- =============================================================================

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

  DELETE FROM tmp_inv_bal_buckets WHERE true;

  INSERT INTO tmp_inv_bal_buckets
  SELECT
    company_id, branch_id, location_id, catalog_item_id, lot_id,
    quantity_committed, quantity_in_event, quantity_on_receipt
  FROM public.inventory_balances
  WHERE p_company_id IS NULL OR company_id = p_company_id;

  IF p_company_id IS NULL THEN
    DELETE FROM public.inventory_balances WHERE true;
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

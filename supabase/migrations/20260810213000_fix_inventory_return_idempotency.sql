-- Fix idempotency keys for return/leftover deltas (absolute :to:N collided on corrections)

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
  v_posted_return numeric;
  v_posted_leftover numeric;
  v_delta numeric;
  v_target numeric;
  v_res jsonb;
  v_results jsonb := '[]'::jsonb;
  v_key text;
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

  IF v_mat.material_type IN ('returnable', 'equipment') THEN
    SELECT COALESCE(SUM(quantity), 0) INTO v_posted_return
    FROM public.inventory_movements
    WHERE company_id = p_company_id
      AND service_order_material_id = v_mat.id
      AND movement_type = 'event_return';

    v_target := COALESCE(v_mat.returned_quantity, 0);
    v_delta := v_target - v_posted_return;

    IF v_delta <> 0 THEN
      v_key :=
        'event_return:' || v_mat.id::text || ':' ||
        trim(to_char(v_posted_return, 'FM999999999.999999')) || '->' ||
        trim(to_char(v_target, 'FM999999999.999999'));
      v_res := public.post_inventory_movement(
        p_company_id, v_loc, v_mat.catalog_item_id,
        'event_return', v_delta, lower(trim(v_mat.unit)),
        v_key,
        'service_order_material', v_mat.id::text,
        v_mat.service_order_id, v_mat.id,
        NULL, p_actor, COALESCE(v_mat.returned_at, now()), true
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
      v_key :=
        'event_leftover_return:' || v_mat.id::text || ':' ||
        trim(to_char(v_posted_leftover, 'FM999999999.999999')) || '->' ||
        trim(to_char(v_target, 'FM999999999.999999'));
      v_res := public.post_inventory_movement(
        p_company_id, v_loc, v_mat.catalog_item_id,
        'event_leftover_return', v_delta, lower(trim(v_mat.unit)),
        v_key,
        'service_order_material', v_mat.id::text,
        v_mat.service_order_id, v_mat.id,
        NULL, p_actor, COALESCE(v_mat.returned_at, now()), true
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

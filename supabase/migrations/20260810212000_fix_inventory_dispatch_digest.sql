-- Fix digest() in confirm_public_material_dispatch (inventory hook)
-- Same pattern as 20260810191000 / 20260810192000

CREATE OR REPLACE FUNCTION public.confirm_public_material_dispatch(
  p_token text,
  p_lines jsonb DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
  v_row public.service_order_material_dispatch_confirmations%ROWTYPE;
  v_now timestamptz := now();
  v_line jsonb;
  v_mat public.service_order_materials%ROWTYPE;
  v_mat_id uuid;
  v_qty numeric;
  v_just text;
  v_has_divergence boolean := false;
  v_inv jsonb;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  v_hash := encode(digest(convert_to(trim(p_token), 'UTF8'), 'sha256'), 'hex');

  SELECT * INTO v_row
  FROM public.service_order_material_dispatch_confirmations
  WHERE token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_row.status = 'revoked' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'revoked', 'status', 'revoked');
  END IF;

  IF v_row.status = 'confirmed' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'status', 'confirmed');
  END IF;

  IF v_row.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status', 'status', v_row.status);
  END IF;

  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < v_now THEN
    UPDATE public.service_order_material_dispatch_confirmations
    SET status = 'expired', updated_at = v_now
    WHERE id = v_row.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  IF p_lines IS NOT NULL AND jsonb_typeof(p_lines) = 'array' AND jsonb_array_length(p_lines) > 0 THEN
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      BEGIN
        v_mat_id := (v_line->>'id')::uuid;
      EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_line');
      END;

      v_qty := NULLIF(v_line->>'dispatched_quantity', '')::numeric;
      v_just := NULLIF(trim(COALESCE(v_line->>'justification', '')), '');

      IF v_qty IS NULL OR v_qty < 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_quantity');
      END IF;

      SELECT m.* INTO v_mat
      FROM public.service_order_materials m
      WHERE m.id = v_mat_id
        AND m.service_order_id = v_row.service_order_id
        AND m.company_id = v_row.company_id
        AND m.status <> 'cancelled'
      FOR UPDATE;

      IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'material_not_found');
      END IF;

      IF v_mat.status = 'divergence' AND (v_just IS NULL OR length(v_just) < 3) THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', 'divergence_requires_justification',
          'material_id', v_mat_id
        );
      END IF;

      IF v_mat.checked_at IS NULL AND v_mat.status NOT IN ('checked', 'divergence', 'dispatched') THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', 'material_not_checked',
          'material_id', v_mat_id
        );
      END IF;

      IF v_qty <> COALESCE(v_mat.checked_quantity, 0) THEN
        IF v_just IS NULL OR length(v_just) < 3 THEN
          RETURN jsonb_build_object(
            'ok', false,
            'error', 'dispatch_adjustment_requires_justification',
            'material_id', v_mat_id
          );
        END IF;
        v_has_divergence := true;
      END IF;

      UPDATE public.service_order_materials
      SET
        dispatched_quantity = v_qty,
        dispatched_at = v_now,
        status = 'dispatched',
        notes = CASE
          WHEN v_just IS NOT NULL THEN
            trim(COALESCE(notes, '') || CASE WHEN notes IS NOT NULL AND length(trim(notes)) > 0 THEN E'\n' ELSE '' END
              || 'dispatch: ' || v_just)
          ELSE notes
        END,
        updated_at = v_now
      WHERE id = v_mat.id;
    END LOOP;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.service_order_materials m
      WHERE m.service_order_id = v_row.service_order_id
        AND m.company_id = v_row.company_id
        AND m.status = 'divergence'
    ) AND (p_notes IS NULL OR length(trim(p_notes)) < 3) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'divergence_requires_justification');
    END IF;

    UPDATE public.service_order_materials m
    SET
      dispatched_quantity = m.checked_quantity,
      dispatched_at = v_now,
      status = 'dispatched',
      updated_at = v_now
    WHERE m.service_order_id = v_row.service_order_id
      AND m.company_id = v_row.company_id
      AND m.status IN ('checked', 'divergence')
      AND m.checked_at IS NOT NULL;
  END IF;

  v_inv := public.post_inventory_for_order_dispatch(
    v_row.company_id,
    v_row.service_order_id,
    NULL
  );

  IF COALESCE((v_inv->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'inventory_posting_failed:%', COALESCE(v_inv->>'error', 'unknown')
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.service_order_material_dispatch_confirmations
  SET
    status = 'confirmed',
    confirmed_at = v_now,
    confirmation_notes = NULLIF(trim(COALESCE(p_notes, '')), ''),
    updated_at = v_now
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'confirmed',
    'has_divergence', v_has_divergence,
    'inventory', v_inv
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_public_material_dispatch(TEXT, JSONB, TEXT)
  TO anon, authenticated, service_role;

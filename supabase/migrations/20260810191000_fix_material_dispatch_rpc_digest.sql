-- Fix: digest() from pgcrypto needs extensions in search_path
-- (error: function digest(text, unknown) does not exist)

CREATE OR REPLACE FUNCTION public.get_public_material_dispatch_confirmation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_row public.service_order_material_dispatch_confirmations%ROWTYPE;
  v_so public.service_orders%ROWTYPE;
  v_company_name TEXT;
  v_team_name TEXT;
  v_leader_name TEXT;
  v_materials JSONB;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_hash := encode(digest(convert_to(trim(p_token), 'UTF8'), 'sha256'), 'hex');

  SELECT c.*
  INTO v_row
  FROM public.service_order_material_dispatch_confirmations c
  WHERE c.token_hash = v_hash
    AND c.revoked_at IS NULL
    AND c.status <> 'revoked'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() THEN
    IF v_row.status = 'pending' THEN
      UPDATE public.service_order_material_dispatch_confirmations
      SET status = 'expired', updated_at = now()
      WHERE id = v_row.id AND status = 'pending';
    END IF;
    RETURN jsonb_build_object('found', true, 'expired', true, 'status', 'expired');
  END IF;

  SELECT so.* INTO v_so FROM public.service_orders so WHERE so.id = v_row.service_order_id;
  SELECT COALESCE(c.trade_name, c.name) INTO v_company_name
  FROM public.companies c WHERE c.id = v_row.company_id;

  IF v_row.team_id IS NOT NULL THEN
    SELECT t.name INTO v_team_name FROM public.operational_teams t WHERE t.id = v_row.team_id;
  END IF;

  IF v_row.leader_person_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(trim(p.ab_name), ''), p.full_name)
    INTO v_leader_name
    FROM public.customers p WHERE p.id = v_row.leader_person_id;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'description_snapshot', m.description_snapshot,
      'material_type', m.material_type,
      'unit', m.unit,
      'required_quantity', m.required_quantity,
      'separated_quantity', m.separated_quantity,
      'checked_quantity', m.checked_quantity,
      'dispatched_quantity', m.dispatched_quantity,
      'status', m.status
    )
    ORDER BY m.description_snapshot
  ), '[]'::jsonb)
  INTO v_materials
  FROM public.service_order_materials m
  WHERE m.service_order_id = v_row.service_order_id
    AND m.company_id = v_row.company_id
    AND m.status <> 'cancelled';

  RETURN jsonb_build_object(
    'found', true,
    'expired', false,
    'revoked', false,
    'company_name', v_company_name,
    'status', v_row.status,
    'can_confirm', (
      v_row.status = 'pending'
      AND v_row.revoked_at IS NULL
      AND (v_row.expires_at IS NULL OR v_row.expires_at >= now())
    ),
    'dispatch', jsonb_build_object(
      'id', v_row.id,
      'service_order_number', v_so.service_order_number,
      'customer_label', COALESCE(v_so.venue_name, ''),
      'event_date', v_so.event_date,
      'start_time', v_so.start_time,
      'end_time', v_so.end_time,
      'venue_name', v_so.venue_name,
      'address_line', v_so.address_line,
      'city', v_so.city,
      'state', v_so.state,
      'team_name', v_team_name,
      'leader_name', v_leader_name,
      'materials', v_materials
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_public_material_dispatch(
  p_token TEXT,
  p_lines JSONB DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_row public.service_order_material_dispatch_confirmations%ROWTYPE;
  v_mat public.service_order_materials%ROWTYPE;
  v_line JSONB;
  v_mat_id uuid;
  v_qty numeric;
  v_just TEXT;
  v_has_divergence boolean := false;
  v_now timestamptz := now();
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  v_hash := encode(digest(convert_to(trim(p_token), 'UTF8'), 'sha256'), 'hex');

  SELECT c.*
  INTO v_row
  FROM public.service_order_material_dispatch_confirmations c
  WHERE c.token_hash = v_hash
    AND c.revoked_at IS NULL
    AND c.status <> 'revoked'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
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
    'has_divergence', v_has_divergence
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_material_dispatch_confirmation(TEXT)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_public_material_dispatch(TEXT, JSONB, TEXT)
  TO anon, authenticated;

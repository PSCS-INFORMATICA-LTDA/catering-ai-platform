-- =============================================================================
-- Inventory v1 — locations + ledger + balances + posting atômico
-- DEV ONLY: yasprgtlqclwsjcshtls
-- Fonte de verdade: inventory_movements (quantity SIGNED).
-- inventory_balances = materialização reconciliável.
-- Sem compras / AP / valuation / transfer / multi-warehouse complexo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) inventory_locations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NULL,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_locations_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_locations_company
  ON public.inventory_locations (company_id);

-- No máximo 1 default ativo por empresa
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_locations_one_default
  ON public.inventory_locations (company_id)
  WHERE is_default = true AND active = true;

DROP TRIGGER IF EXISTS trg_inventory_locations_updated_at ON public.inventory_locations;
CREATE TRIGGER trg_inventory_locations_updated_at
  BEFORE UPDATE ON public.inventory_locations
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at_timestamp();

COMMENT ON TABLE public.inventory_locations IS
  'Locais de estoque (v1: tipicamente 1 default por company).';

-- ---------------------------------------------------------------------------
-- 2) inventory_movements (ledger imutável, quantity SIGNED)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.inventory_locations (id) ON DELETE RESTRICT,
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items (id) ON DELETE RESTRICT,
  movement_type text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  source_type text NULL,
  source_id text NULL,
  service_order_id uuid NULL REFERENCES public.service_orders (id) ON DELETE SET NULL,
  service_order_material_id uuid NULL REFERENCES public.service_order_materials (id) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  notes text NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_type_check CHECK (
    movement_type IN (
      'initial_balance',
      'event_dispatch',
      'event_return',
      'event_leftover_return',
      'adjustment_in',
      'adjustment_out'
    )
  ),
  CONSTRAINT inventory_movements_quantity_nonzero CHECK (quantity <> 0),
  CONSTRAINT inventory_movements_unit_not_blank CHECK (length(trim(unit)) > 0),
  CONSTRAINT inventory_movements_idempotency_not_blank CHECK (length(trim(idempotency_key)) > 0),
  CONSTRAINT inventory_movements_sign_by_type CHECK (
    (movement_type = 'initial_balance')
    OR (movement_type = 'event_dispatch' AND quantity < 0)
    OR (movement_type = 'event_return') -- signed delta (pode ser negativo em correção)
    OR (movement_type = 'event_leftover_return')
    OR (movement_type = 'adjustment_in' AND quantity > 0)
    OR (movement_type = 'adjustment_out' AND quantity < 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_movements_idempotency
  ON public.inventory_movements (company_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_company_item
  ON public.inventory_movements (company_id, catalog_item_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_location
  ON public.inventory_movements (company_id, location_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_so_material
  ON public.inventory_movements (service_order_material_id)
  WHERE service_order_material_id IS NOT NULL;

COMMENT ON TABLE public.inventory_movements IS
  'Ledger imutável de estoque. quantity SIGNED (+ entrada / - saída). Fonte de verdade.';
COMMENT ON COLUMN public.inventory_movements.quantity IS
  'Quantidade com sinal: +IN / -OUT. Não misturar com abs+direction.';

-- ---------------------------------------------------------------------------
-- 3) inventory_balances (materialização)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.inventory_locations (id) ON DELETE RESTRICT,
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items (id) ON DELETE RESTRICT,
  quantity_on_hand numeric NOT NULL DEFAULT 0,
  unit text NOT NULL,
  last_movement_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_balances_unit_not_blank CHECK (length(trim(unit)) > 0),
  CONSTRAINT inventory_balances_unique_key
    UNIQUE (company_id, location_id, catalog_item_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_balances_company
  ON public.inventory_balances (company_id, location_id);

COMMENT ON TABLE public.inventory_balances IS
  'Saldo materializado. NÃO é fonte de verdade — reconciliar com SUM(movements).';

-- ---------------------------------------------------------------------------
-- 4) RBAC
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (permission_key, label_pt, label_en, label_es, category_key)
VALUES
  ('inventory.view', 'Ver estoque', 'View inventory', 'Ver inventario', 'inventory'),
  ('inventory.manage', 'Gerir estoque', 'Manage inventory', 'Gestionar inventario', 'inventory'),
  ('inventory.adjust', 'Ajustar estoque', 'Adjust inventory', 'Ajustar inventario', 'inventory')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r.role_key, p.permission_key
FROM (VALUES ('owner'), ('admin')) AS r(role_key)
CROSS JOIN (
  VALUES ('inventory.view'), ('inventory.manage'), ('inventory.adjust')
) AS p(permission_key)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'manager', p.permission_key
FROM (VALUES ('inventory.view'), ('inventory.manage')) AS p(permission_key)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r.role_key, 'inventory.view'
FROM (VALUES ('operator'), ('kitchen'), ('viewer')) AS r(role_key)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5) RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_locations_select ON public.inventory_locations;
CREATE POLICY inventory_locations_select
  ON public.inventory_locations FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS inventory_locations_write ON public.inventory_locations;
CREATE POLICY inventory_locations_write
  ON public.inventory_locations FOR ALL TO authenticated
  USING (private.is_company_member(company_id))
  WITH CHECK (private.is_company_member(company_id));

DROP POLICY IF EXISTS inventory_movements_select ON public.inventory_movements;
CREATE POLICY inventory_movements_select
  ON public.inventory_movements FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

-- Sem UPDATE/DELETE para authenticated (imutabilidade via grants)
DROP POLICY IF EXISTS inventory_movements_insert ON public.inventory_movements;
CREATE POLICY inventory_movements_insert
  ON public.inventory_movements FOR INSERT TO authenticated
  WITH CHECK (private.is_company_member(company_id));

DROP POLICY IF EXISTS inventory_balances_select ON public.inventory_balances;
CREATE POLICY inventory_balances_select
  ON public.inventory_balances FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

-- Sem write policy de balance para authenticated — só via SECURITY DEFINER RPC

GRANT SELECT, INSERT, UPDATE ON public.inventory_locations TO authenticated;
GRANT SELECT, INSERT ON public.inventory_movements TO authenticated;
GRANT SELECT ON public.inventory_balances TO authenticated;
GRANT ALL ON public.inventory_locations TO service_role;
GRANT ALL ON public.inventory_movements TO service_role;
GRANT ALL ON public.inventory_balances TO service_role;

-- ---------------------------------------------------------------------------
-- 6) ensure default location
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_default_inventory_location(
  p_company_id uuid,
  p_actor uuid DEFAULT NULL,
  p_name text DEFAULT 'Main Stock'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_required';
  END IF;

  SELECT id INTO v_id
  FROM public.inventory_locations
  WHERE company_id = p_company_id
    AND is_default = true
    AND active = true
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.inventory_locations (
    company_id, name, code, is_default, active, created_by, updated_by
  ) VALUES (
    p_company_id,
    COALESCE(NULLIF(trim(p_name), ''), 'Main Stock'),
    'MAIN',
    true,
    true,
    p_actor,
    p_actor
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_inventory_location(uuid, uuid, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7) post_inventory_movement (atômico + idempotente)
-- ---------------------------------------------------------------------------

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
  p_allow_negative boolean DEFAULT false
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
  v_movement_id uuid;
  v_occurred timestamptz;
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

  -- Idempotência
  SELECT * INTO v_existing
  FROM public.inventory_movements
  WHERE company_id = p_company_id
    AND idempotency_key = trim(p_idempotency_key);

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'movement_id', v_existing.id,
      'quantity_on_hand', (
        SELECT quantity_on_hand FROM public.inventory_balances
        WHERE company_id = p_company_id
          AND location_id = p_location_id
          AND catalog_item_id = p_catalog_item_id
      )
    );
  END IF;

  SELECT id, company_id, inventory_enabled, lower(trim(COALESCE(unit, stock_unit, ''))) AS item_unit
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

  SELECT id, company_id, active INTO v_loc
  FROM public.inventory_locations
  WHERE id = p_location_id
  FOR SHARE;

  IF NOT FOUND OR v_loc.company_id <> p_company_id OR v_loc.active IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_invalid');
  END IF;

  -- Unit: movement vs catalog (se catalog tem unit)
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
    AND location_id = p_location_id
    AND catalog_item_id = p_catalog_item_id
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
  ELSE
    v_new_qty := p_quantity;
  END IF;

  -- Negative stock: BLOCK para event_dispatch (e adjustment_out) por default
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

  INSERT INTO public.inventory_movements (
    company_id, location_id, catalog_item_id, movement_type, quantity, unit,
    source_type, source_id, service_order_id, service_order_material_id,
    idempotency_key, occurred_at, notes, created_by
  ) VALUES (
    p_company_id, p_location_id, p_catalog_item_id, p_movement_type, p_quantity, v_unit,
    p_source_type, p_source_id, p_service_order_id, p_service_order_material_id,
    trim(p_idempotency_key), v_occurred, NULLIF(trim(COALESCE(p_notes, '')), ''), p_actor
  )
  RETURNING id INTO v_movement_id;

  IF v_bal.id IS NOT NULL THEN
    UPDATE public.inventory_balances
    SET
      quantity_on_hand = v_new_qty,
      last_movement_at = v_occurred,
      updated_at = now()
    WHERE id = v_bal.id;
  ELSE
    INSERT INTO public.inventory_balances (
      company_id, location_id, catalog_item_id, quantity_on_hand, unit, last_movement_at
    ) VALUES (
      p_company_id, p_location_id, p_catalog_item_id, v_new_qty, v_unit, v_occurred
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'movement_id', v_movement_id,
    'quantity_on_hand', v_new_qty
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
      'movement_id', v_existing.id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_inventory_movement(
  uuid, uuid, uuid, text, numeric, text, text, text, text, uuid, uuid, text, uuid, timestamptz, boolean
) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8) rebuild balances from ledger
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
  IF p_company_id IS NULL THEN
    DELETE FROM public.inventory_balances;
    INSERT INTO public.inventory_balances (
      company_id, location_id, catalog_item_id, quantity_on_hand, unit, last_movement_at
    )
    SELECT
      m.company_id,
      m.location_id,
      m.catalog_item_id,
      SUM(m.quantity),
      MIN(m.unit),
      MAX(m.occurred_at)
    FROM public.inventory_movements m
    GROUP BY m.company_id, m.location_id, m.catalog_item_id;
  ELSE
    DELETE FROM public.inventory_balances WHERE company_id = p_company_id;
    INSERT INTO public.inventory_balances (
      company_id, location_id, catalog_item_id, quantity_on_hand, unit, last_movement_at
    )
    SELECT
      m.company_id,
      m.location_id,
      m.catalog_item_id,
      SUM(m.quantity),
      MIN(m.unit),
      MAX(m.occurred_at)
    FROM public.inventory_movements m
    WHERE m.company_id = p_company_id
    GROUP BY m.company_id, m.location_id, m.catalog_item_id;
  END IF;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'balances', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rebuild_inventory_balances(uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 9) Post dispatch for OS materials (inventariáveis)
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
  v_mat record;
  v_item record;
  v_res jsonb;
  v_posted int := 0;
  v_skipped int := 0;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  v_loc := public.ensure_default_inventory_location(p_company_id, p_actor, 'Main Stock');

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
      false
    );

    IF COALESCE((v_res->>'ok')::boolean, false) IS NOT TRUE THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'material_id', v_mat.id,
        'error', v_res->>'error'
      ));
      -- Não marca posted
      CONTINUE;
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
      'posted', v_posted,
      'skipped', v_skipped,
      'errors', v_errors
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'posted', v_posted,
    'skipped', v_skipped
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_inventory_for_order_dispatch(uuid, uuid, uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10) Post return/leftover deltas for one material
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
  v_posted_return numeric;
  v_posted_leftover numeric;
  v_delta numeric;
  v_target numeric;
  v_res jsonb;
  v_results jsonb := '[]'::jsonb;
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

  -- returnable / equipment → event_return delta on returned_quantity
  IF v_mat.material_type IN ('returnable', 'equipment') THEN
    SELECT COALESCE(SUM(quantity), 0) INTO v_posted_return
    FROM public.inventory_movements
    WHERE company_id = p_company_id
      AND service_order_material_id = v_mat.id
      AND movement_type = 'event_return';

    v_target := COALESCE(v_mat.returned_quantity, 0);
    v_delta := v_target - v_posted_return;

    IF v_delta <> 0 THEN
      v_res := public.post_inventory_movement(
        p_company_id, v_loc, v_mat.catalog_item_id,
        'event_return', v_delta, lower(trim(v_mat.unit)),
        'event_return:' || v_mat.id::text || ':to:' || trim(to_char(v_target, 'FM999999999.999999')),
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

  -- consumable leftover → event_leftover_return (somente sobra > 0 aplicável)
  IF v_mat.material_type = 'consumable' THEN
    SELECT COALESCE(SUM(quantity), 0) INTO v_posted_leftover
    FROM public.inventory_movements
    WHERE company_id = p_company_id
      AND service_order_material_id = v_mat.id
      AND movement_type = 'event_leftover_return';

    v_target := COALESCE(v_mat.leftover_quantity, 0);
    v_delta := v_target - v_posted_leftover;

    IF v_delta <> 0 THEN
      v_res := public.post_inventory_movement(
        p_company_id, v_loc, v_mat.catalog_item_id,
        'event_leftover_return', v_delta, lower(trim(v_mat.unit)),
        'event_leftover_return:' || v_mat.id::text || ':to:' || trim(to_char(v_target, 'FM999999999.999999')),
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

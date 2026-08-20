-- =============================================================================
-- Inventory JDE Foundation V1 — Lot + saldo multi-dimensional
-- DEV ONLY: yasprgtlqclwsjcshtls
--
-- DECISÃO: quantity_available NÃO é persistida.
--   AVAILABLE = quantity_on_hand - quantity_committed (calculado em view/API).
-- On Receipt sem compras = 0 (FUTURE PROCUREMENT).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) catalog_items.lot_control_enabled
-- ---------------------------------------------------------------------------

ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS lot_control_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.catalog_items.lot_control_enabled IS
  'Se true, movimentos futuros podem exigir lot_id. Workflow avançado fora desta fase.';

-- ---------------------------------------------------------------------------
-- 2) inventory_lots
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items (id) ON DELETE RESTRICT,
  lot_number text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  manufacture_date date NULL,
  expiration_date date NULL,
  notes text NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_lots_number_not_blank CHECK (length(trim(lot_number)) > 0),
  CONSTRAINT inventory_lots_status_check CHECK (
    status IN ('active', 'blocked', 'expired', 'quarantine')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_lots_item_number
  ON public.inventory_lots (company_id, branch_id, catalog_item_id, lot_number);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_item
  ON public.inventory_lots (company_id, catalog_item_id, active);

DROP TRIGGER IF EXISTS trg_inventory_lots_updated_at ON public.inventory_lots;
CREATE TRIGGER trg_inventory_lots_updated_at
  BEFORE UPDATE ON public.inventory_lots
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at_timestamp();

COMMENT ON TABLE public.inventory_lots IS
  'Lotes opcionais por company/branch/item. Status conceitual — sem workflow completo.';

ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_lots_select ON public.inventory_lots;
CREATE POLICY inventory_lots_select
  ON public.inventory_lots FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS inventory_lots_write ON public.inventory_lots;
CREATE POLICY inventory_lots_write
  ON public.inventory_lots FOR ALL TO authenticated
  USING (private.is_company_member(company_id))
  WITH CHECK (private.is_company_member(company_id));

GRANT SELECT, INSERT, UPDATE ON public.inventory_lots TO authenticated;
GRANT ALL ON public.inventory_lots TO service_role;

-- ---------------------------------------------------------------------------
-- 3) inventory_balances — dimensões branch/lot + buckets
-- ---------------------------------------------------------------------------

ALTER TABLE public.inventory_balances
  ADD COLUMN IF NOT EXISTS branch_id uuid NULL REFERENCES public.branches (id) ON DELETE RESTRICT;

ALTER TABLE public.inventory_balances
  ADD COLUMN IF NOT EXISTS lot_id uuid NULL REFERENCES public.inventory_lots (id) ON DELETE RESTRICT;

ALTER TABLE public.inventory_balances
  ADD COLUMN IF NOT EXISTS quantity_committed numeric NOT NULL DEFAULT 0;

ALTER TABLE public.inventory_balances
  ADD COLUMN IF NOT EXISTS quantity_in_event numeric NOT NULL DEFAULT 0;

ALTER TABLE public.inventory_balances
  ADD COLUMN IF NOT EXISTS quantity_on_receipt numeric NOT NULL DEFAULT 0;

-- Backfill branch from location
UPDATE public.inventory_balances b
SET branch_id = l.branch_id
FROM public.inventory_locations l
WHERE b.location_id = l.id
  AND b.branch_id IS NULL;

-- For any orphan, ensure default branch
DO $$
DECLARE
  r record;
  v_branch uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT company_id
    FROM public.inventory_balances
    WHERE branch_id IS NULL
  LOOP
    v_branch := public.ensure_default_branch(r.company_id);
    UPDATE public.inventory_balances
    SET branch_id = v_branch
    WHERE company_id = r.company_id
      AND branch_id IS NULL;
  END LOOP;
END $$;

ALTER TABLE public.inventory_balances
  ALTER COLUMN branch_id SET NOT NULL;

-- Replace unique key to include branch + lot (NULL lot = no lot)
ALTER TABLE public.inventory_balances
  DROP CONSTRAINT IF EXISTS inventory_balances_unique_key;

DROP INDEX IF EXISTS public.uq_inventory_balances_dim;
CREATE UNIQUE INDEX uq_inventory_balances_dim
  ON public.inventory_balances (
    company_id,
    branch_id,
    location_id,
    catalog_item_id,
    COALESCE(lot_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS idx_inventory_balances_branch
  ON public.inventory_balances (company_id, branch_id, catalog_item_id);

COMMENT ON COLUMN public.inventory_balances.quantity_committed IS
  'Materialização de reservas ativas. Não reduz On Hand.';
COMMENT ON COLUMN public.inventory_balances.quantity_in_event IS
  'Quantidade despachada ainda não retornada/encerrada.';
COMMENT ON COLUMN public.inventory_balances.quantity_on_receipt IS
  'FUTURE PROCUREMENT — sem compras nesta fase; permanece 0.';

-- ---------------------------------------------------------------------------
-- 4) View de disponibilidade (Available calculado)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.inventory_availability AS
SELECT
  b.id AS balance_id,
  b.company_id,
  b.branch_id,
  b.location_id,
  b.catalog_item_id,
  b.lot_id,
  b.unit,
  b.quantity_on_hand,
  b.quantity_committed,
  (b.quantity_on_hand - b.quantity_committed) AS quantity_available,
  b.quantity_in_event,
  b.quantity_on_receipt,
  b.last_movement_at,
  b.updated_at
FROM public.inventory_balances b;

COMMENT ON VIEW public.inventory_availability IS
  'P41202-like. Available = On Hand - Committed (não persistido).';

GRANT SELECT ON public.inventory_availability TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5) rebuild_inventory_balances — inclui branch/lot; preserva buckets não-ledger
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
  -- Snapshot committed / in_event / on_receipt before rebuild
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
    l.branch_id,
    m.location_id,
    m.catalog_item_id,
    NULL::uuid AS lot_id,
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
    l.branch_id,
    m.location_id,
    m.catalog_item_id;

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

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'balances', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rebuild_inventory_balances(uuid)
  TO service_role;

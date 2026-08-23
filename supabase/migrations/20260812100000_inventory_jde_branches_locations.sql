-- =============================================================================
-- Inventory JDE Foundation V1 — Company → Branch → Location
-- DEV ONLY: yasprgtlqclwsjcshtls
-- Reutiliza public.branches (NÃO cria company_branches).
-- Location passa a exigir branch_id. Branch ≠ Location.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) branches — campos de foundation (aditivos)
-- ---------------------------------------------------------------------------

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS updated_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_branches_company_code
  ON public.branches (company_id, branch_code)
  WHERE branch_code IS NOT NULL AND length(trim(branch_code)) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_branches_one_default
  ON public.branches (company_id)
  WHERE is_default = true AND COALESCE(active, true) = true;

COMMENT ON COLUMN public.branches.is_default IS
  'Filial padrão da empresa. Diferente de inventory_locations.';

-- ---------------------------------------------------------------------------
-- 2) ensure_default_branch
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_default_branch(
  p_company_id uuid,
  p_actor uuid DEFAULT NULL,
  p_code text DEFAULT 'MAIN',
  p_name text DEFAULT 'Main Branch'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_code text;
  v_name text;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_required';
  END IF;

  v_code := upper(trim(COALESCE(NULLIF(trim(p_code), ''), 'MAIN')));
  v_name := COALESCE(NULLIF(trim(p_name), ''), 'Main Branch');

  SELECT id INTO v_id
  FROM public.branches
  WHERE company_id = p_company_id
    AND is_default = true
    AND COALESCE(active, true) = true
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT id INTO v_id
  FROM public.branches
  WHERE company_id = p_company_id
    AND COALESCE(active, true) = true
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.branches
    SET
      is_default = true,
      branch_code = COALESCE(NULLIF(trim(branch_code), ''), v_code),
      updated_by = p_actor,
      updated_at = now()
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.branches (
    company_id, name, branch_code, slug, country, timezone, active, is_default,
    created_by, updated_by
  ) VALUES (
    p_company_id,
    v_name,
    v_code,
    lower(regexp_replace(v_code, '[^a-zA-Z0-9]+', '-', 'g')),
    'US',
    'America/New_York',
    true,
    true,
    p_actor,
    p_actor
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_branch(uuid, uuid, text, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) inventory_locations — branch_id + location_type
-- ---------------------------------------------------------------------------

ALTER TABLE public.inventory_locations
  ADD COLUMN IF NOT EXISTS branch_id uuid NULL REFERENCES public.branches (id) ON DELETE RESTRICT;

ALTER TABLE public.inventory_locations
  ADD COLUMN IF NOT EXISTS location_type text NULL;

-- Backfill branch for existing locations
DO $$
DECLARE
  r record;
  v_branch uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT company_id
    FROM public.inventory_locations
    WHERE branch_id IS NULL
  LOOP
    v_branch := public.ensure_default_branch(r.company_id, NULL, 'MAIN', 'Main Branch');
    UPDATE public.inventory_locations
    SET branch_id = v_branch
    WHERE company_id = r.company_id
      AND branch_id IS NULL;
  END LOOP;
END $$;

ALTER TABLE public.inventory_locations
  ALTER COLUMN branch_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_locations_branch
  ON public.inventory_locations (company_id, branch_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_locations_company_branch_code
  ON public.inventory_locations (company_id, branch_id, code)
  WHERE code IS NOT NULL AND length(trim(code)) > 0;

-- Default location: one per branch (replace company-only unique)
DROP INDEX IF EXISTS public.uq_inventory_locations_one_default;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_locations_one_default_per_branch
  ON public.inventory_locations (company_id, branch_id)
  WHERE is_default = true AND active = true;

COMMENT ON COLUMN public.inventory_locations.branch_id IS
  'Filial dona do local. Branch ≠ Location.';
COMMENT ON COLUMN public.inventory_locations.location_type IS
  'Opcional: MAIN / FREEZER / DRY / EQUIPMENT / PREP / RETURN (sem enum rígido nesta fase).';

-- ---------------------------------------------------------------------------
-- 4) ensure_default_inventory_location — agora por branch
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.ensure_default_inventory_location(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.ensure_default_inventory_location(
  p_company_id uuid,
  p_actor uuid DEFAULT NULL,
  p_name text DEFAULT 'Main Stock',
  p_branch_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_branch uuid;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_required';
  END IF;

  v_branch := COALESCE(
    p_branch_id,
    public.ensure_default_branch(p_company_id, p_actor)
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.branches
    WHERE id = v_branch AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'branch_company_mismatch';
  END IF;

  SELECT id INTO v_id
  FROM public.inventory_locations
  WHERE company_id = p_company_id
    AND branch_id = v_branch
    AND is_default = true
    AND active = true
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.inventory_locations (
    company_id, branch_id, name, code, is_default, active, location_type,
    created_by, updated_by
  ) VALUES (
    p_company_id,
    v_branch,
    COALESCE(NULLIF(trim(p_name), ''), 'Main Stock'),
    'MAIN',
    true,
    true,
    'MAIN',
    p_actor,
    p_actor
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_inventory_location(uuid, uuid, text, uuid)
  TO authenticated, service_role;

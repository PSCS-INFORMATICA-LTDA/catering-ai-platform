-- =============================================================================
-- operational_material_rules — BOM operacional configurável (Fase 1.5)
-- Gera service_order_materials na conversão Quote→OS (snapshot histórico).
-- DEV: yasprgtlqclwsjcshtls — sem estoque / dispatch / retorno.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.operational_material_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  material_catalog_item_id uuid NULL REFERENCES public.catalog_items (id) ON DELETE SET NULL,
  material_description_snapshot text NOT NULL,
  material_type text NOT NULL DEFAULT 'consumable',
  unit text NOT NULL DEFAULT 'unit',
  calculation_type text NOT NULL,
  fixed_quantity numeric NULL,
  quantity_per_guest numeric NULL,
  guest_basis text NULL,
  min_guests integer NULL,
  max_guests integer NULL,
  tier_json jsonb NULL,
  rounding_rule text NOT NULL DEFAULT 'none',
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  notes text NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_material_rules_description_not_blank
    CHECK (length(trim(material_description_snapshot)) > 0),
  CONSTRAINT operational_material_rules_unit_not_blank
    CHECK (length(trim(unit)) > 0),
  CONSTRAINT operational_material_rules_source_type_check
    CHECK (source_type IN ('package', 'additional', 'rule')),
  CONSTRAINT operational_material_rules_material_type_check
    CHECK (material_type IN ('consumable', 'returnable', 'equipment', 'disposable')),
  CONSTRAINT operational_material_rules_calculation_type_check
    CHECK (calculation_type IN ('fixed', 'per_guest', 'tier')),
  CONSTRAINT operational_material_rules_guest_basis_check
    CHECK (
      guest_basis IS NULL
      OR guest_basis IN ('billable_guests', 'adults', 'children', 'total_guests')
    ),
  CONSTRAINT operational_material_rules_rounding_check
    CHECK (rounding_rule IN ('none', 'ceil', 'floor', 'round')),
  CONSTRAINT operational_material_rules_fixed_qty_nonneg
    CHECK (fixed_quantity IS NULL OR fixed_quantity >= 0),
  CONSTRAINT operational_material_rules_per_guest_qty_nonneg
    CHECK (quantity_per_guest IS NULL OR quantity_per_guest >= 0),
  CONSTRAINT operational_material_rules_min_guests_nonneg
    CHECK (min_guests IS NULL OR min_guests >= 0),
  CONSTRAINT operational_material_rules_max_guests_ok
    CHECK (
      max_guests IS NULL
      OR min_guests IS NULL
      OR max_guests >= min_guests
    )
);

CREATE INDEX IF NOT EXISTS idx_operational_material_rules_company
  ON public.operational_material_rules (company_id);

CREATE INDEX IF NOT EXISTS idx_operational_material_rules_source
  ON public.operational_material_rules (company_id, source_type, source_id)
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_operational_material_rules_catalog
  ON public.operational_material_rules (material_catalog_item_id)
  WHERE material_catalog_item_id IS NOT NULL;

COMMENT ON TABLE public.operational_material_rules IS
  'BOM operacional por empresa: package/additional → materiais da OS (snapshot na conversão).';

DROP TRIGGER IF EXISTS trg_operational_material_rules_updated_at
  ON public.operational_material_rules;
CREATE TRIGGER trg_operational_material_rules_updated_at
  BEFORE UPDATE ON public.operational_material_rules
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at_timestamp();

-- ---------------------------------------------------------------------------
-- service_order_materials — rastreio de regra + rótulo de origem
-- ---------------------------------------------------------------------------

ALTER TABLE public.service_order_materials
  ADD COLUMN IF NOT EXISTS bom_rule_id uuid
    REFERENCES public.operational_material_rules (id) ON DELETE SET NULL;

ALTER TABLE public.service_order_materials
  ADD COLUMN IF NOT EXISTS source_label_snapshot text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_order_materials_bom_rule
  ON public.service_order_materials (service_order_id, bom_rule_id)
  WHERE bom_rule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_order_materials_bom_rule
  ON public.service_order_materials (bom_rule_id)
  WHERE bom_rule_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (permission_key, label_pt, label_en, label_es, category_key)
VALUES
  ('materials.rules.view', 'Ver BOM de materiais', 'View materials BOM', 'Ver BOM de materiales', 'materials'),
  ('materials.rules.manage', 'Gerenciar BOM de materiais', 'Manage materials BOM', 'Gestionar BOM de materiales', 'materials')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r.role_key, p.permission_key
FROM (VALUES ('owner'), ('admin'), ('manager')) AS r(role_key)
CROSS JOIN (
  VALUES ('materials.rules.view'), ('materials.rules.manage')
) AS p(permission_key)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r.role_key, 'materials.rules.view'
FROM (VALUES ('sales'), ('operator'), ('kitchen'), ('finance'), ('viewer')) AS r(role_key)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.operational_material_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operational_material_rules_select_member
  ON public.operational_material_rules;
CREATE POLICY operational_material_rules_select_member
  ON public.operational_material_rules FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS operational_material_rules_write_member
  ON public.operational_material_rules;
CREATE POLICY operational_material_rules_write_member
  ON public.operational_material_rules FOR ALL TO authenticated
  USING (private.is_company_member(company_id))
  WITH CHECK (private.is_company_member(company_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_material_rules TO authenticated;
GRANT ALL ON public.operational_material_rules TO service_role;

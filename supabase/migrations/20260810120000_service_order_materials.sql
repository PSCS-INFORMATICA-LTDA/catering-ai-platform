-- =============================================================================
-- service_order_materials — materiais operacionais da OS (Fase 1)
-- Separado de service_order_items (comercial) e checklist (ações).
-- DEV: yasprgtlqclwsjcshtls — sem estoque / dispatch / retorno nesta migration.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.service_order_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  service_order_id uuid NOT NULL REFERENCES public.service_orders (id) ON DELETE CASCADE,
  catalog_item_id uuid NULL REFERENCES public.catalog_items (id) ON DELETE SET NULL,
  source_type text NOT NULL DEFAULT 'manual',
  source_id text NULL,
  description_snapshot text NOT NULL,
  material_type text NOT NULL DEFAULT 'consumable',
  unit text NOT NULL DEFAULT 'unit',
  required_quantity numeric NOT NULL DEFAULT 0,
  separated_quantity numeric NOT NULL DEFAULT 0,
  checked_quantity numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text NULL,
  separated_by_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  separated_at timestamptz NULL,
  checked_by_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  checked_at timestamptz NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_order_materials_description_not_blank
    CHECK (length(trim(description_snapshot)) > 0),
  CONSTRAINT service_order_materials_unit_not_blank
    CHECK (length(trim(unit)) > 0),
  CONSTRAINT service_order_materials_source_type_check
    CHECK (source_type IN ('package', 'additional', 'supplier', 'manual', 'rule')),
  CONSTRAINT service_order_materials_material_type_check
    CHECK (material_type IN ('consumable', 'returnable', 'equipment', 'disposable')),
  CONSTRAINT service_order_materials_status_check
    CHECK (status IN (
      'pending', 'partial', 'separated', 'checked', 'divergence', 'cancelled'
    )),
  CONSTRAINT service_order_materials_required_qty_nonneg
    CHECK (required_quantity >= 0),
  CONSTRAINT service_order_materials_separated_qty_nonneg
    CHECK (separated_quantity >= 0),
  CONSTRAINT service_order_materials_checked_qty_nonneg
    CHECK (checked_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_service_order_materials_company
  ON public.service_order_materials (company_id);

CREATE INDEX IF NOT EXISTS idx_service_order_materials_order
  ON public.service_order_materials (service_order_id, created_at);

CREATE INDEX IF NOT EXISTS idx_service_order_materials_catalog
  ON public.service_order_materials (catalog_item_id)
  WHERE catalog_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_order_materials_status
  ON public.service_order_materials (company_id, status);

COMMENT ON TABLE public.service_order_materials IS
  'Materiais operacionais da OS (quantidade física). Não é snapshot comercial nem checklist.';

DROP TRIGGER IF EXISTS trg_service_order_materials_updated_at
  ON public.service_order_materials;
CREATE TRIGGER trg_service_order_materials_updated_at
  BEFORE UPDATE ON public.service_order_materials
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at_timestamp();

-- ---------------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (permission_key, label_pt, label_en, label_es, category_key)
VALUES
  ('orders.materials.view', 'Ver materiais da OS', 'View order materials', 'Ver materiales de la OS', 'orders'),
  ('orders.materials.prepare', 'Separar materiais da OS', 'Prepare order materials', 'Separar materiales de la OS', 'orders'),
  ('orders.materials.check', 'Conferir materiais da OS', 'Check order materials', 'Conferir materiales de la OS', 'orders')
ON CONFLICT (permission_key) DO NOTHING;

-- owner/admin/manager: todas
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r.role_key, p.permission_key
FROM (VALUES ('owner'), ('admin'), ('manager')) AS r(role_key)
CROSS JOIN (
  VALUES
    ('orders.materials.view'),
    ('orders.materials.prepare'),
    ('orders.materials.check')
) AS p(permission_key)
ON CONFLICT DO NOTHING;

-- operator: view + prepare + check
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'operator', p.permission_key
FROM (
  VALUES
    ('orders.materials.view'),
    ('orders.materials.prepare'),
    ('orders.materials.check')
) AS p(permission_key)
ON CONFLICT DO NOTHING;

-- sales / kitchen / finance / viewer: view
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r.role_key, 'orders.materials.view'
FROM (VALUES ('sales'), ('kitchen'), ('finance'), ('viewer')) AS r(role_key)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.service_order_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_order_materials_select_member
  ON public.service_order_materials;
CREATE POLICY service_order_materials_select_member
  ON public.service_order_materials FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS service_order_materials_write_member
  ON public.service_order_materials;
CREATE POLICY service_order_materials_write_member
  ON public.service_order_materials FOR ALL TO authenticated
  USING (private.is_company_member(company_id))
  WITH CHECK (private.is_company_member(company_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_materials TO authenticated;
GRANT ALL ON public.service_order_materials TO service_role;

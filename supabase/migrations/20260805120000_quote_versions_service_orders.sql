-- =============================================================================
-- quote_versions_service_orders — Fundação Quote → Order/OS (Catering AI)
-- Ambiente-alvo: Supabase DEV ONLY (yasprgtlqclwsjcshtls)
-- NAO aplicar em Production.
--
-- ADR: docs/adr/quote-order-data-model-decision.md
-- Spec: docs/specs/quote-to-order-functional-spec.md
--
-- NAO altera 20260731153000_f1_identity_memberships.sql
-- NAO altera 20260803210000_harden_multitenant_rls.sql
-- Idempotente. Nao remove tabelas nem dados.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) quote_versions — snapshot comercial versionado da cotação
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.quote_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  language text NOT NULL DEFAULT 'pt',
  currency_code text NOT NULL DEFAULT 'USD',
  package_total numeric(12, 2) NOT NULL DEFAULT 0,
  additional_total numeric(12, 2) NOT NULL DEFAULT 0,
  mileage_fee numeric(12, 2) NOT NULL DEFAULT 0,
  discount_amount numeric(12, 2) NOT NULL DEFAULT 0,
  reservation_amount numeric(12, 2) NOT NULL DEFAULT 0,
  balance_due numeric(12, 2) NOT NULL DEFAULT 0,
  quote_total numeric(12, 2) NOT NULL DEFAULT 0,
  commercial_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  schema_version integer NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  accepted_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_versions_version_number_positive CHECK (version_number > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_versions_quote_version
  ON public.quote_versions (quote_id, version_number);

-- Apenas uma versão "corrente" por cotação (rascunho ativo)
CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_versions_one_current
  ON public.quote_versions (quote_id)
  WHERE is_current IS TRUE;

-- Apenas uma versão aceita por cotação (regra ADR §3 / spec §B)
CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_versions_one_accepted
  ON public.quote_versions (quote_id)
  WHERE accepted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quote_versions_company
  ON public.quote_versions (company_id);

CREATE INDEX IF NOT EXISTS idx_quote_versions_quote
  ON public.quote_versions (quote_id, version_number DESC);

COMMENT ON TABLE public.quote_versions IS
  'Versões comerciais imutáveis da cotação. Nova versão a cada mudança de valor material (ADR quote-order-data-model-decision).';
COMMENT ON COLUMN public.quote_versions.commercial_snapshot IS
  'Snapshot JSONB imutável: pacote, adicionais, guests, mileage, totais — não recalcula com o catálogo atual.';
COMMENT ON COLUMN public.quote_versions.is_current IS
  'Versão em edição/aberta para esta cotação (no máximo uma).';
COMMENT ON COLUMN public.quote_versions.accepted_at IS
  'Preenchido quando o cliente aceita a proposta pública nesta versão (no máximo uma versão aceita por cotação).';

-- ---------------------------------------------------------------------------
-- 2) quotes — vínculo à versão aceita e à OS gerada
-- ---------------------------------------------------------------------------

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS accepted_version_id uuid,
  ADD COLUMN IF NOT EXISTS converted_service_order_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quotes_accepted_version_id_fkey'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_accepted_version_id_fkey
      FOREIGN KEY (accepted_version_id)
      REFERENCES public.quote_versions (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quotes_accepted_version
  ON public.quotes (accepted_version_id)
  WHERE accepted_version_id IS NOT NULL;

COMMENT ON COLUMN public.quotes.accepted_version_id IS
  'Versão de quote_versions aceita pelo cliente (proposta pública).';
COMMENT ON COLUMN public.quotes.converted_service_order_id IS
  'Ordem de Serviço gerada pela conversão manual (preenchido após confirmação do staff). FK adicionada após criação de service_orders.';

-- ---------------------------------------------------------------------------
-- 3) service_orders — documento operacional (execução do evento aprovado)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  service_order_number text NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes (id) ON DELETE RESTRICT,
  quote_version_id uuid NOT NULL REFERENCES public.quote_versions (id) ON DELETE RESTRICT,
  event_id uuid REFERENCES public.events (id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned',
  event_date date,
  start_time time without time zone,
  end_time time without time zone,
  venue_name text,
  address_line text,
  city text,
  state text,
  postal_code text,
  physical_guest_count integer,
  billable_guest_count numeric,
  currency_code text NOT NULL DEFAULT 'USD',
  package_total numeric(12, 2) NOT NULL DEFAULT 0,
  additional_total numeric(12, 2) NOT NULL DEFAULT 0,
  mileage_fee numeric(12, 2) NOT NULL DEFAULT 0,
  discount_amount numeric(12, 2) NOT NULL DEFAULT 0,
  reservation_amount numeric(12, 2) NOT NULL DEFAULT 0,
  balance_due numeric(12, 2) NOT NULL DEFAULT 0,
  service_order_total numeric(12, 2) NOT NULL DEFAULT 0,
  commercial_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  cancel_reason text,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_orders_status_check CHECK (status IN (
    'planned', 'confirmed', 'preparing', 'team_assigned',
    'ready', 'in_progress', 'completed', 'cancelled'
  )),
  CONSTRAINT service_orders_cancel_reason_required CHECK (
    status <> 'cancelled' OR (cancel_reason IS NOT NULL AND length(trim(cancel_reason)) > 0)
  )
);

-- Idempotência da conversão (ADR §4 / spec §G): uma OS ativa por versão aceita
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_orders_company_quote_version
  ON public.service_orders (company_id, quote_version_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_orders_company_number
  ON public.service_orders (company_id, service_order_number);

CREATE INDEX IF NOT EXISTS idx_service_orders_company_status
  ON public.service_orders (company_id, status);

CREATE INDEX IF NOT EXISTS idx_service_orders_quote
  ON public.service_orders (quote_id);

CREATE INDEX IF NOT EXISTS idx_service_orders_event_date
  ON public.service_orders (company_id, event_date);

COMMENT ON TABLE public.service_orders IS
  'Ordem de Serviço (OS): execução operacional da cotação aceita. Conversão manual, idempotente por (company_id, quote_version_id).';
COMMENT ON COLUMN public.service_orders.commercial_snapshot IS
  'Cópia imutável de quote_versions.commercial_snapshot no momento da conversão.';
COMMENT ON COLUMN public.service_orders.service_order_number IS
  'Número gerado via get_next_document_number(company_id, ''service_order'') — prefixo SO.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quotes_converted_service_order_id_fkey'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_converted_service_order_id_fkey
      FOREIGN KEY (converted_service_order_id)
      REFERENCES public.service_orders (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quotes_converted_service_order
  ON public.quotes (converted_service_order_id)
  WHERE converted_service_order_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) service_order_items — linhas do snapshot (consulta/execução)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.service_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  service_order_id uuid NOT NULL REFERENCES public.service_orders (id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'additional',
  item_key text,
  label_pt text NOT NULL,
  label_en text,
  label_es text,
  category_pt text,
  category_en text,
  category_es text,
  quantity numeric,
  unit_price numeric(12, 2),
  total_price numeric(12, 2),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_order_items_type_check CHECK (
    item_type IN ('package', 'additional', 'option', 'mileage', 'discount', 'other')
  )
);

CREATE INDEX IF NOT EXISTS idx_service_order_items_order
  ON public.service_order_items (service_order_id, display_order);

COMMENT ON TABLE public.service_order_items IS
  'Linhas do commercial_snapshot da OS, materializadas para consulta operacional (não recalcula catálogo).';

-- ---------------------------------------------------------------------------
-- 5) service_order_status_history — máquina de status da OS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.service_order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  service_order_id uuid NOT NULL REFERENCES public.service_orders (id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  reason text,
  changed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_order_status_history_order
  ON public.service_order_status_history (service_order_id, created_at DESC);

COMMENT ON TABLE public.service_order_status_history IS
  'Auditoria da máquina de status da OS. Complementa audit_logs (ADR §6).';

-- ---------------------------------------------------------------------------
-- 6) service_order_checklist_items — checklist operacional
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.service_order_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  service_order_id uuid NOT NULL REFERENCES public.service_orders (id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'preparacao',
  is_required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  completed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_order_checklist_items_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT service_order_checklist_items_category_check CHECK (category IN (
    'comercial', 'preparacao', 'equipe', 'equipamentos', 'alimentos',
    'logistica_evento', 'montagem', 'execucao', 'desmontagem', 'pos_evento'
  )),
  CONSTRAINT service_order_checklist_items_status_check CHECK (status IN (
    'pending', 'done', 'skipped'
  ))
);

CREATE INDEX IF NOT EXISTS idx_service_order_checklist_order
  ON public.service_order_checklist_items (service_order_id, display_order);

COMMENT ON TABLE public.service_order_checklist_items IS
  'Checklist operacional por OS (spec §H). Categorias fixas do domínio catering.';

-- ---------------------------------------------------------------------------
-- 7) agenda_events — vínculo opcional com a OS
-- ---------------------------------------------------------------------------

ALTER TABLE public.agenda_events
  ADD COLUMN IF NOT EXISTS service_order_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agenda_events_service_order_id_fkey'
  ) THEN
    ALTER TABLE public.agenda_events
      ADD CONSTRAINT agenda_events_service_order_id_fkey
      FOREIGN KEY (service_order_id)
      REFERENCES public.service_orders (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agenda_events_service_order
  ON public.agenda_events (service_order_id)
  WHERE service_order_id IS NOT NULL;

COMMENT ON COLUMN public.agenda_events.service_order_id IS
  'Ordem de Serviço vinculada (preenchida após conversão + designação de equipe).';

-- ---------------------------------------------------------------------------
-- 8) updated_at triggers (padrão existente no projeto)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_orders_updated_at ON public.service_orders;
CREATE TRIGGER trg_service_orders_updated_at
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_service_order_checklist_items_updated_at ON public.service_order_checklist_items;
CREATE TRIGGER trg_service_order_checklist_items_updated_at
  BEFORE UPDATE ON public.service_order_checklist_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at_timestamp();

-- ---------------------------------------------------------------------------
-- 9) Permissões novas (ADR §7): quotes.convert, orders.view, orders.manage
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (permission_key, label_pt, label_en, label_es, category_key)
VALUES
  ('quotes.convert', 'Converter cotação em OS', 'Convert quote to service order', 'Convertir presupuesto en OS', 'quotes'),
  ('orders.view', 'Ver ordens de serviço', 'View service orders', 'Ver órdenes de servicio', 'orders'),
  ('orders.manage', 'Gerenciar ordens de serviço', 'Manage service orders', 'Gestionar órdenes de servicio', 'orders')
ON CONFLICT (permission_key) DO NOTHING;

-- owner/admin/manager: full (convert + view + manage)
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r.role_key, p.permission_key
FROM (VALUES ('owner'), ('admin'), ('manager')) AS r(role_key)
CROSS JOIN (
  VALUES ('quotes.convert'), ('orders.view'), ('orders.manage')
) AS p(permission_key)
ON CONFLICT DO NOTHING;

-- sales: decide a conversão comercial e acompanha a OS, mas não opera o checklist
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'sales', p.permission_key
FROM (VALUES ('quotes.convert'), ('orders.view')) AS p(permission_key)
ON CONFLICT DO NOTHING;

-- operator: opera a OS (status/checklist) mas não decide a conversão comercial
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'operator', p.permission_key
FROM (VALUES ('orders.view'), ('orders.manage')) AS p(permission_key)
ON CONFLICT DO NOTHING;

-- kitchen/finance: apenas leitura operacional
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r.role_key, 'orders.view'
FROM (VALUES ('kitchen'), ('finance')) AS r(role_key)
ON CONFLICT DO NOTHING;

-- viewer: leitura
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'viewer', 'orders.view'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10) RLS — mesmo padrão de membership das demais tabelas tenant-owned
-- ---------------------------------------------------------------------------

ALTER TABLE public.quote_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quote_versions_select_member ON public.quote_versions;
CREATE POLICY quote_versions_select_member
  ON public.quote_versions FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS quote_versions_write_member ON public.quote_versions;
CREATE POLICY quote_versions_write_member
  ON public.quote_versions FOR ALL TO authenticated
  USING (private.is_company_member(company_id))
  WITH CHECK (private.is_company_member(company_id));

DROP POLICY IF EXISTS service_orders_select_member ON public.service_orders;
CREATE POLICY service_orders_select_member
  ON public.service_orders FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS service_orders_write_member ON public.service_orders;
CREATE POLICY service_orders_write_member
  ON public.service_orders FOR ALL TO authenticated
  USING (private.is_company_member(company_id))
  WITH CHECK (private.is_company_member(company_id));

DROP POLICY IF EXISTS service_order_items_select_member ON public.service_order_items;
CREATE POLICY service_order_items_select_member
  ON public.service_order_items FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS service_order_items_write_member ON public.service_order_items;
CREATE POLICY service_order_items_write_member
  ON public.service_order_items FOR ALL TO authenticated
  USING (private.is_company_member(company_id))
  WITH CHECK (private.is_company_member(company_id));

DROP POLICY IF EXISTS service_order_status_history_select_member ON public.service_order_status_history;
CREATE POLICY service_order_status_history_select_member
  ON public.service_order_status_history FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS service_order_status_history_insert_member ON public.service_order_status_history;
CREATE POLICY service_order_status_history_insert_member
  ON public.service_order_status_history FOR INSERT TO authenticated
  WITH CHECK (private.is_company_member(company_id));

DROP POLICY IF EXISTS service_order_status_history_update_denied ON public.service_order_status_history;
CREATE POLICY service_order_status_history_update_denied
  ON public.service_order_status_history FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS service_order_status_history_delete_denied ON public.service_order_status_history;
CREATE POLICY service_order_status_history_delete_denied
  ON public.service_order_status_history FOR DELETE TO authenticated
  USING (false);

DROP POLICY IF EXISTS service_order_checklist_items_select_member ON public.service_order_checklist_items;
CREATE POLICY service_order_checklist_items_select_member
  ON public.service_order_checklist_items FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS service_order_checklist_items_write_member ON public.service_order_checklist_items;
CREATE POLICY service_order_checklist_items_write_member
  ON public.service_order_checklist_items FOR ALL TO authenticated
  USING (private.is_company_member(company_id))
  WITH CHECK (private.is_company_member(company_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_items TO authenticated;
GRANT SELECT, INSERT ON public.service_order_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_checklist_items TO authenticated;

GRANT ALL ON public.quote_versions TO service_role;
GRANT ALL ON public.service_orders TO service_role;
GRANT ALL ON public.service_order_items TO service_role;
GRANT ALL ON public.service_order_status_history TO service_role;
GRANT ALL ON public.service_order_checklist_items TO service_role;

-- =============================================================================
-- Fim — quote_versions_service_orders
-- =============================================================================

-- Post-event financial closeout (DEV foundation)
-- Keeps the original invoice immutable and creates a separate supplemental invoice
-- for extra guests/services confirmed after the event.

-- ---------------------------------------------------------------------------
-- Permission boundary
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions(
  permission_key, label_pt, label_en, label_es, category_key, active
) VALUES (
  'finance.adjustments.manage',
  'Gerenciar ajustes pós-evento',
  'Manage post-event adjustments',
  'Gestionar ajustes posteriores al evento',
  'finance',
  true
)
ON CONFLICT (permission_key) DO UPDATE SET
  label_pt = EXCLUDED.label_pt,
  label_en = EXCLUDED.label_en,
  label_es = EXCLUDED.label_es,
  category_key = EXCLUDED.category_key,
  active = true;

INSERT INTO public.role_permissions(role_key, permission_key)
VALUES
  ('owner', 'finance.adjustments.manage'),
  ('admin', 'finance.adjustments.manage'),
  ('finance', 'finance.adjustments.manage')
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Invoice lineage: one original invoice + zero/many supplemental invoices.
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_kind text NOT NULL DEFAULT 'original',
  ADD COLUMN IF NOT EXISTS parent_invoice_id uuid,
  ADD COLUMN IF NOT EXISTS service_order_id uuid,
  ADD COLUMN IF NOT EXISTS closeout_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass
      AND conname = 'invoices_kind_check'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_kind_check
      CHECK (invoice_kind IN ('original', 'post_event_adjustment'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass
      AND conname = 'invoices_parent_invoice_id_fkey'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_parent_invoice_id_fkey
      FOREIGN KEY (parent_invoice_id) REFERENCES public.invoices(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass
      AND conname = 'invoices_service_order_id_fkey'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_service_order_id_fkey
      FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE RESTRICT;
  END IF;
END $$;

DROP INDEX IF EXISTS public.invoices_company_quote_active_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_company_quote_original_active_uidx
  ON public.invoices(company_id, quote_id)
  WHERE invoice_kind = 'original' AND status IS DISTINCT FROM 'canceled';

CREATE INDEX IF NOT EXISTS idx_invoices_parent_invoice
  ON public.invoices(company_id, parent_invoice_id)
  WHERE parent_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_service_order
  ON public.invoices(company_id, service_order_id)
  WHERE service_order_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Operational closeout + detailed adjustment lines.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_financial_closeouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE RESTRICT,
  original_invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  supplemental_invoice_id uuid REFERENCES public.invoices(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready_for_review', 'closed_no_charge', 'invoiced', 'void')),
  currency_code text NOT NULL DEFAULT 'USD',
  original_invoice_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (original_invoice_total >= 0),
  contracted_adults integer NOT NULL DEFAULT 0 CHECK (contracted_adults >= 0),
  contracted_children_under_3 integer NOT NULL DEFAULT 0 CHECK (contracted_children_under_3 >= 0),
  contracted_children_4_to_12 integer NOT NULL DEFAULT 0 CHECK (contracted_children_4_to_12 >= 0),
  contracted_physical_guests integer NOT NULL DEFAULT 0 CHECK (contracted_physical_guests >= 0),
  contracted_billable_guests numeric(12,2) NOT NULL DEFAULT 0 CHECK (contracted_billable_guests >= 0),
  final_adults integer,
  final_children_under_3 integer,
  final_children_4_to_12 integer,
  final_physical_guests integer,
  final_billable_guests numeric(12,2),
  billable_guest_overage numeric(12,2) NOT NULL DEFAULT 0 CHECK (billable_guest_overage >= 0),
  guest_overage_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (guest_overage_total >= 0),
  extra_services_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (extra_services_total >= 0),
  adjustment_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (adjustment_total >= 0),
  pricing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid,
  updated_by uuid,
  finalized_by uuid,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, service_order_id),
  UNIQUE(supplemental_invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_event_financial_closeouts_company_status
  ON public.event_financial_closeouts(company_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_financial_closeouts_quote
  ON public.event_financial_closeouts(company_id, quote_id);
CREATE INDEX IF NOT EXISTS idx_event_financial_closeouts_original_invoice
  ON public.event_financial_closeouts(company_id, original_invoice_id);

CREATE TABLE IF NOT EXISTS public.event_financial_closeout_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  closeout_id uuid NOT NULL REFERENCES public.event_financial_closeouts(id) ON DELETE CASCADE,
  line_type text NOT NULL
    CHECK (line_type IN ('guest_overage', 'extra_service', 'overtime', 'equipment', 'damage', 'other')),
  source_ref text,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_financial_closeout_lines_closeout
  ON public.event_financial_closeout_lines(company_id, closeout_id, created_at);

ALTER TABLE public.event_financial_closeouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_financial_closeout_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_financial_closeouts_select_finance ON public.event_financial_closeouts;
CREATE POLICY event_financial_closeouts_select_finance
ON public.event_financial_closeouts
FOR SELECT TO authenticated
USING (
  private.has_permission(company_id, 'orders.financial.view')
  OR private.has_permission(company_id, 'finance.invoices.view')
);

DROP POLICY IF EXISTS event_financial_closeout_lines_select_finance ON public.event_financial_closeout_lines;
CREATE POLICY event_financial_closeout_lines_select_finance
ON public.event_financial_closeout_lines
FOR SELECT TO authenticated
USING (
  private.has_permission(company_id, 'orders.financial.view')
  OR private.has_permission(company_id, 'finance.invoices.view')
);

-- Explicitly keep writes server-owned.
REVOKE INSERT, UPDATE, DELETE ON public.event_financial_closeouts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.event_financial_closeout_lines FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ensure one closeout exists for a service order and freeze agreed pricing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_event_financial_closeout(
  p_company_id uuid,
  p_service_order_id uuid,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.service_orders%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_existing public.event_financial_closeouts%ROWTYPE;
  v_guest jsonb;
BEGIN
  IF p_company_id IS NULL OR p_service_order_id IS NULL THEN
    RAISE EXCEPTION 'closeout_scope_required';
  END IF;
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'actor_required';
  END IF;

  SELECT * INTO v_existing
  FROM public.event_financial_closeouts
  WHERE company_id = p_company_id AND service_order_id = p_service_order_id
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('id', v_existing.id, 'status', v_existing.status, 'duplicate', true);
  END IF;

  SELECT * INTO v_order
  FROM public.service_orders
  WHERE id = p_service_order_id AND company_id = p_company_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'service_order_not_found'; END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE company_id = p_company_id
    AND quote_id = v_order.quote_id
    AND invoice_kind = 'original'
    AND status IS DISTINCT FROM 'canceled'
  ORDER BY created_at ASC
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'original_invoice_not_found'; END IF;

  v_guest := COALESCE(v_order.commercial_snapshot->'guest_counts', '{}'::jsonb);

  INSERT INTO public.event_financial_closeouts(
    company_id,
    service_order_id,
    quote_id,
    original_invoice_id,
    currency_code,
    original_invoice_total,
    contracted_adults,
    contracted_children_under_3,
    contracted_children_4_to_12,
    contracted_physical_guests,
    contracted_billable_guests,
    pricing_snapshot,
    created_by,
    updated_by
  ) VALUES (
    p_company_id,
    p_service_order_id,
    v_order.quote_id,
    v_invoice.id,
    COALESCE(v_invoice.currency_code, v_order.currency_code, 'USD'),
    COALESCE(v_invoice.total, 0),
    COALESCE((v_guest->>'adult_count')::integer, 0),
    COALESCE((v_guest->>'children_under_3_count')::integer, 0),
    COALESCE((v_guest->>'children_4_to_12_count')::integer, 0),
    COALESCE((v_guest->>'physical_guest_count')::integer, v_order.physical_guest_count, 0),
    COALESCE((v_guest->>'billable_guest_count')::numeric, v_order.billable_guest_count, 0),
    COALESCE(v_order.commercial_snapshot->'pricing_breakdown', '{}'::jsonb),
    p_actor_user_id,
    p_actor_user_id
  )
  ON CONFLICT (company_id, service_order_id) DO NOTHING;

  SELECT * INTO v_existing
  FROM public.event_financial_closeouts
  WHERE company_id = p_company_id AND service_order_id = p_service_order_id
  LIMIT 1;

  RETURN jsonb_build_object('id', v_existing.id, 'status', v_existing.status, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_event_financial_closeout(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_event_financial_closeout(uuid, uuid, uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Recalculate closeout from actual guest counts + explicit extra-service lines.
-- Guest overage always uses the frozen unit prices from the accepted order.
-- Fewer guests do not automatically create a credit/refund.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_event_financial_closeout(
  p_company_id uuid,
  p_service_order_id uuid,
  p_final_adults integer,
  p_final_children_under_3 integer,
  p_final_children_4_to_12 integer,
  p_extra_services jsonb,
  p_notes text,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ensure jsonb;
  v_closeout public.event_financial_closeouts%ROWTYPE;
  v_line jsonb;
  v_extra jsonb;
  v_final_physical integer;
  v_final_billable numeric(12,2);
  v_overage numeric(12,2);
  v_unit_price numeric(12,2);
  v_quantity numeric(12,2);
  v_amount numeric(12,2);
  v_description text;
  v_line_type text;
  v_guest_total numeric(12,2);
  v_extra_total numeric(12,2);
BEGIN
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;
  IF COALESCE(p_final_adults, -1) < 0
     OR COALESCE(p_final_children_under_3, -1) < 0
     OR COALESCE(p_final_children_4_to_12, -1) < 0 THEN
    RAISE EXCEPTION 'invalid_final_guest_counts';
  END IF;

  SELECT public.ensure_event_financial_closeout(
    p_company_id, p_service_order_id, p_actor_user_id
  ) INTO v_ensure;

  SELECT * INTO v_closeout
  FROM public.event_financial_closeouts
  WHERE id = (v_ensure->>'id')::uuid AND company_id = p_company_id
  FOR UPDATE;

  IF v_closeout.status IN ('invoiced', 'closed_no_charge', 'void') THEN
    RAISE EXCEPTION 'closeout_finalized';
  END IF;

  v_final_physical := p_final_adults + p_final_children_under_3 + p_final_children_4_to_12;
  v_final_billable := round((p_final_adults::numeric + (p_final_children_4_to_12::numeric * 0.5)) * 100) / 100;
  v_overage := greatest(0, v_final_billable - v_closeout.contracted_billable_guests);

  DELETE FROM public.event_financial_closeout_lines
  WHERE company_id = p_company_id AND closeout_id = v_closeout.id;

  IF v_overage > 0 THEN
    FOR v_line IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(v_closeout.pricing_snapshot->'lines', '[]'::jsonb))
    LOOP
      IF lower(COALESCE(v_line->>'unit', '')) = 'guest' THEN
        v_unit_price := greatest(0, COALESCE((v_line->>'unit_price')::numeric, 0));
        v_amount := round((v_overage * v_unit_price) * 100) / 100;
        IF v_amount > 0 THEN
          INSERT INTO public.event_financial_closeout_lines(
            company_id, closeout_id, line_type, source_ref, description,
            quantity, unit_price, amount, metadata, created_by
          ) VALUES (
            p_company_id,
            v_closeout.id,
            'guest_overage',
            NULLIF(v_line->>'source_id', ''),
            COALESCE(NULLIF(v_line->>'description', ''), 'Convidados adicionais'),
            v_overage,
            v_unit_price,
            v_amount,
            jsonb_build_object(
              'original_line_key', v_line->>'line_key',
              'original_source_type', v_line->>'source_type',
              'contracted_billable_guests', v_closeout.contracted_billable_guests,
              'final_billable_guests', v_final_billable
            ),
            p_actor_user_id
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF jsonb_typeof(COALESCE(p_extra_services, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'invalid_extra_services';
  END IF;
  IF jsonb_array_length(COALESCE(p_extra_services, '[]'::jsonb)) > 50 THEN
    RAISE EXCEPTION 'too_many_extra_services';
  END IF;

  FOR v_extra IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_extra_services, '[]'::jsonb))
  LOOP
    v_description := trim(COALESCE(v_extra->>'description', ''));
    v_quantity := COALESCE((v_extra->>'quantity')::numeric, 0);
    v_unit_price := COALESCE((v_extra->>'unit_price')::numeric, 0);
    v_line_type := COALESCE(NULLIF(v_extra->>'line_type', ''), 'extra_service');

    IF length(v_description) < 3 THEN RAISE EXCEPTION 'extra_service_description_required'; END IF;
    IF v_quantity <= 0 THEN RAISE EXCEPTION 'extra_service_quantity_invalid'; END IF;
    IF v_unit_price < 0 THEN RAISE EXCEPTION 'extra_service_unit_price_invalid'; END IF;
    IF v_line_type NOT IN ('extra_service', 'overtime', 'equipment', 'damage', 'other') THEN
      RAISE EXCEPTION 'extra_service_type_invalid';
    END IF;

    v_amount := round((v_quantity * v_unit_price) * 100) / 100;
    IF v_amount > 0 THEN
      INSERT INTO public.event_financial_closeout_lines(
        company_id, closeout_id, line_type, description, quantity,
        unit_price, amount, metadata, created_by
      ) VALUES (
        p_company_id, v_closeout.id, v_line_type, v_description,
        v_quantity, v_unit_price, v_amount, COALESCE(v_extra->'metadata', '{}'::jsonb), p_actor_user_id
      );
    END IF;
  END LOOP;

  SELECT
    COALESCE(sum(amount) FILTER (WHERE line_type = 'guest_overage'), 0),
    COALESCE(sum(amount) FILTER (WHERE line_type <> 'guest_overage'), 0)
  INTO v_guest_total, v_extra_total
  FROM public.event_financial_closeout_lines
  WHERE company_id = p_company_id AND closeout_id = v_closeout.id;

  UPDATE public.event_financial_closeouts
  SET final_adults = p_final_adults,
      final_children_under_3 = p_final_children_under_3,
      final_children_4_to_12 = p_final_children_4_to_12,
      final_physical_guests = v_final_physical,
      final_billable_guests = v_final_billable,
      billable_guest_overage = v_overage,
      guest_overage_total = round(v_guest_total * 100) / 100,
      extra_services_total = round(v_extra_total * 100) / 100,
      adjustment_total = round((v_guest_total + v_extra_total) * 100) / 100,
      status = 'ready_for_review',
      notes = NULLIF(trim(COALESCE(p_notes, '')), ''),
      updated_by = p_actor_user_id,
      updated_at = now()
  WHERE id = v_closeout.id AND company_id = p_company_id
  RETURNING * INTO v_closeout;

  RETURN jsonb_build_object(
    'id', v_closeout.id,
    'status', v_closeout.status,
    'contracted_billable_guests', v_closeout.contracted_billable_guests,
    'final_billable_guests', v_closeout.final_billable_guests,
    'billable_guest_overage', v_closeout.billable_guest_overage,
    'guest_overage_total', v_closeout.guest_overage_total,
    'extra_services_total', v_closeout.extra_services_total,
    'adjustment_total', v_closeout.adjustment_total,
    'currency_code', v_closeout.currency_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_event_financial_closeout(uuid, uuid, integer, integer, integer, jsonb, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_event_financial_closeout(uuid, uuid, integer, integer, integer, jsonb, text, uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Finalize closeout. Zero-charge closeouts are closed without an invoice.
-- Positive closeouts create a separate supplemental invoice linked to the original.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_event_financial_closeout(
  p_company_id uuid,
  p_service_order_id uuid,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_closeout public.event_financial_closeouts%ROWTYPE;
  v_original public.invoices%ROWTYPE;
  v_order public.service_orders%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_invoice_number text;
  v_lines jsonb;
  v_snapshot jsonb;
  v_package_name text;
BEGIN
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;

  SELECT * INTO v_closeout
  FROM public.event_financial_closeouts
  WHERE company_id = p_company_id AND service_order_id = p_service_order_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'closeout_not_found'; END IF;

  IF v_closeout.status = 'invoiced' THEN
    RETURN jsonb_build_object(
      'duplicate', true,
      'status', v_closeout.status,
      'closeout_id', v_closeout.id,
      'invoice_id', v_closeout.supplemental_invoice_id,
      'adjustment_total', v_closeout.adjustment_total
    );
  END IF;
  IF v_closeout.status = 'closed_no_charge' THEN
    RETURN jsonb_build_object(
      'duplicate', true,
      'status', v_closeout.status,
      'closeout_id', v_closeout.id,
      'invoice_id', NULL,
      'adjustment_total', 0
    );
  END IF;
  IF v_closeout.status <> 'ready_for_review' THEN
    RAISE EXCEPTION 'closeout_not_ready';
  END IF;

  IF v_closeout.adjustment_total <= 0 THEN
    UPDATE public.event_financial_closeouts
    SET status = 'closed_no_charge',
        finalized_by = p_actor_user_id,
        finalized_at = now(),
        updated_by = p_actor_user_id,
        updated_at = now()
    WHERE id = v_closeout.id;

    RETURN jsonb_build_object(
      'duplicate', false,
      'status', 'closed_no_charge',
      'closeout_id', v_closeout.id,
      'invoice_id', NULL,
      'adjustment_total', 0
    );
  END IF;

  SELECT * INTO v_original
  FROM public.invoices
  WHERE id = v_closeout.original_invoice_id AND company_id = p_company_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'original_invoice_not_found'; END IF;

  SELECT * INTO v_order
  FROM public.service_orders
  WHERE id = p_service_order_id AND company_id = p_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'service_order_not_found'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'itemId', l.id::text,
    'label', l.description,
    'quantity', l.quantity,
    'unitPrice', l.unit_price,
    'total', l.amount,
    'lineType', l.line_type,
    'sourceRef', l.source_ref
  ) ORDER BY l.created_at, l.id), '[]'::jsonb)
  INTO v_lines
  FROM public.event_financial_closeout_lines l
  WHERE l.company_id = p_company_id AND l.closeout_id = v_closeout.id;

  v_package_name := CASE v_original.locale
    WHEN 'en' THEN 'Post-event adjustment'
    WHEN 'es' THEN 'Ajuste posterior al evento'
    ELSE 'Ajuste pós-evento'
  END;

  v_snapshot := jsonb_build_object(
    'version', 'CDL_INVOICE_SNAP_2026_V1',
    'frozenAt', now(),
    'locale', v_original.locale,
    'quote', COALESCE(v_original.snapshot->'quote', jsonb_build_object('id', v_order.quote_id, 'number', NULL, 'status', NULL)),
    'customer', COALESCE(v_original.snapshot->'customer', '{}'::jsonb),
    'event', COALESCE(v_original.snapshot->'event', '{}'::jsonb),
    'package', jsonb_build_object(
      'id', NULL,
      'key', 'POST_EVENT_ADJUSTMENT',
      'name', v_package_name,
      'unitPrice', NULL,
      'total', 0
    ),
    'guests', jsonb_build_object(
      'adults', v_closeout.final_adults,
      'childrenUnder3', v_closeout.final_children_under_3,
      'children4To12', v_closeout.final_children_4_to_12,
      'billableGuestCount', v_closeout.final_billable_guests,
      'physicalGuestCount', v_closeout.final_physical_guests
    ),
    'additionals', v_lines,
    'grill', jsonb_build_object('required', false, 'quantity', 0, 'total', 0),
    'mileage', jsonb_build_object('distance', NULL, 'freeLimit', NULL, 'rate', NULL, 'fee', 0),
    'commercial', jsonb_build_object(
      'discount', 0,
      'holidaySurcharge', 0,
      'minimumOrderAmount', 0,
      'minimumOrderApplied', false,
      'onlinePaymentFee', 0
    ),
    'reservation', jsonb_build_object(
      'percentage', 0,
      'depositAmount', 0,
      'balanceAmount', v_closeout.adjustment_total
    ),
    'totals', jsonb_build_object(
      'subtotal', v_closeout.adjustment_total,
      'total', v_closeout.adjustment_total,
      'currency', v_closeout.currency_code
    ),
    'pricingBreakdown', NULL,
    'adjustment', jsonb_build_object(
      'type', 'post_event',
      'closeoutId', v_closeout.id,
      'serviceOrderId', p_service_order_id,
      'serviceOrderNumber', v_order.service_order_number,
      'originalInvoiceId', v_original.id,
      'originalInvoiceNumber', v_original.invoice_number,
      'originalInvoiceTotal', v_original.total,
      'contractedBillableGuests', v_closeout.contracted_billable_guests,
      'finalBillableGuests', v_closeout.final_billable_guests,
      'billableGuestOverage', v_closeout.billable_guest_overage,
      'guestOverageTotal', v_closeout.guest_overage_total,
      'extraServicesTotal', v_closeout.extra_services_total,
      'finalEventTotal', round((v_original.total + v_closeout.adjustment_total) * 100) / 100,
      'notes', v_closeout.notes
    )
  );

  v_invoice_number := public.get_next_document_number(p_company_id, 'invoice');

  INSERT INTO public.invoices(
    company_id, quote_id, invoice_number, status, locale, currency_code, snapshot,
    subtotal, total, deposit_amount, balance_amount, paid_total, online_payment_fee,
    created_by, invoice_kind, parent_invoice_id, service_order_id, closeout_id
  ) VALUES (
    p_company_id,
    v_closeout.quote_id,
    v_invoice_number,
    'ready',
    v_original.locale,
    v_closeout.currency_code,
    v_snapshot,
    v_closeout.adjustment_total,
    v_closeout.adjustment_total,
    0,
    v_closeout.adjustment_total,
    0,
    0,
    p_actor_user_id,
    'post_event_adjustment',
    v_original.id,
    p_service_order_id,
    v_closeout.id
  ) RETURNING * INTO v_invoice;

  UPDATE public.event_financial_closeouts
  SET status = 'invoiced',
      supplemental_invoice_id = v_invoice.id,
      finalized_by = p_actor_user_id,
      finalized_at = now(),
      updated_by = p_actor_user_id,
      updated_at = now()
  WHERE id = v_closeout.id;

  RETURN jsonb_build_object(
    'duplicate', false,
    'status', 'invoiced',
    'closeout_id', v_closeout.id,
    'invoice_id', v_invoice.id,
    'invoice_number', v_invoice.invoice_number,
    'adjustment_total', v_closeout.adjustment_total,
    'final_event_total', round((v_original.total + v_closeout.adjustment_total) * 100) / 100
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_event_financial_closeout(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_event_financial_closeout(uuid, uuid, uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Add lineage to PSCS One outbox payload without changing event names.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.finance_invoice_outbox_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_key text;
  v_quote_number text;
BEGIN
  SELECT q.quote_number INTO v_quote_number
  FROM public.quotes q
  WHERE q.id = NEW.quote_id AND q.company_id = NEW.company_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM private.enqueue_finance_outbox(
      NEW.company_id,
      'invoice.created',
      'invoice',
      NEW.id,
      'invoice.created:' || NEW.id::text,
      jsonb_build_object(
        'company_id', NEW.company_id,
        'invoice_id', NEW.id,
        'invoice_number', NEW.invoice_number,
        'invoice_kind', NEW.invoice_kind,
        'parent_invoice_id', NEW.parent_invoice_id,
        'service_order_id', NEW.service_order_id,
        'closeout_id', NEW.closeout_id,
        'quote_id', NEW.quote_id,
        'quote_number', v_quote_number,
        'currency', NEW.currency_code,
        'subtotal', NEW.subtotal,
        'total', NEW.total,
        'deposit_amount', NEW.deposit_amount,
        'occurred_at', NEW.created_at
      )
    );
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'paid' THEN
      v_key := 'invoice.paid:' || NEW.id::text || ':' || NEW.updated_at::text;
      PERFORM private.enqueue_finance_outbox(
        NEW.company_id, 'invoice.paid', 'invoice', NEW.id, v_key,
        jsonb_build_object(
          'company_id', NEW.company_id,
          'invoice_id', NEW.id,
          'invoice_number', NEW.invoice_number,
          'invoice_kind', NEW.invoice_kind,
          'parent_invoice_id', NEW.parent_invoice_id,
          'service_order_id', NEW.service_order_id,
          'closeout_id', NEW.closeout_id,
          'quote_id', NEW.quote_id,
          'quote_number', v_quote_number,
          'currency', NEW.currency_code,
          'total', NEW.total,
          'paid_total', NEW.paid_total,
          'occurred_at', NEW.updated_at
        )
      );
    ELSIF NEW.status = 'canceled' THEN
      v_key := 'invoice.canceled:' || NEW.id::text;
      PERFORM private.enqueue_finance_outbox(
        NEW.company_id, 'invoice.canceled', 'invoice', NEW.id, v_key,
        jsonb_build_object(
          'company_id', NEW.company_id,
          'invoice_id', NEW.id,
          'invoice_number', NEW.invoice_number,
          'invoice_kind', NEW.invoice_kind,
          'parent_invoice_id', NEW.parent_invoice_id,
          'service_order_id', NEW.service_order_id,
          'closeout_id', NEW.closeout_id,
          'quote_id', NEW.quote_id,
          'quote_number', v_quote_number,
          'currency', NEW.currency_code,
          'paid_total', NEW.paid_total,
          'occurred_at', COALESCE(NEW.canceled_at, NEW.updated_at)
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

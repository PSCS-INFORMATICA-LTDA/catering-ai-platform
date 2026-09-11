-- =============================================================================
-- Finance hardening: manual reconciliation, refunds, cancellation workflow,
-- and PSCS One integration outbox.
-- DEV first. Does not enable PayPal Live or Production money movement.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Explicit mutating finance permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (
  permission_key, label_pt, label_en, label_es, category_key, active
)
VALUES
  ('finance.payments.reconcile', 'Conciliar pagamentos', 'Reconcile payments', 'Conciliar pagos', 'finance', true),
  ('finance.refunds.manage', 'Gerenciar reembolsos', 'Manage refunds', 'Gestionar reembolsos', 'finance', true),
  ('finance.invoices.cancel', 'Cancelar faturas', 'Cancel invoices', 'Cancelar facturas', 'finance', true)
ON CONFLICT (permission_key) DO UPDATE SET
  label_pt = EXCLUDED.label_pt,
  label_en = EXCLUDED.label_en,
  label_es = EXCLUDED.label_es,
  category_key = EXCLUDED.category_key,
  active = true;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT role_key, permission_key
FROM (VALUES ('owner'), ('admin'), ('finance')) AS r(role_key)
CROSS JOIN (VALUES
  ('finance.payments.reconcile'),
  ('finance.refunds.manage'),
  ('finance.invoices.cancel')
) AS p(permission_key)
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Manual/offline reconciliation evidence on payment records
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoice_payments
  ADD COLUMN IF NOT EXISTS confirmation_reference text,
  ADD COLUMN IF NOT EXISTS confirmation_note text,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

ALTER TABLE public.invoice_payments
  DROP CONSTRAINT IF EXISTS invoice_payments_manual_completion_evidence;
ALTER TABLE public.invoice_payments
  ADD CONSTRAINT invoice_payments_manual_completion_evidence
  CHECK (
    provider NOT IN ('zelle', 'bank_transfer')
    OR status <> 'completed'
    OR (
      confirmed_at IS NOT NULL
      AND confirmed_by IS NOT NULL
      AND length(trim(COALESCE(confirmation_reference, ''))) >= 3
    )
  );

COMMENT ON COLUMN public.invoice_payments.confirmation_reference IS
  'External/manual evidence reference for reconciled Zelle or bank-transfer receipts. Never store bank login credentials.';

-- Needed for tenant-safe refund references.
ALTER TABLE public.invoice_payments
  ADD CONSTRAINT invoice_payments_id_invoice_company_key
  UNIQUE (id, invoice_id, company_id);

-- ---------------------------------------------------------------------------
-- Append-only refund lifecycle. A completed capture is never rewritten away.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL,
  payment_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency_code text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'requested',
  reason text NOT NULL,
  provider_refund_id text,
  idempotency_key text NOT NULL,
  requested_by uuid,
  completed_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_refunds_amount_positive CHECK (amount > 0),
  CONSTRAINT invoice_refunds_status_check CHECK (
    status IN ('requested', 'processing', 'completed', 'failed', 'canceled')
  ),
  CONSTRAINT invoice_refunds_invoice_company_fkey
    FOREIGN KEY (invoice_id, company_id)
    REFERENCES public.invoices(id, company_id)
    ON DELETE RESTRICT,
  CONSTRAINT invoice_refunds_payment_invoice_company_fkey
    FOREIGN KEY (payment_id, invoice_id, company_id)
    REFERENCES public.invoice_payments(id, invoice_id, company_id)
    ON DELETE RESTRICT,
  CONSTRAINT invoice_refunds_completed_evidence CHECK (
    status <> 'completed'
    OR (completed_at IS NOT NULL AND length(trim(COALESCE(provider_refund_id, ''))) >= 3)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_refunds_idempotency_uidx
  ON public.invoice_refunds(company_id, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS invoice_refunds_provider_ref_uidx
  ON public.invoice_refunds(company_id, provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_refunds_invoice_company
  ON public.invoice_refunds(invoice_id, company_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_refunds_payment_invoice_company
  ON public.invoice_refunds(payment_id, invoice_id, company_id);

CREATE OR REPLACE FUNCTION private.validate_invoice_refund_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_payment_amount numeric(12,2);
  v_payment_currency text;
  v_reserved numeric(12,2);
BEGIN
  SELECT amount, currency_code
    INTO v_payment_amount, v_payment_currency
  FROM public.invoice_payments
  WHERE id = NEW.payment_id
    AND invoice_id = NEW.invoice_id
    AND company_id = NEW.company_id
    AND status = 'completed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'refund_requires_completed_payment';
  END IF;

  IF upper(NEW.currency_code) <> upper(v_payment_currency) THEN
    RAISE EXCEPTION 'refund_currency_mismatch';
  END IF;

  SELECT COALESCE(sum(amount), 0)
    INTO v_reserved
  FROM public.invoice_refunds
  WHERE payment_id = NEW.payment_id
    AND invoice_id = NEW.invoice_id
    AND company_id = NEW.company_id
    AND status IN ('requested', 'processing', 'completed')
    AND id IS DISTINCT FROM NEW.id;

  IF round((v_reserved + NEW.amount) * 100) / 100 > round(v_payment_amount * 100) / 100 THEN
    RAISE EXCEPTION 'refund_exceeds_payment';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_refunds_validate_amount ON public.invoice_refunds;
CREATE TRIGGER invoice_refunds_validate_amount
BEFORE INSERT OR UPDATE OF amount, currency_code, status, payment_id, invoice_id, company_id
ON public.invoice_refunds
FOR EACH ROW
EXECUTE FUNCTION private.validate_invoice_refund_amount();

-- ---------------------------------------------------------------------------
-- Explicit invoice cancellation workflow. A paid invoice remains financially
-- open while refunds are pending and becomes canceled only after settlement.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL,
  quote_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  reason text NOT NULL,
  requested_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  agenda_released_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_cancellations_status_check CHECK (
    status IN ('requested', 'pending_refund', 'completed', 'rejected')
  ),
  CONSTRAINT invoice_cancellations_invoice_company_fkey
    FOREIGN KEY (invoice_id, company_id)
    REFERENCES public.invoices(id, company_id)
    ON DELETE RESTRICT,
  CONSTRAINT invoice_cancellations_quote_company_fkey
    FOREIGN KEY (quote_id, company_id)
    REFERENCES public.quotes(id, company_id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_cancellations_active_uidx
  ON public.invoice_cancellations(company_id, invoice_id)
  WHERE status IN ('requested', 'pending_refund');
CREATE INDEX IF NOT EXISTS idx_invoice_cancellations_invoice_company
  ON public.invoice_cancellations(invoice_id, company_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_cancellations_quote_company
  ON public.invoice_cancellations(quote_id, company_id, status);

-- ---------------------------------------------------------------------------
-- Atomic ledger reconciliation from immutable financial movements.
-- completed payments - completed refunds = invoice paid_total.
-- Only service_role may call this RPC.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reconcile_invoice_ledger(
  p_company_id uuid,
  p_invoice_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_payments numeric(12,2);
  v_refunds numeric(12,2);
  v_net numeric(12,2);
  v_status text;
BEGIN
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invoice_not_found';
  END IF;

  SELECT COALESCE(sum(amount), 0)
    INTO v_payments
  FROM public.invoice_payments
  WHERE invoice_id = p_invoice_id
    AND company_id = p_company_id
    AND status = 'completed';

  SELECT COALESCE(sum(amount), 0)
    INTO v_refunds
  FROM public.invoice_refunds
  WHERE invoice_id = p_invoice_id
    AND company_id = p_company_id
    AND status = 'completed';

  v_net := greatest(0, round((v_payments - v_refunds) * 100) / 100);

  IF v_invoice.status = 'canceled' THEN
    v_status := 'canceled';
  ELSIF v_net <= 0 THEN
    v_status := CASE WHEN v_invoice.status = 'ready' THEN 'ready' ELSE 'awaiting_deposit' END;
  ELSIF v_net + 0.009 >= v_invoice.total THEN
    v_status := 'paid';
  ELSE
    v_status := 'partially_paid';
  END IF;

  UPDATE public.invoices
  SET paid_total = v_net,
      status = v_status,
      updated_at = now()
  WHERE id = p_invoice_id AND company_id = p_company_id;

  RETURN jsonb_build_object(
    'invoice_id', p_invoice_id,
    'payment_total', v_payments,
    'refund_total', v_refunds,
    'paid_total', v_net,
    'status', v_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_invoice_ledger(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_invoice_ledger(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Durable integration outbox for the future PSCS One receiver.
-- No network dispatch is enabled by this migration.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_integration_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  destination text NOT NULL DEFAULT 'pscs_one',
  source_product text NOT NULL DEFAULT 'catering_ai',
  event_type text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  dedup_key text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  published_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_outbox_destination_check CHECK (destination = 'pscs_one'),
  CONSTRAINT finance_outbox_source_check CHECK (source_product = 'catering_ai'),
  CONSTRAINT finance_outbox_status_check CHECK (
    status IN ('pending', 'processing', 'published', 'failed')
  ),
  CONSTRAINT finance_outbox_attempts_non_negative CHECK (attempts >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_outbox_dedup_uidx
  ON public.finance_integration_outbox(destination, dedup_key);
CREATE INDEX IF NOT EXISTS idx_finance_outbox_dispatch
  ON public.finance_integration_outbox(status, available_at, created_at);
CREATE INDEX IF NOT EXISTS idx_finance_outbox_company_created
  ON public.finance_integration_outbox(company_id, created_at DESC);

CREATE OR REPLACE FUNCTION private.enqueue_finance_outbox(
  p_company_id uuid,
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_dedup_key text,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  INSERT INTO public.finance_integration_outbox(
    company_id, event_type, aggregate_type, aggregate_id, dedup_key, payload
  ) VALUES (
    p_company_id, p_event_type, p_aggregate_type, p_aggregate_id, p_dedup_key, p_payload
  )
  ON CONFLICT (destination, dedup_key) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION private.finance_invoice_outbox_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_key text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.enqueue_finance_outbox(
      NEW.company_id,
      'invoice.created',
      'invoice',
      NEW.id,
      'invoice.created:' || NEW.id::text,
      jsonb_build_object(
        'invoice_id', NEW.id,
        'invoice_number', NEW.invoice_number,
        'quote_id', NEW.quote_id,
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
          'invoice_id', NEW.id,
          'invoice_number', NEW.invoice_number,
          'quote_id', NEW.quote_id,
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
          'invoice_id', NEW.id,
          'invoice_number', NEW.invoice_number,
          'quote_id', NEW.quote_id,
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

CREATE OR REPLACE FUNCTION private.finance_payment_outbox_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM private.enqueue_finance_outbox(
      NEW.company_id, 'payment.completed', 'payment', NEW.id,
      'payment.completed:' || NEW.id::text,
      jsonb_build_object(
        'payment_id', NEW.id,
        'invoice_id', NEW.invoice_id,
        'provider', NEW.provider,
        'provider_order_id', NEW.provider_order_id,
        'provider_capture_id', NEW.provider_capture_id,
        'purpose', NEW.purpose,
        'amount', NEW.amount,
        'currency', NEW.currency_code,
        'occurred_at', COALESCE(NEW.captured_at, NEW.updated_at, NEW.created_at)
      )
    );
  ELSIF NEW.status = 'failed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM private.enqueue_finance_outbox(
      NEW.company_id, 'payment.failed', 'payment', NEW.id,
      'payment.failed:' || NEW.id::text,
      jsonb_build_object(
        'payment_id', NEW.id,
        'invoice_id', NEW.invoice_id,
        'provider', NEW.provider,
        'purpose', NEW.purpose,
        'amount', NEW.amount,
        'currency', NEW.currency_code,
        'occurred_at', COALESCE(NEW.updated_at, NEW.created_at)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.finance_refund_outbox_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM private.enqueue_finance_outbox(
      NEW.company_id, 'payment.refunded', 'refund', NEW.id,
      'payment.refunded:' || NEW.id::text,
      jsonb_build_object(
        'refund_id', NEW.id,
        'invoice_id', NEW.invoice_id,
        'payment_id', NEW.payment_id,
        'provider_refund_id', NEW.provider_refund_id,
        'amount', NEW.amount,
        'currency', NEW.currency_code,
        'reason', NEW.reason,
        'occurred_at', NEW.completed_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS finance_invoice_outbox ON public.invoices;
CREATE TRIGGER finance_invoice_outbox
AFTER INSERT OR UPDATE OF status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION private.finance_invoice_outbox_trigger();

DROP TRIGGER IF EXISTS finance_payment_outbox ON public.invoice_payments;
CREATE TRIGGER finance_payment_outbox
AFTER INSERT OR UPDATE OF status ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION private.finance_payment_outbox_trigger();

DROP TRIGGER IF EXISTS finance_refund_outbox ON public.invoice_refunds;
CREATE TRIGGER finance_refund_outbox
AFTER INSERT OR UPDATE OF status ON public.invoice_refunds
FOR EACH ROW EXECUTE FUNCTION private.finance_refund_outbox_trigger();

-- Claim/retry primitives for a future PSCS One delivery worker.
CREATE OR REPLACE FUNCTION public.claim_finance_outbox(p_limit integer DEFAULT 50)
RETURNS SETOF public.finance_integration_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.finance_integration_outbox
    WHERE status IN ('pending', 'failed')
      AND available_at <= now()
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(COALESCE(p_limit, 50), 200))
  )
  UPDATE public.finance_integration_outbox o
  SET status = 'processing',
      attempts = o.attempts + 1,
      locked_at = now(),
      updated_at = now()
  FROM candidates c
  WHERE o.id = c.id
  RETURNING o.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_finance_outbox(
  p_event_id uuid,
  p_success boolean,
  p_error text DEFAULT NULL,
  p_retry_seconds integer DEFAULT 300
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.finance_integration_outbox
  SET status = CASE WHEN p_success THEN 'published' ELSE 'failed' END,
      published_at = CASE WHEN p_success THEN now() ELSE published_at END,
      last_error = CASE WHEN p_success THEN NULL ELSE left(COALESCE(p_error, 'delivery_failed'), 2000) END,
      available_at = CASE
        WHEN p_success THEN available_at
        ELSE now() + make_interval(secs => greatest(60, least(COALESCE(p_retry_seconds, 300), 86400)))
      END,
      locked_at = NULL,
      updated_at = now()
  WHERE id = p_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_finance_outbox(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_finance_outbox(uuid, boolean, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_finance_outbox(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_finance_outbox(uuid, boolean, text, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoice_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_integration_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.invoice_refunds FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.invoice_cancellations FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.finance_integration_outbox FROM PUBLIC, anon;

GRANT SELECT ON TABLE public.invoice_refunds TO authenticated;
GRANT SELECT ON TABLE public.invoice_cancellations TO authenticated;
GRANT SELECT ON TABLE public.finance_integration_outbox TO authenticated;
GRANT ALL ON TABLE public.invoice_refunds TO service_role;
GRANT ALL ON TABLE public.invoice_cancellations TO service_role;
GRANT ALL ON TABLE public.finance_integration_outbox TO service_role;

DROP POLICY IF EXISTS invoice_refunds_select_finance ON public.invoice_refunds;
CREATE POLICY invoice_refunds_select_finance
ON public.invoice_refunds FOR SELECT TO authenticated
USING (private.has_permission(company_id, 'finance.invoices.view'));

DROP POLICY IF EXISTS invoice_cancellations_select_finance ON public.invoice_cancellations;
CREATE POLICY invoice_cancellations_select_finance
ON public.invoice_cancellations FOR SELECT TO authenticated
USING (private.has_permission(company_id, 'finance.invoices.view'));

DROP POLICY IF EXISTS finance_outbox_select_finance ON public.finance_integration_outbox;
CREATE POLICY finance_outbox_select_finance
ON public.finance_integration_outbox FOR SELECT TO authenticated
USING (private.has_permission(company_id, 'finance.invoices.view'));

COMMENT ON TABLE public.invoice_refunds IS
  'Append-only refund lifecycle. Original completed payments remain immutable evidence of capture.';
COMMENT ON TABLE public.invoice_cancellations IS
  'Coordinates invoice cancellation, operational release, and required refunds.';
COMMENT ON TABLE public.finance_integration_outbox IS
  'Durable, idempotent business-event outbox for future PSCS One financial consolidation.';

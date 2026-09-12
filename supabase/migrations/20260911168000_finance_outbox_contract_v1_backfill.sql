-- =============================================================================
-- PSCS One finance outbox contract v1 enrichment + historical bootstrap.
-- Delivery remains disabled; this only creates durable pending events.
-- =============================================================================

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

CREATE OR REPLACE FUNCTION private.finance_payment_outbox_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_invoice_number text;
  v_quote_id uuid;
  v_quote_number text;
BEGIN
  SELECT i.invoice_number, i.quote_id, q.quote_number
    INTO v_invoice_number, v_quote_id, v_quote_number
  FROM public.invoices i
  LEFT JOIN public.quotes q
    ON q.id = i.quote_id AND q.company_id = i.company_id
  WHERE i.id = NEW.invoice_id AND i.company_id = NEW.company_id;

  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM private.enqueue_finance_outbox(
      NEW.company_id, 'payment.completed', 'payment', NEW.id,
      'payment.completed:' || NEW.id::text,
      jsonb_build_object(
        'company_id', NEW.company_id,
        'payment_id', NEW.id,
        'invoice_id', NEW.invoice_id,
        'invoice_number', v_invoice_number,
        'quote_id', v_quote_id,
        'quote_number', v_quote_number,
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
        'company_id', NEW.company_id,
        'payment_id', NEW.id,
        'invoice_id', NEW.invoice_id,
        'invoice_number', v_invoice_number,
        'quote_id', v_quote_id,
        'quote_number', v_quote_number,
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
DECLARE
  v_invoice_number text;
  v_quote_id uuid;
  v_quote_number text;
BEGIN
  SELECT i.invoice_number, i.quote_id, q.quote_number
    INTO v_invoice_number, v_quote_id, v_quote_number
  FROM public.invoices i
  LEFT JOIN public.quotes q
    ON q.id = i.quote_id AND q.company_id = i.company_id
  WHERE i.id = NEW.invoice_id AND i.company_id = NEW.company_id;

  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM private.enqueue_finance_outbox(
      NEW.company_id, 'payment.refunded', 'refund', NEW.id,
      'payment.refunded:' || NEW.id::text,
      jsonb_build_object(
        'company_id', NEW.company_id,
        'refund_id', NEW.id,
        'invoice_id', NEW.invoice_id,
        'invoice_number', v_invoice_number,
        'quote_id', v_quote_id,
        'quote_number', v_quote_number,
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

-- Bootstrap source history into the durable outbox. ON CONFLICT keeps this
-- migration idempotent and avoids duplicating events already emitted by triggers.
INSERT INTO public.finance_integration_outbox(
  company_id, event_type, aggregate_type, aggregate_id, dedup_key, payload
)
SELECT
  i.company_id,
  'invoice.created',
  'invoice',
  i.id,
  'invoice.created:' || i.id::text,
  jsonb_build_object(
    'company_id', i.company_id,
    'invoice_id', i.id,
    'invoice_number', i.invoice_number,
    'quote_id', i.quote_id,
    'quote_number', q.quote_number,
    'currency', i.currency_code,
    'subtotal', i.subtotal,
    'total', i.total,
    'deposit_amount', i.deposit_amount,
    'occurred_at', i.created_at,
    'bootstrap', true
  )
FROM public.invoices i
LEFT JOIN public.quotes q ON q.id = i.quote_id AND q.company_id = i.company_id
ON CONFLICT (destination, dedup_key) DO NOTHING;

INSERT INTO public.finance_integration_outbox(
  company_id, event_type, aggregate_type, aggregate_id, dedup_key, payload
)
SELECT
  p.company_id,
  'payment.completed',
  'payment',
  p.id,
  'payment.completed:' || p.id::text,
  jsonb_build_object(
    'company_id', p.company_id,
    'payment_id', p.id,
    'invoice_id', p.invoice_id,
    'invoice_number', i.invoice_number,
    'quote_id', i.quote_id,
    'quote_number', q.quote_number,
    'provider', p.provider,
    'provider_order_id', p.provider_order_id,
    'provider_capture_id', p.provider_capture_id,
    'purpose', p.purpose,
    'amount', p.amount,
    'currency', p.currency_code,
    'occurred_at', COALESCE(p.captured_at, p.updated_at, p.created_at),
    'bootstrap', true
  )
FROM public.invoice_payments p
JOIN public.invoices i ON i.id = p.invoice_id AND i.company_id = p.company_id
LEFT JOIN public.quotes q ON q.id = i.quote_id AND q.company_id = i.company_id
WHERE p.status = 'completed'
ON CONFLICT (destination, dedup_key) DO NOTHING;

INSERT INTO public.finance_integration_outbox(
  company_id, event_type, aggregate_type, aggregate_id, dedup_key, payload
)
SELECT
  r.company_id,
  'payment.refunded',
  'refund',
  r.id,
  'payment.refunded:' || r.id::text,
  jsonb_build_object(
    'company_id', r.company_id,
    'refund_id', r.id,
    'invoice_id', r.invoice_id,
    'invoice_number', i.invoice_number,
    'quote_id', i.quote_id,
    'quote_number', q.quote_number,
    'payment_id', r.payment_id,
    'provider_refund_id', r.provider_refund_id,
    'amount', r.amount,
    'currency', r.currency_code,
    'reason', r.reason,
    'occurred_at', r.completed_at,
    'bootstrap', true
  )
FROM public.invoice_refunds r
JOIN public.invoices i ON i.id = r.invoice_id AND i.company_id = r.company_id
LEFT JOIN public.quotes q ON q.id = i.quote_id AND q.company_id = i.company_id
WHERE r.status = 'completed'
ON CONFLICT (destination, dedup_key) DO NOTHING;

INSERT INTO public.finance_integration_outbox(
  company_id, event_type, aggregate_type, aggregate_id, dedup_key, payload
)
SELECT
  i.company_id,
  CASE WHEN i.status = 'paid' THEN 'invoice.paid' ELSE 'invoice.canceled' END,
  'invoice',
  i.id,
  CASE
    WHEN i.status = 'paid' THEN 'invoice.paid:bootstrap:' || i.id::text
    ELSE 'invoice.canceled:' || i.id::text
  END,
  jsonb_build_object(
    'company_id', i.company_id,
    'invoice_id', i.id,
    'invoice_number', i.invoice_number,
    'quote_id', i.quote_id,
    'quote_number', q.quote_number,
    'currency', i.currency_code,
    'total', i.total,
    'paid_total', i.paid_total,
    'occurred_at', COALESCE(i.canceled_at, i.updated_at),
    'bootstrap', true
  )
FROM public.invoices i
LEFT JOIN public.quotes q ON q.id = i.quote_id AND q.company_id = i.company_id
WHERE i.status IN ('paid', 'canceled')
ON CONFLICT (destination, dedup_key) DO NOTHING;

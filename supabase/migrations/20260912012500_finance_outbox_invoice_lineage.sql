-- Include invoice lineage in payment/refund events so PSCS One can distinguish
-- original receivables from post-event supplemental charges.

CREATE OR REPLACE FUNCTION private.finance_payment_outbox_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_invoice_number text;
  v_invoice_kind text;
  v_parent_invoice_id uuid;
  v_service_order_id uuid;
  v_closeout_id uuid;
  v_quote_id uuid;
  v_quote_number text;
BEGIN
  SELECT i.invoice_number,
         i.invoice_kind,
         i.parent_invoice_id,
         i.service_order_id,
         i.closeout_id,
         i.quote_id,
         q.quote_number
  INTO v_invoice_number,
       v_invoice_kind,
       v_parent_invoice_id,
       v_service_order_id,
       v_closeout_id,
       v_quote_id,
       v_quote_number
  FROM public.invoices i
  LEFT JOIN public.quotes q
    ON q.id = i.quote_id AND q.company_id = i.company_id
  WHERE i.id = NEW.invoice_id AND i.company_id = NEW.company_id;

  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM private.enqueue_finance_outbox(
      NEW.company_id,
      'payment.completed',
      'payment',
      NEW.id,
      'payment.completed:' || NEW.id::text,
      jsonb_build_object(
        'company_id', NEW.company_id,
        'payment_id', NEW.id,
        'invoice_id', NEW.invoice_id,
        'invoice_number', v_invoice_number,
        'invoice_kind', COALESCE(v_invoice_kind, 'original'),
        'parent_invoice_id', v_parent_invoice_id,
        'service_order_id', v_service_order_id,
        'closeout_id', v_closeout_id,
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
  ELSIF NEW.status = 'failed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM private.enqueue_finance_outbox(
      NEW.company_id,
      'payment.failed',
      'payment',
      NEW.id,
      'payment.failed:' || NEW.id::text,
      jsonb_build_object(
        'company_id', NEW.company_id,
        'payment_id', NEW.id,
        'invoice_id', NEW.invoice_id,
        'invoice_number', v_invoice_number,
        'invoice_kind', COALESCE(v_invoice_kind, 'original'),
        'parent_invoice_id', v_parent_invoice_id,
        'service_order_id', v_service_order_id,
        'closeout_id', v_closeout_id,
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
  v_invoice_kind text;
  v_parent_invoice_id uuid;
  v_service_order_id uuid;
  v_closeout_id uuid;
  v_quote_id uuid;
  v_quote_number text;
BEGIN
  SELECT i.invoice_number,
         i.invoice_kind,
         i.parent_invoice_id,
         i.service_order_id,
         i.closeout_id,
         i.quote_id,
         q.quote_number
  INTO v_invoice_number,
       v_invoice_kind,
       v_parent_invoice_id,
       v_service_order_id,
       v_closeout_id,
       v_quote_id,
       v_quote_number
  FROM public.invoices i
  LEFT JOIN public.quotes q
    ON q.id = i.quote_id AND q.company_id = i.company_id
  WHERE i.id = NEW.invoice_id AND i.company_id = NEW.company_id;

  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM private.enqueue_finance_outbox(
      NEW.company_id,
      'payment.refunded',
      'refund',
      NEW.id,
      'payment.refunded:' || NEW.id::text,
      jsonb_build_object(
        'company_id', NEW.company_id,
        'refund_id', NEW.id,
        'invoice_id', NEW.invoice_id,
        'invoice_number', v_invoice_number,
        'invoice_kind', COALESCE(v_invoice_kind, 'original'),
        'parent_invoice_id', v_parent_invoice_id,
        'service_order_id', v_service_order_id,
        'closeout_id', v_closeout_id,
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

-- Pending historical events get the same schema before PSCS One dispatch is enabled.
UPDATE public.finance_integration_outbox o
SET payload = o.payload || jsonb_build_object(
      'invoice_kind', COALESCE(i.invoice_kind, 'original'),
      'parent_invoice_id', i.parent_invoice_id,
      'service_order_id', i.service_order_id,
      'closeout_id', i.closeout_id
    ),
    updated_at = now()
FROM public.invoices i
WHERE o.invoice_id = i.id
  AND o.company_id = i.company_id
  AND o.status = 'pending'
  AND o.event_type IN ('invoice.created', 'invoice.paid', 'invoice.canceled', 'payment.completed', 'payment.failed', 'payment.refunded');

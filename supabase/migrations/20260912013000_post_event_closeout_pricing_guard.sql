-- Fail closed when an event has guest overage but the frozen accepted pricing
-- cannot produce a per-guest adjustment. Also prevent finalization against a
-- canceled original invoice.

CREATE OR REPLACE FUNCTION private.enforce_completed_order_before_financial_closeout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_order_status text;
  v_invoice_status text;
BEGIN
  IF NEW.status = 'ready_for_review'
     AND NEW.billable_guest_overage > 0
     AND NOT EXISTS (
       SELECT 1
       FROM public.event_financial_closeout_lines l
       WHERE l.company_id = NEW.company_id
         AND l.closeout_id = NEW.id
         AND l.line_type = 'guest_overage'
         AND l.amount > 0
     ) THEN
    RAISE EXCEPTION 'guest_overage_pricing_missing';
  END IF;

  IF NEW.status IN ('invoiced', 'closed_no_charge')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT status INTO v_order_status
    FROM public.service_orders
    WHERE id = NEW.service_order_id
      AND company_id = NEW.company_id;

    IF v_order_status IS DISTINCT FROM 'completed' THEN
      RAISE EXCEPTION 'service_order_must_be_completed';
    END IF;

    SELECT status INTO v_invoice_status
    FROM public.invoices
    WHERE id = NEW.original_invoice_id
      AND company_id = NEW.company_id;

    IF v_invoice_status = 'canceled' THEN
      RAISE EXCEPTION 'original_invoice_canceled';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_completed_order_before_financial_closeout()
  FROM PUBLIC, anon, authenticated;

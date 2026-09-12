-- Hardening for post-event closeout.
-- Final financial closeout is allowed only after the operational Service Order is completed.

CREATE UNIQUE INDEX IF NOT EXISTS service_orders_id_company_uidx
  ON public.service_orders(id, company_id);

CREATE UNIQUE INDEX IF NOT EXISTS event_financial_closeouts_id_company_uidx
  ON public.event_financial_closeouts(id, company_id);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_closeout_uidx
  ON public.invoices(closeout_id)
  WHERE closeout_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass
      AND conname = 'invoices_parent_company_fkey'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_parent_company_fkey
      FOREIGN KEY (parent_invoice_id, company_id)
      REFERENCES public.invoices(id, company_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass
      AND conname = 'invoices_service_order_company_fkey'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_service_order_company_fkey
      FOREIGN KEY (service_order_id, company_id)
      REFERENCES public.service_orders(id, company_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_financial_closeouts'::regclass
      AND conname = 'event_financial_closeouts_order_company_fkey'
  ) THEN
    ALTER TABLE public.event_financial_closeouts
      ADD CONSTRAINT event_financial_closeouts_order_company_fkey
      FOREIGN KEY (service_order_id, company_id)
      REFERENCES public.service_orders(id, company_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_financial_closeouts'::regclass
      AND conname = 'event_financial_closeouts_original_invoice_company_fkey'
  ) THEN
    ALTER TABLE public.event_financial_closeouts
      ADD CONSTRAINT event_financial_closeouts_original_invoice_company_fkey
      FOREIGN KEY (original_invoice_id, company_id)
      REFERENCES public.invoices(id, company_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_financial_closeouts'::regclass
      AND conname = 'event_financial_closeouts_supplemental_invoice_company_fkey'
  ) THEN
    ALTER TABLE public.event_financial_closeouts
      ADD CONSTRAINT event_financial_closeouts_supplemental_invoice_company_fkey
      FOREIGN KEY (supplemental_invoice_id, company_id)
      REFERENCES public.invoices(id, company_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_financial_closeout_lines'::regclass
      AND conname = 'event_financial_closeout_lines_closeout_company_fkey'
  ) THEN
    ALTER TABLE public.event_financial_closeout_lines
      ADD CONSTRAINT event_financial_closeout_lines_closeout_company_fkey
      FOREIGN KEY (closeout_id, company_id)
      REFERENCES public.event_financial_closeouts(id, company_id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.enforce_completed_order_before_financial_closeout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.status IN ('invoiced', 'closed_no_charge')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT status INTO v_status
    FROM public.service_orders
    WHERE id = NEW.service_order_id
      AND company_id = NEW.company_id;

    IF v_status IS DISTINCT FROM 'completed' THEN
      RAISE EXCEPTION 'service_order_must_be_completed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_financial_closeout_requires_completed_order
  ON public.event_financial_closeouts;
CREATE TRIGGER event_financial_closeout_requires_completed_order
BEFORE UPDATE OF status ON public.event_financial_closeouts
FOR EACH ROW
EXECUTE FUNCTION private.enforce_completed_order_before_financial_closeout();

GRANT SELECT ON public.event_financial_closeouts TO authenticated;
GRANT SELECT ON public.event_financial_closeout_lines TO authenticated;

REVOKE ALL ON FUNCTION private.enforce_completed_order_before_financial_closeout()
  FROM PUBLIC, anon, authenticated;

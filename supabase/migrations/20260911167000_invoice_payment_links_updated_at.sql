-- Cancellation/revocation workflows mutate payment links. Keep an explicit
-- modification timestamp so those state changes are auditable and both invoice
-- and Service Order cancellation transactions can update the row consistently.
ALTER TABLE public.invoice_payment_links
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.invoice_payment_links
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

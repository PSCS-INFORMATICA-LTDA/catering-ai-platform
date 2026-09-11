-- DEV finance performance hardening.
-- These indexes use the FK column order so parent updates/deletes and integrity
-- checks do not require scans as the receivables tables grow.

create index if not exists idx_invoices_quote_company
  on public.invoices (quote_id, company_id);

create index if not exists idx_invoice_payments_invoice_company
  on public.invoice_payments (invoice_id, company_id);

create index if not exists idx_invoice_payment_links_invoice_company
  on public.invoice_payment_links (invoice_id, company_id);

create index if not exists idx_payment_schedule_holds_invoice_company
  on public.payment_schedule_holds (invoice_id, company_id);

create index if not exists idx_payment_schedule_holds_quote_company
  on public.payment_schedule_holds (quote_id, company_id);

create index if not exists idx_payment_schedule_holds_event_company
  on public.payment_schedule_holds (event_id, company_id);

create index if not exists idx_payment_schedule_holds_link_company
  on public.payment_schedule_holds (payment_link_id, company_id)
  where payment_link_id is not null;

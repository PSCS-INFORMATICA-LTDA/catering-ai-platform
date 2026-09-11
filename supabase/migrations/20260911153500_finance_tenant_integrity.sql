-- DEV hardening: prevent a financial child row from pointing at a record
-- belonging to another company. The single-column FKs remain in place; these
-- composite constraints add tenant consistency at the database boundary.

alter table public.quotes
  add constraint quotes_id_company_key unique (id, company_id);

alter table public.events
  add constraint events_id_company_key unique (id, company_id);

alter table public.invoices
  add constraint invoices_id_company_key unique (id, company_id),
  add constraint invoices_quote_company_fkey
    foreign key (quote_id, company_id)
    references public.quotes (id, company_id)
    on delete restrict;

alter table public.invoice_payments
  add constraint invoice_payments_invoice_company_fkey
    foreign key (invoice_id, company_id)
    references public.invoices (id, company_id)
    on delete restrict;

alter table public.invoice_payment_links
  add constraint invoice_payment_links_id_company_key unique (id, company_id),
  add constraint invoice_payment_links_invoice_company_fkey
    foreign key (invoice_id, company_id)
    references public.invoices (id, company_id)
    on delete cascade;

alter table public.payment_schedule_holds
  add constraint payment_schedule_holds_invoice_company_fkey
    foreign key (invoice_id, company_id)
    references public.invoices (id, company_id)
    on delete cascade,
  add constraint payment_schedule_holds_quote_company_fkey
    foreign key (quote_id, company_id)
    references public.quotes (id, company_id)
    on delete restrict,
  add constraint payment_schedule_holds_event_company_fkey
    foreign key (event_id, company_id)
    references public.events (id, company_id)
    on delete restrict,
  add constraint payment_schedule_holds_link_company_fkey
    foreign key (payment_link_id, company_id)
    references public.invoice_payment_links (id, company_id)
    on delete set null;

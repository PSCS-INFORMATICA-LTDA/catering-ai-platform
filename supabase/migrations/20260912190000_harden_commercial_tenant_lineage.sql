-- DEV multi-company hardening for the commercial document chain.
-- Mirrors migration `harden_tenant_lineage_20260912` already applied to Supabase DEV.
-- Keeps tenant/customer data intact; this only enforces company lineage.

begin;

update public.quote_items qi
set company_id = q.company_id
from public.quotes q
where qi.quote_id = q.id
  and qi.company_id is null;

do $$
begin
  if exists (select 1 from public.quotes where company_id is null) then
    raise exception 'Cannot harden tenant lineage: quotes.company_id still contains NULL values';
  end if;

  if exists (select 1 from public.quote_items where company_id is null) then
    raise exception 'Cannot harden tenant lineage: quote_items.company_id still contains NULL values';
  end if;
end $$;

alter table public.quotes alter column company_id set not null;
alter table public.quote_items alter column company_id set not null;

-- Composite uniqueness lets descendants prove company lineage while preserving
-- the existing UUID primary key contract.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.quote_versions'::regclass
      and conname = 'quote_versions_id_company_key'
  ) then
    alter table public.quote_versions
      add constraint quote_versions_id_company_key unique (id, company_id);
  end if;
end $$;

-- Every commercial/financial child must stay in the same company as its parent.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.quote_items'::regclass
      and conname = 'quote_items_quote_company_fkey'
  ) then
    alter table public.quote_items
      add constraint quote_items_quote_company_fkey
      foreign key (quote_id, company_id)
      references public.quotes (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.quote_versions'::regclass
      and conname = 'quote_versions_quote_company_fkey'
  ) then
    alter table public.quote_versions
      add constraint quote_versions_quote_company_fkey
      foreign key (quote_id, company_id)
      references public.quotes (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_orders'::regclass
      and conname = 'service_orders_quote_company_fkey'
  ) then
    alter table public.service_orders
      add constraint service_orders_quote_company_fkey
      foreign key (quote_id, company_id)
      references public.quotes (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_orders'::regclass
      and conname = 'service_orders_quote_version_company_fkey'
  ) then
    alter table public.service_orders
      add constraint service_orders_quote_version_company_fkey
      foreign key (quote_version_id, company_id)
      references public.quote_versions (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_order_items'::regclass
      and conname = 'service_order_items_service_order_company_fkey'
  ) then
    alter table public.service_order_items
      add constraint service_order_items_service_order_company_fkey
      foreign key (company_id, service_order_id)
      references public.service_orders (company_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_financial_closeouts'::regclass
      and conname = 'event_closeouts_quote_company_fkey'
  ) then
    alter table public.event_financial_closeouts
      add constraint event_closeouts_quote_company_fkey
      foreign key (quote_id, company_id)
      references public.quotes (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and conname = 'invoices_closeout_company_fkey'
  ) then
    alter table public.invoices
      add constraint invoices_closeout_company_fkey
      foreign key (company_id, closeout_id)
      references public.event_financial_closeouts (company_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.quotes'::regclass
      and conname = 'quotes_accepted_version_company_fkey'
  ) then
    alter table public.quotes
      add constraint quotes_accepted_version_company_fkey
      foreign key (accepted_version_id, company_id)
      references public.quote_versions (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.quotes'::regclass
      and conname = 'quotes_converted_service_order_company_fkey'
  ) then
    alter table public.quotes
      add constraint quotes_converted_service_order_company_fkey
      foreign key (company_id, converted_service_order_id)
      references public.service_orders (company_id, id);
  end if;
end $$;

commit;

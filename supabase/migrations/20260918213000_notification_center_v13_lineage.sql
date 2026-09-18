-- Notification Center V1.3 — tenant lineage, least-privilege grants, queue eligibility.
-- Incremental on 20260917190000 + 20260918183219. Do not rewrite those files.
-- Never apply this file to Production.
-- No QA fixtures. No phone numbers. No customer PII.
-- Shared DEV apply remains blocked until Philippe/ChatGPT recorded approval.

-- Unique (company_id, id) so composite FKs can enforce same-tenant links.
create unique index if not exists notification_recipients_company_id_id_uidx
  on public.notification_recipients (company_id, id);

create unique index if not exists notification_events_company_id_id_uidx
  on public.notification_events (company_id, id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'company_id'
  ) then
    execute 'create unique index if not exists customers_company_id_id_uidx on public.customers (company_id, id)';
  end if;
end
$$;

-- Drop single-column tenant FKs we are replacing. Keep company_id → companies.
do $$
declare
  r record;
begin
  for r in
    select distinct con.conname, con.conrelid::regclass as tbl
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum = any (con.conkey)
    where con.contype = 'f'
      and (
        (
          con.conrelid = 'public.notification_subscriptions'::regclass
          and att.attname = 'recipient_id'
        )
        or (
          con.conrelid = 'public.notification_deliveries'::regclass
          and att.attname in ('event_id', 'recipient_id')
        )
        or (
          con.conrelid = 'public.notification_recipients'::regclass
          and att.attname = 'person_id'
        )
      )
  loop
    execute format('alter table %s drop constraint if exists %I', r.tbl, r.conname);
  end loop;
end
$$;

alter table public.notification_subscriptions
  add constraint notification_subscriptions_recipient_tenant_fkey
  foreign key (company_id, recipient_id)
  references public.notification_recipients (company_id, id)
  on delete cascade;

alter table public.notification_deliveries
  add constraint notification_deliveries_event_tenant_fkey
  foreign key (company_id, event_id)
  references public.notification_events (company_id, id)
  on delete cascade;

alter table public.notification_deliveries
  add constraint notification_deliveries_recipient_tenant_fkey
  foreign key (company_id, recipient_id)
  references public.notification_recipients (company_id, id);

do $$
begin
  if exists (
    select 1
    from pg_class
    where relname = 'customers_company_id_id_uidx'
      and relnamespace = 'public'::regnamespace
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'notification_recipients_person_tenant_fkey'
      and conrelid = 'public.notification_recipients'::regclass
  ) then
    -- RESTRICT (not SET NULL): composite SET NULL would also null company_id.
    alter table public.notification_recipients
      add constraint notification_recipients_person_tenant_fkey
      foreign key (company_id, person_id)
      references public.customers (company_id, id)
      on delete restrict;
  end if;
end
$$;

alter table public.notification_deliveries
  add column if not exists send_attempted_at timestamptz;

comment on column public.notification_deliveries.send_attempted_at is
  'Set immediately before the provider HTTP call. Distinguishes a lease from a possibly-accepted Meta send.';

alter table public.notification_deliveries
  add column if not exists queue_eligible boolean
  generated always as (
    status = 'pending'
    or (status = 'failed' and attempt_count < max_attempts)
  ) stored;

create index if not exists idx_notification_deliveries_queue_eligible
  on public.notification_deliveries (company_id, next_attempt_at, created_at)
  where queue_eligible;

comment on column public.notification_deliveries.queue_eligible is
  'Claimable rows only. Exhausted failed rows are excluded before LIMIT.';

-- Least privilege: revoke inherited/default authenticated rights, then grant only what the UI needs.
revoke all on table public.notification_event_definitions from public, anon, authenticated;
revoke all on table public.notification_recipients from public, anon, authenticated;
revoke all on table public.notification_subscriptions from public, anon, authenticated;
revoke all on table public.notification_events from public, anon, authenticated;
revoke all on table public.notification_deliveries from public, anon, authenticated;
revoke all on table public.company_notification_providers from public, anon, authenticated;
revoke all on table public.company_notification_settings from public, anon, authenticated;

grant select on table public.notification_event_definitions to authenticated;
grant select, insert, update, delete on table public.notification_recipients to authenticated;
grant select, insert, update, delete on table public.notification_subscriptions to authenticated;
grant select on table public.notification_events to authenticated;
grant select on table public.notification_deliveries to authenticated;
grant select on table public.company_notification_providers to authenticated;
grant select on table public.company_notification_settings to authenticated;

grant all on table public.notification_event_definitions to service_role;
grant all on table public.notification_recipients to service_role;
grant all on table public.notification_subscriptions to service_role;
grant all on table public.notification_events to service_role;
grant all on table public.notification_deliveries to service_role;
grant all on table public.company_notification_providers to service_role;
grant all on table public.company_notification_settings to service_role;

-- Events and deliveries are server-written. Clients may only read.
drop policy if exists notification_events_insert on public.notification_events;
drop policy if exists notification_events_update on public.notification_events;
drop policy if exists notification_events_delete on public.notification_events;
drop policy if exists notification_deliveries_insert on public.notification_deliveries;
drop policy if exists notification_deliveries_update on public.notification_deliveries;
drop policy if exists notification_deliveries_delete on public.notification_deliveries;

drop policy if exists notification_events_select on public.notification_events;
create policy notification_events_select
on public.notification_events
for select
to authenticated
using (
  (
    private.has_permission(company_id, 'notifications.view')
    or private.has_permission(company_id, 'notification_deliveries.view')
  )
  and (
    event_key not like 'payment.%'
    or private.has_permission(company_id, 'finance.invoices.view')
    or private.has_permission(company_id, 'orders.financial.view')
  )
);

drop policy if exists notification_deliveries_select on public.notification_deliveries;
create policy notification_deliveries_select
on public.notification_deliveries
for select
to authenticated
using (
  private.has_permission(company_id, 'notification_deliveries.view')
  or private.has_permission(company_id, 'notifications.view')
);

comment on constraint notification_subscriptions_recipient_tenant_fkey on public.notification_subscriptions is
  'Subscription company must match recipient company.';
comment on constraint notification_deliveries_event_tenant_fkey on public.notification_deliveries is
  'Delivery company must match event company.';
comment on constraint notification_deliveries_recipient_tenant_fkey on public.notification_deliveries is
  'Delivery company must match recipient company.';

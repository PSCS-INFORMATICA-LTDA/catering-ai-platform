-- Notification Center V1.2 — automatic WhatsApp worker, quote.accepted, consent.
-- Incremental on 20260917190000. Do not rewrite that file.
-- Never apply this file to Production.
-- No QA fixtures. No phone numbers. No customer PII.

insert into public.notification_event_definitions (
  event_key, entity_type, category_key, v1_enabled, label_pt, label_en, label_es
)
values
  (
    'quote.accepted',
    'quote',
    'quote',
    true,
    'Cotação aceita',
    'Quote accepted',
    'Presupuesto aceptado'
  )
on conflict (event_key) do update
set
  entity_type = excluded.entity_type,
  category_key = excluded.category_key,
  v1_enabled = excluded.v1_enabled,
  label_pt = excluded.label_pt,
  label_en = excluded.label_en,
  label_es = excluded.label_es;

alter table public.notification_recipients
  add column if not exists consent_status text not null default 'unknown',
  add column if not exists consent_source text,
  add column if not exists consent_at timestamptz,
  add column if not exists consent_note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notification_recipients_consent_check'
      and conrelid = 'public.notification_recipients'::regclass
  ) then
    alter table public.notification_recipients
      add constraint notification_recipients_consent_check
      check (consent_status in ('unknown', 'confirmed', 'denied'));
  end if;
end
$$;

alter table public.notification_deliveries
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists last_attempt_at timestamptz,
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by text,
  add column if not exists max_attempts integer not null default 5,
  add column if not exists result_state text;

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_status_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_status_check
  check (
    status in (
      'pending',
      'processing',
      'sent',
      'delivered',
      'read',
      'failed',
      'cancelled',
      'uncertain'
    )
  );

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_attempts_non_negative;

alter table public.notification_deliveries
  add constraint notification_deliveries_attempts_non_negative
  check (attempt_count >= 0 and max_attempts > 0);

create index if not exists idx_notification_deliveries_queue
  on public.notification_deliveries (company_id, status, next_attempt_at)
  where status in ('pending', 'failed', 'uncertain', 'processing');

create table if not exists public.company_notification_settings (
  company_id uuid primary key references public.companies(id),
  auto_dispatch_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_notification_settings enable row level security;

revoke all on table public.company_notification_settings from public, anon;
grant select on table public.company_notification_settings to authenticated;
grant all on table public.company_notification_settings to service_role;

drop policy if exists company_notification_settings_select on public.company_notification_settings;
create policy company_notification_settings_select
on public.company_notification_settings
for select
to authenticated
using (private.has_permission(company_id, 'notifications.view'));

comment on table public.company_notification_settings is
  'Per-company activation watermark. Automatic dispatch never backfills events before auto_dispatch_from.';
comment on column public.notification_recipients.consent_status is
  'unknown until an authorized operator records evidence. Do not invent consent.';
comment on column public.notification_deliveries.result_state is
  'Terminal send outcome: sent, failed, or uncertain after a Meta timeout.';

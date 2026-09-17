-- Notification Center V1 (DEV). Channel-neutral events + deliveries.
-- Quote persistence stays the primary transaction. Notifications are secondary.
-- Never apply this file to Production.

insert into public.permissions (
  permission_key,
  label_pt,
  label_en,
  label_es,
  category_key,
  active
)
values
  (
    'notifications.view',
    'Ver notificações',
    'View notifications',
    'Ver notificaciones',
    'notifications',
    true
  ),
  (
    'notifications.manage',
    'Configurar destinatários de notificação',
    'Manage notification recipients',
    'Configurar destinatarios de notificación',
    'notifications',
    true
  ),
  (
    'notification_deliveries.view',
    'Ver histórico de entregas',
    'View notification deliveries',
    'Ver historial de entregas',
    'notifications',
    true
  )
on conflict (permission_key) do update
set
  label_pt = excluded.label_pt,
  label_en = excluded.label_en,
  label_es = excluded.label_es,
  category_key = excluded.category_key,
  active = excluded.active;

insert into public.role_permissions (role_key, permission_key)
values
  ('owner', 'notifications.view'),
  ('owner', 'notifications.manage'),
  ('owner', 'notification_deliveries.view'),
  ('admin', 'notifications.view'),
  ('admin', 'notifications.manage'),
  ('admin', 'notification_deliveries.view'),
  ('manager', 'notifications.view'),
  ('manager', 'notification_deliveries.view'),
  ('sales', 'notifications.view'),
  ('sales', 'notification_deliveries.view'),
  ('finance', 'notifications.view'),
  ('finance', 'notification_deliveries.view')
on conflict do nothing;

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  event_key text not null,
  entity_type text not null,
  entity_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  actor_source text,
  created_at timestamptz not null default now(),
  constraint notification_events_key_check check (event_key in ('quote.created')),
  constraint notification_events_entity_check check (entity_type in ('quote'))
);

create unique index if not exists notification_events_idem_uidx
  on public.notification_events (company_id, event_key, entity_id);
create index if not exists idx_notification_events_company_created
  on public.notification_events (company_id, created_at desc);

create table if not exists public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  event_key text not null,
  channel text not null,
  display_name text,
  person_id uuid references public.customers(id) on delete set null,
  user_id uuid,
  phone_raw text,
  phone_e164 text,
  locale text not null default 'pt',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_recipients_event_check check (event_key in ('quote.created')),
  constraint notification_recipients_channel_check check (
    channel in ('whatsapp', 'web_push', 'email', 'in_app')
  ),
  constraint notification_recipients_locale_check check (locale in ('pt', 'en', 'es'))
);

create unique index if not exists notification_recipients_uniq
  on public.notification_recipients (
    company_id,
    event_key,
    channel,
    coalesce(phone_e164, ''),
    coalesce(person_id::text, ''),
    coalesce(user_id::text, '')
  );
create index if not exists idx_notification_recipients_company_event
  on public.notification_recipients (company_id, event_key, enabled);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  event_id uuid not null references public.notification_events(id) on delete cascade,
  recipient_id uuid not null references public.notification_recipients(id),
  channel text not null,
  provider text,
  template_key text,
  status text not null default 'pending',
  provider_message_id text,
  idempotency_key text not null,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  constraint notification_deliveries_channel_check check (
    channel in ('whatsapp', 'web_push', 'email', 'in_app')
  ),
  constraint notification_deliveries_status_check check (
    status in ('pending', 'processing', 'sent', 'delivered', 'read', 'failed', 'cancelled')
  ),
  constraint notification_deliveries_attempts_non_negative check (attempt_count >= 0)
);

create unique index if not exists notification_deliveries_idem_uidx
  on public.notification_deliveries (idempotency_key);
create unique index if not exists notification_deliveries_event_recipient_channel_uidx
  on public.notification_deliveries (company_id, event_id, recipient_id, channel);
create index if not exists idx_notification_deliveries_dispatch
  on public.notification_deliveries (status, created_at);
create index if not exists idx_notification_deliveries_company_created
  on public.notification_deliveries (company_id, created_at desc);

alter table public.notification_events enable row level security;
alter table public.notification_recipients enable row level security;
alter table public.notification_deliveries enable row level security;

revoke all on table public.notification_events from public, anon;
revoke all on table public.notification_recipients from public, anon;
revoke all on table public.notification_deliveries from public, anon;

grant select on table public.notification_events to authenticated;
grant select, insert, update, delete on table public.notification_recipients to authenticated;
grant select on table public.notification_deliveries to authenticated;

grant all on table public.notification_events to service_role;
grant all on table public.notification_recipients to service_role;
grant all on table public.notification_deliveries to service_role;

drop policy if exists notification_events_select on public.notification_events;
create policy notification_events_select
on public.notification_events
for select
to authenticated
using (
  private.has_permission(company_id, 'notifications.view')
  or private.has_permission(company_id, 'notification_deliveries.view')
);

drop policy if exists notification_recipients_select on public.notification_recipients;
create policy notification_recipients_select
on public.notification_recipients
for select
to authenticated
using (private.has_permission(company_id, 'notifications.view'));

drop policy if exists notification_recipients_insert on public.notification_recipients;
create policy notification_recipients_insert
on public.notification_recipients
for insert
to authenticated
with check (private.has_permission(company_id, 'notifications.manage'));

drop policy if exists notification_recipients_update on public.notification_recipients;
create policy notification_recipients_update
on public.notification_recipients
for update
to authenticated
using (private.has_permission(company_id, 'notifications.manage'))
with check (private.has_permission(company_id, 'notifications.manage'));

drop policy if exists notification_recipients_delete on public.notification_recipients;
create policy notification_recipients_delete
on public.notification_recipients
for delete
to authenticated
using (private.has_permission(company_id, 'notifications.manage'));

drop policy if exists notification_deliveries_select on public.notification_deliveries;
create policy notification_deliveries_select
on public.notification_deliveries
for select
to authenticated
using (
  private.has_permission(company_id, 'notification_deliveries.view')
  or private.has_permission(company_id, 'notifications.view')
);

comment on table public.notification_events is
  'Canonical business events for Notification Center. One row per company+event+entity.';
comment on table public.notification_recipients is
  'Company-scoped recipients and channel preferences. No hardcoded phone numbers.';
comment on table public.notification_deliveries is
  'Delivery/audit history. Unique per event+recipient+channel.';

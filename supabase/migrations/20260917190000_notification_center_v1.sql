-- Notification Center V1.1 (DEV). Extensible catalog. Recipients ≠ subscriptions.
-- Company-scoped WhatsApp providers. Quote + payment events.
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

create table if not exists public.notification_event_definitions (
  event_key text primary key,
  entity_type text not null,
  category_key text not null,
  v1_enabled boolean not null default false,
  label_pt text not null,
  label_en text not null,
  label_es text not null,
  created_at timestamptz not null default now()
);

insert into public.notification_event_definitions (
  event_key, entity_type, category_key, v1_enabled, label_pt, label_en, label_es
)
values
  ('quote.created', 'quote', 'quote', true, 'Nova cotação', 'New quote', 'Nuevo presupuesto'),
  ('payment.deposit_received', 'invoice_payment', 'payment', true, 'Depósito recebido', 'Deposit received', 'Depósito recibido'),
  ('payment.full_received', 'invoice_payment', 'payment', true, 'Pagamento total recebido', 'Full payment received', 'Pago total recibido'),
  ('payment.failed', 'invoice_payment', 'payment', false, 'Pagamento falhou', 'Payment failed', 'Pago fallido'),
  ('payment.refund_completed', 'invoice_payment', 'payment', false, 'Reembolso concluído', 'Refund completed', 'Reembolso completado'),
  ('order.confirmed', 'service_order', 'operations', false, 'OS confirmada', 'Order confirmed', 'OS confirmada'),
  ('event.today', 'event', 'operations', false, 'Evento hoje', 'Event today', 'Evento hoy'),
  ('event.tomorrow', 'event', 'operations', false, 'Evento amanhã', 'Event tomorrow', 'Evento mañana'),
  ('inventory.low_stock', 'inventory', 'inventory', false, 'Estoque baixo', 'Low stock', 'Stock bajo'),
  ('brasinha.action', 'brasinha', 'brasinha', false, 'Ação Brasinha', 'Brasinha action', 'Acción Brasinha'),
  ('brasinha.customer_reply', 'brasinha', 'brasinha', false, 'Resposta do cliente', 'Customer reply', 'Respuesta del cliente')
on conflict (event_key) do update
set
  entity_type = excluded.entity_type,
  category_key = excluded.category_key,
  v1_enabled = excluded.v1_enabled,
  label_pt = excluded.label_pt,
  label_en = excluded.label_en,
  label_es = excluded.label_es;

create table if not exists public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  display_name text,
  person_id uuid references public.customers(id) on delete set null,
  user_id uuid,
  channel text not null,
  phone_raw text,
  phone_e164 text,
  locale text not null default 'pt',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_recipients_channel_check check (
    channel in ('whatsapp', 'web_push', 'email', 'in_app')
  ),
  constraint notification_recipients_locale_check check (locale in ('pt', 'en', 'es'))
);

create unique index if not exists notification_recipients_uniq
  on public.notification_recipients (
    company_id,
    channel,
    coalesce(phone_e164, ''),
    coalesce(user_id::text, '')
  );
create index if not exists idx_notification_recipients_company
  on public.notification_recipients (company_id, enabled);

create table if not exists public.notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  recipient_id uuid not null references public.notification_recipients(id) on delete cascade,
  event_key text not null references public.notification_event_definitions(event_key),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists notification_subscriptions_uniq
  on public.notification_subscriptions (company_id, recipient_id, event_key);
create index if not exists idx_notification_subscriptions_event
  on public.notification_subscriptions (company_id, event_key, enabled);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  event_key text not null references public.notification_event_definitions(event_key),
  entity_type text not null,
  entity_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  actor_source text,
  created_at timestamptz not null default now()
);

create unique index if not exists notification_events_idem_uidx
  on public.notification_events (company_id, event_key, entity_id);
create index if not exists idx_notification_events_company_created
  on public.notification_events (company_id, created_at desc);

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
create index if not exists idx_notification_deliveries_provider_message
  on public.notification_deliveries (provider_message_id)
  where provider_message_id is not null;

create table if not exists public.company_notification_providers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  channel text not null,
  provider text not null,
  enabled boolean not null default false,
  environment text not null default 'dev',
  phone_number_id text,
  config jsonb not null default '{}'::jsonb,
  credential_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_notification_providers_channel_check check (
    channel in ('whatsapp', 'web_push', 'email', 'in_app')
  ),
  constraint company_notification_providers_provider_check check (
    provider in ('meta_cloud_api', 'pscs_shared', 'company_owned')
  ),
  constraint company_notification_providers_env_check check (
    environment in ('dev', 'sandbox', 'live')
  ),
  constraint company_notification_providers_unique unique (company_id, channel, provider)
);

create schema if not exists private;

create table if not exists private.notification_provider_secrets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  channel text not null,
  provider text not null,
  ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_provider_secrets_unique unique (company_id, channel, provider)
);

revoke all on table private.notification_provider_secrets from public, anon, authenticated;
grant all on table private.notification_provider_secrets to service_role;

create or replace function public.store_company_notification_secret(
  p_company_id uuid,
  p_channel text,
  p_provider text,
  p_ciphertext text
)
returns uuid
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_id uuid;
begin
  if p_company_id is null or p_ciphertext is null or length(p_ciphertext) < 8 then
    raise exception 'invalid_secret_payload';
  end if;
  insert into private.notification_provider_secrets (company_id, channel, provider, ciphertext)
  values (p_company_id, p_channel, p_provider, p_ciphertext)
  on conflict (company_id, channel, provider)
  do update set ciphertext = excluded.ciphertext, updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.read_company_notification_secret(
  p_company_id uuid,
  p_channel text,
  p_provider text
)
returns text
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_cipher text;
begin
  select ciphertext
    into v_cipher
  from private.notification_provider_secrets
  where company_id = p_company_id
    and channel = p_channel
    and provider = p_provider;
  return v_cipher;
end;
$$;

revoke all on function public.store_company_notification_secret(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.read_company_notification_secret(uuid, text, text) from public, anon, authenticated;
grant execute on function public.store_company_notification_secret(uuid, text, text, text) to service_role;
grant execute on function public.read_company_notification_secret(uuid, text, text) to service_role;

alter table public.notification_event_definitions enable row level security;
alter table public.notification_recipients enable row level security;
alter table public.notification_subscriptions enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.company_notification_providers enable row level security;

revoke all on table public.notification_event_definitions from public, anon;
revoke all on table public.notification_recipients from public, anon;
revoke all on table public.notification_subscriptions from public, anon;
revoke all on table public.notification_events from public, anon;
revoke all on table public.notification_deliveries from public, anon;
revoke all on table public.company_notification_providers from public, anon;

grant select on table public.notification_event_definitions to authenticated;
grant select, insert, update, delete on table public.notification_recipients to authenticated;
grant select, insert, update, delete on table public.notification_subscriptions to authenticated;
grant select on table public.notification_events to authenticated;
grant select on table public.notification_deliveries to authenticated;
grant select on table public.company_notification_providers to authenticated;

grant all on table public.notification_event_definitions to service_role;
grant all on table public.notification_recipients to service_role;
grant all on table public.notification_subscriptions to service_role;
grant all on table public.notification_events to service_role;
grant all on table public.notification_deliveries to service_role;
grant all on table public.company_notification_providers to service_role;

drop policy if exists notification_event_definitions_select on public.notification_event_definitions;
create policy notification_event_definitions_select
on public.notification_event_definitions
for select
to authenticated
using (true);

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

drop policy if exists notification_subscriptions_select on public.notification_subscriptions;
create policy notification_subscriptions_select
on public.notification_subscriptions
for select
to authenticated
using (private.has_permission(company_id, 'notifications.view'));

drop policy if exists notification_subscriptions_write on public.notification_subscriptions;
create policy notification_subscriptions_write
on public.notification_subscriptions
for all
to authenticated
using (private.has_permission(company_id, 'notifications.manage'))
with check (private.has_permission(company_id, 'notifications.manage'));

drop policy if exists notification_events_select on public.notification_events;
create policy notification_events_select
on public.notification_events
for select
to authenticated
using (
  private.has_permission(company_id, 'notifications.view')
  or private.has_permission(company_id, 'notification_deliveries.view')
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

drop policy if exists company_notification_providers_select on public.company_notification_providers;
create policy company_notification_providers_select
on public.company_notification_providers
for select
to authenticated
using (private.has_permission(company_id, 'notifications.view'));

comment on table public.notification_event_definitions is
  'Extensible event catalog. V1.1 enables quote.created and payment received events.';
comment on table public.notification_recipients is
  'Company-scoped recipients. One row per person/channel, not per event.';
comment on table public.notification_subscriptions is
  'Recipient subscriptions to catalog events.';
comment on table public.notification_events is
  'Canonical business events. Unique per company+event_key+entity_id.';
comment on table public.notification_deliveries is
  'Delivery/audit history. Unique per event+recipient+channel.';
comment on table public.company_notification_providers is
  'Non-secret company channel configuration. Secrets stay in private.';
comment on table private.notification_provider_secrets is
  'Server-only notification provider secrets. Never granted to anon/authenticated.';

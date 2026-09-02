-- PROPOSED only. Not applied in Brasinha V0.
-- Additive, multi-company, RLS. Apply later after Product Owner review.

create table if not exists public.brasinha_conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  channel text not null check (channel in ('dev_simulator', 'whatsapp', 'web', 'voice')),
  external_contact_ref text,
  language text not null default 'pt' check (language in ('pt', 'en', 'es')),
  status text not null default 'open' check (status in ('open', 'closed')),
  handoff_status text not null default 'AI_ACTIVE'
    check (handoff_status in ('AI_ACTIVE', 'HUMAN_REVIEW_REQUIRED', 'HUMAN_ACTIVE', 'CLOSED')),
  handoff_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brasinha_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.brasinha_conversations(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  channel text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  role text not null check (role in ('customer', 'assistant', 'human', 'system')),
  language text not null check (language in ('pt', 'en', 'es')),
  content text not null,
  traces jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists brasinha_conversations_company_idx
  on public.brasinha_conversations (company_id, updated_at desc);
create index if not exists brasinha_messages_company_idx
  on public.brasinha_messages (company_id, conversation_id, created_at);

alter table public.brasinha_conversations enable row level security;
alter table public.brasinha_messages enable row level security;

drop policy if exists brasinha_conversations_company_member on public.brasinha_conversations;
create policy brasinha_conversations_company_member
  on public.brasinha_conversations
  for all
  using (private.is_company_member(company_id))
  with check (private.is_company_member(company_id));

drop policy if exists brasinha_messages_company_member on public.brasinha_messages;
create policy brasinha_messages_company_member
  on public.brasinha_messages
  for all
  using (private.is_company_member(company_id))
  with check (private.is_company_member(company_id));

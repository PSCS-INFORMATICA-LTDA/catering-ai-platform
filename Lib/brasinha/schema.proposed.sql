-- Design note only. The real additive migration is:
--   supabase/migrations/20260903030000_brasinha_conversations_v1a.sql
-- Do not apply this file blindly. Prefer the versioned migration.
-- Messages reference conversations by (id, company_id) so company_id cannot drift.

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
  updated_at timestamptz not null default now(),
  constraint brasinha_conversations_id_company_key unique (id, company_id)
);

create table if not exists public.brasinha_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  company_id uuid not null references public.companies(id),
  channel text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  role text not null check (role in ('customer', 'assistant', 'human', 'system')),
  language text not null check (language in ('pt', 'en', 'es')),
  content text not null,
  traces jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint brasinha_messages_conversation_company_fkey
    foreign key (conversation_id, company_id)
    references public.brasinha_conversations (id, company_id)
);

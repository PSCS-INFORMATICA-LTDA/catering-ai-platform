-- Brasinha V1A conversation persistence.
-- Additive only. DEV target: yasprgtlqclwsjcshtls
-- No DROP. No destructive rename. Does not touch quotes, invoices, or payments.

CREATE TABLE IF NOT EXISTS public.brasinha_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  channel text NOT NULL CHECK (channel IN ('dev_simulator', 'whatsapp', 'web', 'voice')),
  external_contact_ref text,
  language text NOT NULL DEFAULT 'pt' CHECK (language IN ('pt', 'en', 'es')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  handoff_status text NOT NULL DEFAULT 'AI_ACTIVE'
    CHECK (handoff_status IN ('AI_ACTIVE', 'HUMAN_REVIEW_REQUIRED', 'HUMAN_ACTIVE', 'CLOSED')),
  handoff_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brasinha_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.brasinha_conversations(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  channel text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  role text NOT NULL CHECK (role IN ('customer', 'assistant', 'human', 'system')),
  language text NOT NULL CHECK (language IN ('pt', 'en', 'es')),
  content text NOT NULL,
  traces jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brasinha_conversations_company_idx
  ON public.brasinha_conversations (company_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS brasinha_messages_company_idx
  ON public.brasinha_messages (company_id, conversation_id, created_at);

ALTER TABLE public.brasinha_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brasinha_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.brasinha_conversations FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.brasinha_messages FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE ON TABLE public.brasinha_conversations TO authenticated;
GRANT SELECT, INSERT ON TABLE public.brasinha_messages TO authenticated;
GRANT ALL ON TABLE public.brasinha_conversations TO service_role;
GRANT ALL ON TABLE public.brasinha_messages TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brasinha_conversations'
      AND policyname = 'brasinha_conversations_select_member'
  ) THEN
    CREATE POLICY brasinha_conversations_select_member
      ON public.brasinha_conversations
      FOR SELECT
      TO authenticated
      USING (private.is_company_member(company_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brasinha_conversations'
      AND policyname = 'brasinha_conversations_insert_member'
  ) THEN
    CREATE POLICY brasinha_conversations_insert_member
      ON public.brasinha_conversations
      FOR INSERT
      TO authenticated
      WITH CHECK (private.is_company_member(company_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brasinha_conversations'
      AND policyname = 'brasinha_conversations_update_member'
  ) THEN
    CREATE POLICY brasinha_conversations_update_member
      ON public.brasinha_conversations
      FOR UPDATE
      TO authenticated
      USING (private.is_company_member(company_id))
      WITH CHECK (private.is_company_member(company_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brasinha_messages'
      AND policyname = 'brasinha_messages_select_member'
  ) THEN
    CREATE POLICY brasinha_messages_select_member
      ON public.brasinha_messages
      FOR SELECT
      TO authenticated
      USING (private.is_company_member(company_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brasinha_messages'
      AND policyname = 'brasinha_messages_insert_member'
  ) THEN
    CREATE POLICY brasinha_messages_insert_member
      ON public.brasinha_messages
      FOR INSERT
      TO authenticated
      WITH CHECK (private.is_company_member(company_id));
  END IF;
END
$$;

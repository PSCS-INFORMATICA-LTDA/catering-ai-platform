-- Brasinha V1C structured quote intake draft.
-- Additive only. DEV target: yasprgtlqclwsjcshtls
-- No DROP. Does not touch quotes, events, customers, invoices, or payments.

ALTER TABLE public.brasinha_conversations
  ADD COLUMN IF NOT EXISTS intake_draft jsonb NOT NULL DEFAULT '{}'::jsonb;

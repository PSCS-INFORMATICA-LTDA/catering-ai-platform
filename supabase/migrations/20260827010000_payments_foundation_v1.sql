-- =============================================================================
-- Payments Foundation V1 — invoices, payment links, PayPal sandbox adapter
-- Ambiente-alvo: Supabase DEV ONLY (yasprgtlqclwsjcshtls)
-- NÃO aplicar em Production.
--
-- Reuses quote snapshots, document_sequences, and company-scoped RLS.
-- Does NOT store PayPal client secrets. Does NOT move real money.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Document numbers: INV-YYYY-000001
-- ---------------------------------------------------------------------------
ALTER TABLE public.document_sequences
  DROP CONSTRAINT IF EXISTS document_sequences_document_type_check;

ALTER TABLE public.document_sequences
  ADD CONSTRAINT document_sequences_document_type_check
  CHECK (document_type IN ('quote', 'order', 'service_order', 'customer', 'invoice'));

CREATE OR REPLACE FUNCTION public.resolve_document_prefix(p_document_type text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_document_type
    WHEN 'quote' THEN RETURN 'Q';
    WHEN 'order' THEN RETURN 'O';
    WHEN 'service_order' THEN RETURN 'SO';
    WHEN 'customer' THEN RETURN 'AB';
    WHEN 'invoice' THEN RETURN 'INV';
    ELSE
      RAISE EXCEPTION
        'document_type inválido: % (use quote, order, service_order, customer ou invoice)',
        p_document_type;
  END CASE;
END;
$$;

COMMENT ON FUNCTION public.get_next_document_number(uuid, text) IS
  'Allocates next document number atomically. Types: quote, order, service_order, customer, invoice.';

-- ---------------------------------------------------------------------------
-- Per-company payment provider config (no secrets)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_payment_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  provider text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  enabled boolean NOT NULL DEFAULT false,
  public_client_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_payment_providers_provider_check
    CHECK (provider IN ('paypal', 'zelle', 'bank_transfer')),
  CONSTRAINT company_payment_providers_env_check
    CHECK (environment IN ('sandbox', 'live')),
  CONSTRAINT company_payment_providers_unique
    UNIQUE (company_id, provider)
);

COMMENT ON TABLE public.company_payment_providers IS
  'Tenant payment eligibility. Secrets stay in the server env/secret store — never in this table.';

COMMENT ON COLUMN public.company_payment_providers.public_client_id IS
  'Optional public PayPal client id for the JS SDK. Never a client secret.';

CREATE INDEX IF NOT EXISTS idx_company_payment_providers_company
  ON public.company_payment_providers (company_id, enabled);

-- ---------------------------------------------------------------------------
-- Commercial invoices (internal source of truth)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  quote_id uuid NOT NULL REFERENCES public.quotes (id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  status text NOT NULL DEFAULT 'awaiting_deposit',
  locale text NOT NULL DEFAULT 'pt',
  currency_code text NOT NULL DEFAULT 'USD',
  snapshot jsonb NOT NULL,
  subtotal numeric(12,2) NOT NULL,
  total numeric(12,2) NOT NULL,
  deposit_amount numeric(12,2) NOT NULL,
  balance_amount numeric(12,2) NOT NULL,
  paid_total numeric(12,2) NOT NULL DEFAULT 0,
  online_payment_fee numeric(12,2) NOT NULL DEFAULT 0,
  created_by uuid,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_status_check
    CHECK (status IN (
      'draft',
      'ready',
      'awaiting_deposit',
      'partially_paid',
      'paid',
      'canceled'
    )),
  CONSTRAINT invoices_locale_check
    CHECK (locale IN ('pt', 'en', 'es')),
  CONSTRAINT invoices_online_fee_zero_v1
    CHECK (online_payment_fee = 0),
  CONSTRAINT invoices_amounts_non_negative
    CHECK (
      subtotal >= 0
      AND total >= 0
      AND deposit_amount >= 0
      AND balance_amount >= 0
      AND paid_total >= 0
    )
);

COMMENT ON TABLE public.invoices IS
  'Commercial invoice frozen from an approved quote snapshot. Not a Brazilian fiscal document.';

COMMENT ON COLUMN public.invoices.snapshot IS
  'Immutable commercial snapshot at invoice generation. Never silently recalculated from the live catalog.';

COMMENT ON COLUMN public.invoices.online_payment_fee IS
  'Reserved. CDL has not approved an online payment surcharge. Must remain 0.';

CREATE UNIQUE INDEX IF NOT EXISTS invoices_company_number_uidx
  ON public.invoices (company_id, invoice_number);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_company_quote_active_uidx
  ON public.invoices (company_id, quote_id)
  WHERE status IS DISTINCT FROM 'canceled';

CREATE INDEX IF NOT EXISTS idx_invoices_company_status
  ON public.invoices (company_id, status);

-- ---------------------------------------------------------------------------
-- Secure public payment links (token hash only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  purpose text NOT NULL DEFAULT 'deposit',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_payment_links_purpose_check
    CHECK (purpose IN ('deposit', 'balance', 'full'))
);

COMMENT ON TABLE public.invoice_payment_links IS
  'High-entropy public payment tokens stored only as SHA-256 hashes. Raw tokens never persist.';

CREATE UNIQUE INDEX IF NOT EXISTS invoice_payment_links_token_hash_uidx
  ON public.invoice_payment_links (token_hash);

CREATE INDEX IF NOT EXISTS idx_invoice_payment_links_invoice
  ON public.invoice_payment_links (company_id, invoice_id);

-- ---------------------------------------------------------------------------
-- Payment attempts / captures
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE RESTRICT,
  provider text NOT NULL,
  purpose text NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency_code text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'created',
  provider_order_id text,
  provider_capture_id text,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  captured_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_payments_provider_check
    CHECK (provider IN ('paypal', 'zelle', 'bank_transfer')),
  CONSTRAINT invoice_payments_purpose_check
    CHECK (purpose IN ('deposit', 'balance', 'full')),
  CONSTRAINT invoice_payments_status_check
    CHECK (status IN (
      'created',
      'approved',
      'completed',
      'failed',
      'canceled'
    )),
  CONSTRAINT invoice_payments_amount_positive
    CHECK (amount > 0)
);

COMMENT ON TABLE public.invoice_payments IS
  'Server-side payment attempts. Amount is always taken from the invoice, never from the browser.';

CREATE UNIQUE INDEX IF NOT EXISTS invoice_payments_idempotency_uidx
  ON public.invoice_payments (company_id, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_payments_provider_order_uidx
  ON public.invoice_payments (company_id, provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invoice_payments_provider_capture_uidx
  ON public.invoice_payments (company_id, provider, provider_capture_id)
  WHERE provider_capture_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice
  ON public.invoice_payments (company_id, invoice_id, status);

-- ---------------------------------------------------------------------------
-- RLS — members read; admins write invoices/links; payments writes stay service_role
-- ---------------------------------------------------------------------------
ALTER TABLE public.company_payment_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.company_payment_providers FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.invoices FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.invoice_payment_links FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.invoice_payments FROM PUBLIC, anon;

GRANT SELECT ON TABLE public.company_payment_providers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.company_payment_providers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.invoice_payment_links TO authenticated;
GRANT SELECT ON TABLE public.invoice_payments TO authenticated;

GRANT ALL ON TABLE public.company_payment_providers TO service_role;
GRANT ALL ON TABLE public.invoices TO service_role;
GRANT ALL ON TABLE public.invoice_payment_links TO service_role;
GRANT ALL ON TABLE public.invoice_payments TO service_role;

DROP POLICY IF EXISTS company_payment_providers_select_member
  ON public.company_payment_providers;
CREATE POLICY company_payment_providers_select_member
  ON public.company_payment_providers
  FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS company_payment_providers_write_admin
  ON public.company_payment_providers;
CREATE POLICY company_payment_providers_write_admin
  ON public.company_payment_providers
  FOR ALL TO authenticated
  USING (private.has_company_role(company_id, ARRAY['admin', 'owner']::text[]))
  WITH CHECK (private.has_company_role(company_id, ARRAY['admin', 'owner']::text[]));

DROP POLICY IF EXISTS invoices_select_member
  ON public.invoices;
CREATE POLICY invoices_select_member
  ON public.invoices
  FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS invoices_write_admin
  ON public.invoices;
CREATE POLICY invoices_write_admin
  ON public.invoices
  FOR ALL TO authenticated
  USING (private.has_company_role(company_id, ARRAY['admin', 'owner']::text[]))
  WITH CHECK (private.has_company_role(company_id, ARRAY['admin', 'owner']::text[]));

DROP POLICY IF EXISTS invoice_payment_links_select_member
  ON public.invoice_payment_links;
CREATE POLICY invoice_payment_links_select_member
  ON public.invoice_payment_links
  FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

DROP POLICY IF EXISTS invoice_payment_links_write_admin
  ON public.invoice_payment_links;
CREATE POLICY invoice_payment_links_write_admin
  ON public.invoice_payment_links
  FOR ALL TO authenticated
  USING (private.has_company_role(company_id, ARRAY['admin', 'owner']::text[]))
  WITH CHECK (private.has_company_role(company_id, ARRAY['admin', 'owner']::text[]));

DROP POLICY IF EXISTS invoice_payments_select_member
  ON public.invoice_payments;
CREATE POLICY invoice_payments_select_member
  ON public.invoice_payments
  FOR SELECT TO authenticated
  USING (private.is_company_member(company_id));

-- No authenticated INSERT/UPDATE on invoice_payments — capture is server-side only.

INSERT INTO public.company_payment_providers (
  company_id, provider, environment, enabled, public_client_id
)
SELECT c.id, method.provider, 'sandbox', method.enabled, NULL
FROM public.companies AS c
CROSS JOIN (
  VALUES
    ('paypal', false),
    ('zelle', true),
    ('bank_transfer', true)
) AS method(provider, enabled)
WHERE lower(c.slug) = 'cdl'
ON CONFLICT (company_id, provider) DO UPDATE
SET
  environment = EXCLUDED.environment,
  enabled = public.company_payment_providers.enabled,
  updated_at = now();

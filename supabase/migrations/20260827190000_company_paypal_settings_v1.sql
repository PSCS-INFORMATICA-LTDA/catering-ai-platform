-- Company-scoped PayPal settings (DEV). No plaintext secrets. No live money.
-- Reuses company_payment_providers. Does not create a second company master.
-- Supabase Vault is not exposed as public.vault.secrets on DEV; secrets live
-- in private.payment_provider_secrets and are wrapped by the app server.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS private;

ALTER TABLE public.company_payment_providers
  ADD COLUMN IF NOT EXISTS webhook_route_key text;

CREATE UNIQUE INDEX IF NOT EXISTS company_payment_providers_webhook_route_uidx
  ON public.company_payment_providers (webhook_route_key)
  WHERE webhook_route_key IS NOT NULL;

COMMENT ON COLUMN public.company_payment_providers.webhook_route_key IS
  'High-entropy webhook resolver. Not an authentication secret.';

CREATE TABLE IF NOT EXISTS private.payment_provider_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  provider text NOT NULL,
  ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_provider_secrets_provider_check
    CHECK (provider IN ('paypal')),
  CONSTRAINT payment_provider_secrets_unique
    UNIQUE (company_id, provider)
);

REVOKE ALL ON TABLE private.payment_provider_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.payment_provider_secrets TO service_role;

COMMENT ON TABLE private.payment_provider_secrets IS
  'Server-only PayPal client secrets. Never granted to anon/authenticated.';

CREATE OR REPLACE FUNCTION public.store_company_paypal_secret(
  p_company_id uuid,
  p_ciphertext text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_company_id IS NULL OR p_ciphertext IS NULL OR length(p_ciphertext) < 8 THEN
    RAISE EXCEPTION 'invalid_secret_payload';
  END IF;
  INSERT INTO private.payment_provider_secrets (company_id, provider, ciphertext)
  VALUES (p_company_id, 'paypal', p_ciphertext)
  ON CONFLICT (company_id, provider)
  DO UPDATE SET ciphertext = EXCLUDED.ciphertext, updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.read_company_paypal_secret(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_cipher text;
BEGIN
  SELECT ciphertext
    INTO v_cipher
  FROM private.payment_provider_secrets
  WHERE company_id = p_company_id
    AND provider = 'paypal';
  RETURN v_cipher;
END;
$$;

REVOKE ALL ON FUNCTION public.store_company_paypal_secret(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_company_paypal_secret(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_company_paypal_secret(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_company_paypal_secret(uuid) TO service_role;

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
ON CONFLICT (company_id, provider) DO NOTHING;

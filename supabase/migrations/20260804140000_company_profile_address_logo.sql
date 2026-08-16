-- =============================================================================
-- Cadastro Empresa (endereço + logo) — espelho Logistics /configuracoes/empresa
-- Ambiente-alvo: Supabase DEV ONLY (yasprgtlqclwsjcshtls)
-- NÃO aplicar em Production.
-- =============================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS document text,
  ADD COLUMN IF NOT EXISTS state_registration text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS brand_logo_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS company_logos_public_read ON storage.objects;
CREATE POLICY company_logos_public_read
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS company_logos_auth_write ON storage.objects;
CREATE POLICY company_logos_auth_write
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND private.is_company_member((storage.foldername(name))[1]::uuid)
  )
  WITH CHECK (
    bucket_id = 'company-logos'
    AND private.is_company_member((storage.foldername(name))[1]::uuid)
  );

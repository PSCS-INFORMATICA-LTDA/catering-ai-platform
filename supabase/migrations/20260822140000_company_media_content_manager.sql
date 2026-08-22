-- =============================================================================
-- Media / Content Manager — multiempresa (Fase A)
-- Ambiente-alvo: Supabase DEV ONLY (yasprgtlqclwsjcshtls)
-- NÃO aplicar em Production (eapwtirhevxrqinytans).
--
-- Evolui media_assets existente. Não cria tabela por cliente.
-- Não migra grill photos (entity_type = event).
-- RLS de membership permanece. Permissão funcional media.* é server-side.
-- =============================================================================

-- 1) Colunas aditivas em media_assets
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS placement text,
  ADD COLUMN IF NOT EXISTS variant text DEFAULT 'original',
  ADD COLUMN IF NOT EXISTS focal_x numeric,
  ADD COLUMN IF NOT EXISTS focal_y numeric,
  ADD COLUMN IF NOT EXISTS alt_pt text,
  ADD COLUMN IF NOT EXISTS alt_en text,
  ADD COLUMN IF NOT EXISTS alt_es text,
  ADD COLUMN IF NOT EXISTS title_pt text,
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_es text,
  ADD COLUMN IF NOT EXISTS subtitle_pt text,
  ADD COLUMN IF NOT EXISTS subtitle_en text,
  ADD COLUMN IF NOT EXISTS subtitle_es text,
  ADD COLUMN IF NOT EXISTS overlay_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS overlay_position text,
  ADD COLUMN IF NOT EXISTS poster_url text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

-- ADD COLUMN status DEFAULT 'active' stamps existing rows. Sync from active.
UPDATE public.media_assets
SET status = CASE WHEN active IS FALSE THEN 'inactive' ELSE COALESCE(status, 'active') END
WHERE status IS NULL
   OR (active IS FALSE AND status IS DISTINCT FROM 'inactive');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'media_assets_placement_check'
      AND conrelid = 'public.media_assets'::regclass
  ) THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT media_assets_placement_check
      CHECK (
        placement IS NULL
        OR placement = ANY (ARRAY['hero'::text, 'how_it_works'::text, 'video'::text])
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'media_assets_variant_check'
      AND conrelid = 'public.media_assets'::regclass
  ) THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT media_assets_variant_check
      CHECK (
        variant IS NULL
        OR variant = ANY (ARRAY['original'::text, 'mobile'::text, 'tablet'::text, 'desktop'::text])
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'media_assets_status_check'
      AND conrelid = 'public.media_assets'::regclass
  ) THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT media_assets_status_check
      CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'inactive'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'media_assets_focal_check'
      AND conrelid = 'public.media_assets'::regclass
  ) THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT media_assets_focal_check
      CHECK (
        (focal_x IS NULL OR (focal_x >= 0 AND focal_x <= 1))
        AND (focal_y IS NULL OR (focal_y >= 0 AND focal_y <= 1))
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_media_assets_company_placement
  ON public.media_assets (company_id, placement, status, display_order)
  WHERE placement IS NOT NULL;

-- 2) Permissions — menor privilégio (não é finance / customers / inventory)
INSERT INTO public.permissions (permission_key, label_pt, label_en, label_es, category_key)
VALUES
  (
    'media.view',
    'Ver mídia e conteúdo',
    'View media and content',
    'Ver medios y contenido',
    'media'
  ),
  (
    'media.manage',
    'Gerenciar mídia e conteúdo',
    'Manage media and content',
    'Gestionar medios y contenido',
    'media'
  )
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r.role_key, p.permission_key
FROM (VALUES ('owner'), ('admin'), ('manager')) AS r(role_key)
CROSS JOIN (VALUES ('media.view'), ('media.manage')) AS p(permission_key)
ON CONFLICT DO NOTHING;

-- 3) Bucket genérico company-scoped (não cria um bucket por placement)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-public-media',
  'company-public-media',
  true,
  41943040,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS company_public_media_public_read ON storage.objects;
CREATE POLICY company_public_media_public_read
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'company-public-media');

DROP POLICY IF EXISTS company_public_media_auth_write ON storage.objects;
CREATE POLICY company_public_media_auth_write
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'company-public-media'
    AND private.is_company_member((storage.foldername(name))[1]::uuid)
  )
  WITH CHECK (
    bucket_id = 'company-public-media'
    AND private.is_company_member((storage.foldername(name))[1]::uuid)
  );

-- 4) SELECT membership remains here. INSERT/UPDATE/DELETE policies are
--    tightened to media.manage / media.delete in 20260822190000.
REVOKE ALL ON TABLE public.media_assets FROM anon;

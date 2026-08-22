-- DEV ONLY target: yasprgtlqclwsjcshtls
-- NÃO aplicar em Production (eapwtirhevxrqinytans).
--
-- editor_meta jsonb is the canonical store for focus / overlay / editor config.
-- label_pt / label_en / label_es are multilingual content only.
-- Never persist technical metadata in label_*.

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS editor_meta jsonb;

COMMENT ON COLUMN public.media_assets.editor_meta IS
  'Canonical editor config (per-device focus, overlay, titles). label_pt/en/es stay multilingual content only.';
COMMENT ON COLUMN public.media_assets.label_pt IS
  'Portuguese content label. Never store technical metadata.';
COMMENT ON COLUMN public.media_assets.label_en IS
  'English content label. Never store technical metadata.';
COMMENT ON COLUMN public.media_assets.label_es IS
  'Spanish content label. Never store technical metadata.';

-- Recover leftover compact tokens if any were persisted in label_es.
-- Format: __m1|<flags>|<packed>|<label content>
-- Flags: [a|m][overlay 0|1][decided 0|1]...
UPDATE public.media_assets
SET
  editor_meta = jsonb_strip_nulls(
    jsonb_build_object(
      'autoFocus', 'HEURISTIC',
      'focusMode', CASE
        WHEN substring(split_part(label_es, '|', 2) FROM 1 FOR 1) = 'm' THEN 'manual'
        ELSE 'auto'
      END,
      'overlayEnabled', substring(split_part(label_es, '|', 2) FROM 2 FOR 1) = '1',
      'overlayDecided', substring(split_part(label_es, '|', 2) FROM 3 FOR 1) = '1',
      'overlayPosition', 'top-left',
      'title_pt', COALESCE(title_pt, ''),
      'title_en', COALESCE(title_en, ''),
      'title_es', COALESCE(
        NULLIF(array_to_string((string_to_array(label_es, '|'))[4:], '|'), ''),
        ''
      ),
      'subtitle_pt', COALESCE(subtitle_pt, ''),
      'subtitle_en', COALESCE(subtitle_en, ''),
      'subtitle_es', COALESCE(subtitle_es, ''),
      'suggested', jsonb_build_object(
        'mobile', jsonb_build_object('x', 0.5, 'y', 0.5),
        'tablet', jsonb_build_object('x', 0.5, 'y', 0.5),
        'desktop', jsonb_build_object('x', 0.5, 'y', 0.5)
      ),
      'applied', jsonb_build_object(
        'mobile', jsonb_build_object('x', 0.5, 'y', 0.5),
        'tablet', jsonb_build_object('x', 0.5, 'y', 0.5),
        'desktop', jsonb_build_object('x', 0.5, 'y', 0.5)
      )
    )
  ),
  label_es = NULLIF(array_to_string((string_to_array(label_es, '|'))[4:], '|'), '')
WHERE label_es LIKE '__m1|%';

-- Permission helper used by media RLS. SECURITY DEFINER avoids RLS recursion.
CREATE OR REPLACE FUNCTION private.has_permission(
  target_company_id uuid,
  required_permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    target_company_id IS NOT NULL
    AND required_permission IS NOT NULL
    AND (
      private.is_platform_master()
      OR EXISTS (
        SELECT 1
        FROM public.company_memberships AS m
        JOIN public.role_permissions AS rp
          ON rp.role_key = m.role
         AND rp.permission_key = required_permission
        WHERE m.company_id = target_company_id
          AND m.user_id = (SELECT auth.uid())
          AND m.active IS TRUE
      )
    );
$$;

REVOKE ALL ON FUNCTION private.has_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_permission(uuid, text) TO service_role;

COMMENT ON FUNCTION private.has_permission(uuid, text) IS
  'True if platform master or auth.uid() has an active membership whose role includes the permission.';

-- Authenticated PostgREST: INSERT/UPDATE need media.manage; DELETE needs media.delete.
-- SELECT stays membership-based so viewers and grill (entity_type=event) still read.
DROP POLICY IF EXISTS media_assets_insert_member ON public.media_assets;
DROP POLICY IF EXISTS media_assets_update_member ON public.media_assets;
DROP POLICY IF EXISTS media_assets_delete_admin ON public.media_assets;
DROP POLICY IF EXISTS media_assets_insert_manage ON public.media_assets;
DROP POLICY IF EXISTS media_assets_update_manage ON public.media_assets;
DROP POLICY IF EXISTS media_assets_delete_permission ON public.media_assets;

CREATE POLICY media_assets_insert_manage
  ON public.media_assets FOR INSERT TO authenticated
  WITH CHECK (private.has_permission(company_id, 'media.manage'));

CREATE POLICY media_assets_update_manage
  ON public.media_assets FOR UPDATE TO authenticated
  USING (private.has_permission(company_id, 'media.manage'))
  WITH CHECK (private.has_permission(company_id, 'media.manage'));

CREATE POLICY media_assets_delete_permission
  ON public.media_assets FOR DELETE TO authenticated
  USING (private.has_permission(company_id, 'media.delete'));

-- Storage writes for company-public-media follow the same permission split.
DROP POLICY IF EXISTS company_public_media_auth_write ON storage.objects;
DROP POLICY IF EXISTS company_public_media_auth_update ON storage.objects;
DROP POLICY IF EXISTS company_public_media_auth_delete ON storage.objects;

CREATE POLICY company_public_media_auth_write
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-public-media'
    AND private.has_permission((storage.foldername(name))[1]::uuid, 'media.manage')
  );

CREATE POLICY company_public_media_auth_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-public-media'
    AND private.has_permission((storage.foldername(name))[1]::uuid, 'media.manage')
  )
  WITH CHECK (
    bucket_id = 'company-public-media'
    AND private.has_permission((storage.foldername(name))[1]::uuid, 'media.manage')
  );

CREATE POLICY company_public_media_auth_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-public-media'
    AND private.has_permission((storage.foldername(name))[1]::uuid, 'media.delete')
  );

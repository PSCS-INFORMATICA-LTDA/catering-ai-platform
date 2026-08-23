-- DEV ONLY target: yasprgtlqclwsjcshtls
-- NÃO aplicar em Production (eapwtirhevxrqinytans).
--
-- editor_meta jsonb is the canonical store for technical editor config:
-- autoFocus, focusMode, overlayEnabled, overlayDecided, overlayPosition,
-- suggested.{mobile,tablet,desktop}, applied.{mobile,tablet,desktop}.
-- label_*/alt_*/title_*/subtitle_* remain multilingual content columns.
-- Never persist titles or other copy inside editor_meta.

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS editor_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.media_assets.editor_meta IS
  'Canonical technical editor config: focus, overlay flags/position, per-device suggested/applied points. Not titles.';

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

-- DEV role foundation for media-only access.
-- No user-specific IDs in migration.

ALTER TABLE public.company_memberships
  DROP CONSTRAINT IF EXISTS company_memberships_role_check;

ALTER TABLE public.company_memberships
  ADD CONSTRAINT company_memberships_role_check
  CHECK (
    role = ANY (
      ARRAY[
        'owner'::text,
        'admin'::text,
        'manager'::text,
        'sales'::text,
        'operator'::text,
        'kitchen'::text,
        'finance'::text,
        'viewer'::text,
        'media_manager'::text
      ]
    )
  );

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'media_manager', p.permission_key
FROM public.permissions p
WHERE p.permission_key IN ('media.view', 'media.manage', 'media.delete')
ON CONFLICT DO NOTHING;

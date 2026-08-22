-- DEV ONLY target: yasprgtlqclwsjcshtls
-- NÃO aplicar em Production (eapwtirhevxrqinytans).
-- Permissão de exclusão permanente de mídia. Não enfraquece RLS.

INSERT INTO public.permissions (permission_key, label_pt, label_en, label_es, category_key)
VALUES (
  'media.delete',
  'Excluir mídia permanentemente',
  'Delete media permanently',
  'Eliminar medios de forma permanente',
  'media'
)
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r.role_key, 'media.delete'
FROM (VALUES ('owner'), ('admin')) AS r(role_key)
ON CONFLICT (role_key, permission_key) DO NOTHING;

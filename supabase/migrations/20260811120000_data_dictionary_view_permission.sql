-- =============================================================================
-- data_dictionary.view + translation_dictionary.view
-- Metadata de plataforma (Git). Permissão só owner/admin.
-- DEV: yasprgtlqclwsjcshtls
-- Não cria tabelas de dicionário (não é tenant-owned).
-- =============================================================================

INSERT INTO public.permissions (permission_key, label_pt, label_en, label_es, category_key)
VALUES
  (
    'data_dictionary.view',
    'Ver dicionário de dados',
    'View data dictionary',
    'Ver diccionario de datos',
    'settings'
  ),
  (
    'translation_dictionary.view',
    'Ver dicionário de traduções',
    'View translation dictionary',
    'Ver diccionario de traducciones',
    'settings'
  )
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r.role_key, p.permission_key
FROM (VALUES ('owner'), ('admin')) AS r(role_key)
CROSS JOIN (
  VALUES ('data_dictionary.view'), ('translation_dictionary.view')
) AS p(permission_key)
ON CONFLICT DO NOTHING;

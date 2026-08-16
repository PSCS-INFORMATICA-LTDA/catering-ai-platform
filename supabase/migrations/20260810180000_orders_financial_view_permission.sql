-- =============================================================================
-- orders.financial.view — segregação financeira da OS (DEV)
-- Operação vê dados operacionais; financeiro só com esta permissão.
-- =============================================================================

INSERT INTO public.permissions (permission_key, label_pt, label_en, label_es, category_key)
VALUES
  (
    'orders.financial.view',
    'Ver dados financeiros da OS',
    'View order financial data',
    'Ver datos financieros de la OS',
    'orders'
  )
ON CONFLICT (permission_key) DO NOTHING;

-- Autorizados: owner, admin, sales, finance
-- NÃO conceder automaticamente a manager / operator / kitchen / viewer
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r.role_key, 'orders.financial.view'
FROM (VALUES ('owner'), ('admin'), ('sales'), ('finance')) AS r(role_key)
ON CONFLICT DO NOTHING;

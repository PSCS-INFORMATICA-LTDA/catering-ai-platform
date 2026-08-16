-- =============================================================================
-- DEV ONLY — Exemplo de seed F1.1 (membership piloto)
-- NÃO executar automaticamente. NÃO usar em PROD sem revisão.
--
-- Substituir placeholders antes de rodar manualmente no Supabase DEV:
--   <AUTH_USER_ID_DEV>
--   <COMPANY_ID_DEV>
--   <BRANCH_ID_DEV>
--
-- Proibido neste arquivo:
--   - UUIDs reais commitados
--   - e-mails reais
--   - senhas / chaves
-- =============================================================================

-- 1) Perfil app ligado ao Auth (ajuste display_name localmente)
INSERT INTO public.app_users (
  auth_user_id,
  company_id,
  full_name,
  display_name,
  role_key,
  active,
  is_pscs_master
)
VALUES (
  '<AUTH_USER_ID_DEV>'::uuid,
  '<COMPANY_ID_DEV>'::uuid,
  'DEV User Placeholder',
  'DEV User Placeholder',
  'admin',
  true,
  false
)
ON CONFLICT (auth_user_id) DO UPDATE
SET
  company_id = EXCLUDED.company_id,
  display_name = EXCLUDED.display_name,
  active = true,
  is_pscs_master = false;

-- 2) Membership na company piloto (role de empresa — não usar pscs_master aqui)
INSERT INTO public.company_memberships (
  user_id,
  company_id,
  branch_id,
  role,
  active
)
VALUES (
  '<AUTH_USER_ID_DEV>'::uuid,
  '<COMPANY_ID_DEV>'::uuid,
  -- Opcional: trocar NULL por '<BRANCH_ID_DEV>'::uuid após substituir o placeholder
  NULL,
  'admin',
  true
)
ON CONFLICT (company_id, user_id) DO UPDATE
SET
  branch_id = EXCLUDED.branch_id,
  role = EXCLUDED.role,
  active = true,
  updated_at = now();

-- Exemplo com branch (descomente após substituir placeholders):
-- UPDATE public.company_memberships
-- SET branch_id = '<BRANCH_ID_DEV>'::uuid,
--     updated_at = now()
-- WHERE user_id = '<AUTH_USER_ID_DEV>'::uuid
--   AND company_id = '<COMPANY_ID_DEV>'::uuid;

-- 3) Exemplo opcional de PSCS master (descomente e use outro auth user)
-- UPDATE public.app_users
-- SET is_pscs_master = true,
--     company_id = NULL
-- WHERE auth_user_id = '<AUTH_USER_ID_DEV>'::uuid;

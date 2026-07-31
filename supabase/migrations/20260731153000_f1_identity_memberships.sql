-- =============================================================================
-- F1.1 — Modelo de identidade e memberships
-- Ambiente-alvo futuro: Supabase DEV (não executar automaticamente nesta entrega)
--
-- Escopo:
--   - Alinhar app_users com auth.users (auth_user_id UNIQUE + FK)
--   - Criar/alinhar company_memberships (user_id → auth.users)
--   - Seed versionável de app_roles por company existente (sem UUIDs reais)
--   - Índices necessários
--
-- FORA DE ESCOPO (proibido neste arquivo):
--   - GRANT / REVOKE / policies RLS / fechamento anon
--   - Usuários, e-mails, UUIDs de auth, senhas, chaves
--   - Membership piloto CDL (ver scripts/sql/dev/seed-f1-membership-example.sql)
--   - DROP TABLE / TRUNCATE / recriação destrutiva
--
-- Decisões:
--   - pscs_master = flag global em app_users (NÃO é role de company_memberships)
--   - company_id em app_users torna-se NULLABLE para permitir conta plataforma
--     (decisão reversível via UPDATE + SET NOT NULL se todos os rows tiverem company)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) app_users — colunas de identidade Auth / plataforma
-- ---------------------------------------------------------------------------

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS is_pscs_master boolean NOT NULL DEFAULT false;

-- active já existe no dump PROD; garante default/NOT NULL sem apagar dados
ALTER TABLE public.app_users
  ALTER COLUMN active SET DEFAULT true;

UPDATE public.app_users
SET active = true
WHERE active IS NULL;

-- display_name: backfill seguro a partir de full_name (sem introduzir PII novo)
UPDATE public.app_users
SET display_name = full_name
WHERE display_name IS NULL
  AND full_name IS NOT NULL;

-- DECISÃO (documentada): company_id deixa de ser obrigatório para permitir
-- app_users de plataforma (is_pscs_master) sem membership de empresa.
-- Não há DROP de coluna; rows existentes permanecem com company_id preenchido.
ALTER TABLE public.app_users
  ALTER COLUMN company_id DROP NOT NULL;

-- UNIQUE (auth_user_id): múltiplos NULL permitidos no PostgreSQL (legado sem Auth)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_users_auth_user_id_key'
      AND conrelid = 'public.app_users'::regclass
  ) THEN
    ALTER TABLE public.app_users
      ADD CONSTRAINT app_users_auth_user_id_key UNIQUE (auth_user_id);
  END IF;
END $$;

-- FK auth.users — ON DELETE SET NULL preserva row de app_users (não CASCADE amplo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_users_auth_user_id_fkey'
      AND conrelid = 'public.app_users'::regclass
  ) THEN
    ALTER TABLE public.app_users
      ADD CONSTRAINT app_users_auth_user_id_fkey
      FOREIGN KEY (auth_user_id)
      REFERENCES auth.users (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_app_users_auth_user_id
  ON public.app_users (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_is_pscs_master
  ON public.app_users (is_pscs_master)
  WHERE is_pscs_master = true;

-- ---------------------------------------------------------------------------
-- 2) company_memberships — criar ou alinhar
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.company_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  branch_id uuid,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'operator',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Colunas caso a tabela já exista (foundation) com shape parcial
ALTER TABLE public.company_memberships
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

ALTER TABLE public.company_memberships
  ADD COLUMN IF NOT EXISTS company_id uuid;

ALTER TABLE public.company_memberships
  ADD COLUMN IF NOT EXISTS branch_id uuid;

ALTER TABLE public.company_memberships
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.company_memberships
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'operator';

ALTER TABLE public.company_memberships
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

ALTER TABLE public.company_memberships
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.company_memberships
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Defaults / NOT NULL seguros (falha se houver NULL em colunas críticas — esperado)
UPDATE public.company_memberships
SET role = 'operator'
WHERE role IS NULL;

UPDATE public.company_memberships
SET active = true
WHERE active IS NULL;

UPDATE public.company_memberships
SET created_at = now()
WHERE created_at IS NULL;

UPDATE public.company_memberships
SET updated_at = now()
WHERE updated_at IS NULL;

DO $$
BEGIN
  -- PK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_memberships_pkey'
      AND conrelid = 'public.company_memberships'::regclass
  ) THEN
    ALTER TABLE public.company_memberships
      ADD CONSTRAINT company_memberships_pkey PRIMARY KEY (id);
  END IF;

  -- UNIQUE (company_id, user_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_memberships_company_id_user_id_key'
      AND conrelid = 'public.company_memberships'::regclass
  ) THEN
    ALTER TABLE public.company_memberships
      ADD CONSTRAINT company_memberships_company_id_user_id_key
      UNIQUE (company_id, user_id);
  END IF;

  -- FK company
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_memberships_company_id_fkey'
      AND conrelid = 'public.company_memberships'::regclass
  ) THEN
    ALTER TABLE public.company_memberships
      ADD CONSTRAINT company_memberships_company_id_fkey
      FOREIGN KEY (company_id)
      REFERENCES public.companies (id)
      ON DELETE CASCADE;
  END IF;

  -- FK branch simples (SET NULL — não CASCADE amplo em branches)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_memberships_branch_id_fkey'
      AND conrelid = 'public.company_memberships'::regclass
  ) THEN
    ALTER TABLE public.company_memberships
      ADD CONSTRAINT company_memberships_branch_id_fkey
      FOREIGN KEY (branch_id)
      REFERENCES public.branches (id)
      ON DELETE SET NULL;
  END IF;

  -- FK user_id → auth.users
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_memberships_user_id_fkey'
      AND conrelid = 'public.company_memberships'::regclass
  ) THEN
    ALTER TABLE public.company_memberships
      ADD CONSTRAINT company_memberships_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users (id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Compatibilidade branch ∈ company:
-- NÃO usar FK composta (branch_id, company_id) com ON DELETE SET NULL:
-- no PostgreSQL isso anularia também company_id (efeito colateral perigoso).
-- DECISÃO: trigger de validação + FK simples branch_id ON DELETE SET NULL.
CREATE OR REPLACE FUNCTION public.enforce_membership_branch_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  branch_company uuid;
BEGIN
  IF NEW.branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.company_id
  INTO branch_company
  FROM public.branches AS b
  WHERE b.id = NEW.branch_id;

  IF branch_company IS NULL THEN
    RAISE EXCEPTION 'company_memberships.branch_id % não existe em branches', NEW.branch_id;
  END IF;

  IF branch_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION
      'company_memberships.branch_id % não pertence a company_id %',
      NEW.branch_id,
      NEW.company_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_memberships_branch_company
  ON public.company_memberships;

CREATE TRIGGER trg_company_memberships_branch_company
  BEFORE INSERT OR UPDATE OF branch_id, company_id
  ON public.company_memberships
  FOR EACH ROW
  EXECUTE PROCEDURE public.enforce_membership_branch_company();

-- Roles de empresa permitidos (pscs_master NÃO entra aqui)
-- DROP CONSTRAINT de CHECK é reversível e necessário para incluir 'finance'.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_memberships_role_check'
      AND conrelid = 'public.company_memberships'::regclass
  ) THEN
    ALTER TABLE public.company_memberships
      DROP CONSTRAINT company_memberships_role_check;
  END IF;

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
          'viewer'::text
        ]
      )
    );
END $$;

COMMENT ON TABLE public.company_memberships IS
  'F1.1: vínculo auth.users ↔ companies; role de empresa (não inclui pscs_master).';

COMMENT ON COLUMN public.app_users.is_pscs_master IS
  'F1.1: permissão global de plataforma; não é role de company_memberships.';

COMMENT ON COLUMN public.app_users.auth_user_id IS
  'F1.1: FK UNIQUE para auth.users(id); NULL permitido para legado pré-Auth.';

-- Índices pedidos
CREATE INDEX IF NOT EXISTS idx_company_memberships_user_active
  ON public.company_memberships (user_id, active);

CREATE INDEX IF NOT EXISTS idx_company_memberships_company_user
  ON public.company_memberships (company_id, user_id);

CREATE INDEX IF NOT EXISTS idx_company_memberships_company_active
  ON public.company_memberships (company_id, active);

CREATE INDEX IF NOT EXISTS idx_company_memberships_branch_id
  ON public.company_memberships (branch_id)
  WHERE branch_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) app_roles — alinhar catálogo por company (sem UUIDs literais)
-- ---------------------------------------------------------------------------

-- UNIQUE (company_id, role_key) para seed idempotente
CREATE UNIQUE INDEX IF NOT EXISTS app_roles_company_id_role_key_uidx
  ON public.app_roles (company_id, role_key);

-- Insere roles mínimos + preserva existentes (ON CONFLICT DO NOTHING).
-- Não apaga roles; não usa UUID de company hardcoded.
INSERT INTO public.app_roles (
  company_id,
  role_key,
  label_pt,
  label_en,
  label_es,
  active
)
SELECT
  c.id,
  r.role_key,
  r.label_pt,
  r.label_en,
  r.label_es,
  true
FROM public.companies AS c
CROSS JOIN (
  VALUES
    ('owner',    'Proprietário',      'Owner',             'Propietario'),
    ('admin',    'Administrador',     'Administrator',     'Administrador'),
    ('manager',  'Gerente',           'Manager',           'Gerente'),
    ('sales',    'Comercial',         'Sales',             'Comercial'),
    ('operator', 'Operacional',       'Operations',        'Operaciones'),
    ('kitchen',  'Cozinha',           'Kitchen',           'Cocina'),
    ('finance',  'Financeiro',        'Finance',           'Finanzas'),
    ('viewer',   'Somente leitura',   'Read only',         'Solo lectura')
) AS r(role_key, label_pt, label_en, label_es)
ON CONFLICT (company_id, role_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Fim F1.1 — sem GRANT, sem RLS, sem seeds de pessoas
-- =============================================================================

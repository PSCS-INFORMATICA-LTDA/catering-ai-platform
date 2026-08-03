-- =============================================================================
-- F1.1 — Modelo de identidade e memberships (RECONCILIAÇÃO IDEMPOTENTE)
-- Ambiente-alvo: Supabase DEV (yasprgtlqclwsjcshtls)
-- Nao aplicar em Production.
--
-- Escopo:
--   - Alinhar app_users com auth.users (auth_user_id UNIQUE + FK)
--   - Criar/alinhar company_memberships (user_id → auth.users)
--   - Seed versionável de app_roles por company existente
--   - Índices necessários
--
-- Comportamento:
--   - Seguro em banco vazio e em DEV parcial (CENÁRIO C)
--   - Preserva objetos equivalentes (por definição, não só por nome)
--   - Bloqueia se houver órfãos/duplicatas incompatíveis (não apaga dados)
--
-- FORA DE ESCOPO:
--   - GRANT / REVOKE / policies RLS / fechamento anon (ver harden_multitenant_rls)
--   - Usuários, e-mails, UUIDs de auth, senhas, chaves
--   - remocao destrutiva de tabelas ou dados
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers locais de reconciliação (temporários ao arquivo)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._f1_constraint_matches(
  p_table regclass,
  p_conname text,
  p_contype "char",
  p_def_like text
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = p_table
      AND c.conname = p_conname
      AND c.contype = p_contype
      AND pg_get_constraintdef(c.oid) ILIKE p_def_like
  );
$$;

CREATE OR REPLACE FUNCTION public._f1_any_constraint_matches(
  p_table regclass,
  p_contype "char",
  p_def_like text
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = p_table
      AND c.contype = p_contype
      AND pg_get_constraintdef(c.oid) ILIKE p_def_like
  );
$$;

-- ---------------------------------------------------------------------------
-- 1) app_users — colunas de identidade Auth / plataforma
-- ---------------------------------------------------------------------------

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS is_pscs_master boolean NOT NULL DEFAULT false;

ALTER TABLE public.app_users
  ALTER COLUMN active SET DEFAULT true;

UPDATE public.app_users
SET active = true
WHERE active IS NULL;

UPDATE public.app_users
SET display_name = full_name
WHERE display_name IS NULL
  AND full_name IS NOT NULL;

-- company_id nullable para contas de plataforma (pscs_master)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_users'
      AND column_name = 'company_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.app_users
      ALTER COLUMN company_id DROP NOT NULL;
  END IF;
END $$;

-- Preflight: duplicatas auth_user_id (bloqueia UNIQUE)
DO $$
DECLARE
  dup_count integer;
  sample_ids text;
BEGIN
  SELECT COUNT(*)::integer, string_agg(auth_user_id::text, ', ' ORDER BY auth_user_id::text)
  INTO dup_count, sample_ids
  FROM (
    SELECT auth_user_id
    FROM public.app_users
    WHERE auth_user_id IS NOT NULL
    GROUP BY auth_user_id
    HAVING COUNT(*) > 1
    LIMIT 20
  ) d;

  IF COALESCE(dup_count, 0) > 0 THEN
    RAISE EXCEPTION
      'F1 blocked: duplicate app_users.auth_user_id (count=%). ids=[%]',
      dup_count, coalesce(sample_ids, '');
  END IF;
END $$;

-- Preflight: órfãos auth_user_id → auth.users
DO $$
DECLARE
  orphan_count integer;
  sample_ids text;
BEGIN
  SELECT COUNT(*)::integer, string_agg(a.id::text, ', ' ORDER BY a.id::text)
  INTO orphan_count, sample_ids
  FROM (
    SELECT au.id
    FROM public.app_users au
    WHERE au.auth_user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM auth.users u WHERE u.id = au.auth_user_id
      )
    LIMIT 20
  ) a;

  IF COALESCE(orphan_count, 0) > 0 THEN
    RAISE EXCEPTION
      'F1 blocked: orphan app_users.auth_user_id (count=%). app_users.id=[%]',
      orphan_count, coalesce(sample_ids, '');
  END IF;
END $$;

DO $$
BEGIN
  IF public._f1_any_constraint_matches(
    'public.app_users'::regclass,
    'u',
    'UNIQUE (auth_user_id)'
  ) THEN
    RAISE NOTICE 'F1: UNIQUE(auth_user_id) already present (equivalent)';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_users_auth_user_id_key'
      AND conrelid = 'public.app_users'::regclass
  ) THEN
    ALTER TABLE public.app_users
      ADD CONSTRAINT app_users_auth_user_id_key UNIQUE (auth_user_id);
  ELSIF NOT public._f1_constraint_matches(
    'public.app_users'::regclass,
    'app_users_auth_user_id_key',
    'u',
    'UNIQUE (auth_user_id)'
  ) THEN
    RAISE EXCEPTION
      'F1 blocked: constraint app_users_auth_user_id_key exists with divergent definition: %',
      (
        SELECT pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE conname = 'app_users_auth_user_id_key'
          AND conrelid = 'public.app_users'::regclass
      );
  END IF;
END $$;

DO $$
BEGIN
  IF public._f1_any_constraint_matches(
    'public.app_users'::regclass,
    'f',
    'FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL'
  ) THEN
    RAISE NOTICE 'F1: FK app_users.auth_user_id already present (equivalent)';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_users_auth_user_id_fkey'
      AND conrelid = 'public.app_users'::regclass
  ) THEN
    ALTER TABLE public.app_users
      ADD CONSTRAINT app_users_auth_user_id_fkey
      FOREIGN KEY (auth_user_id)
      REFERENCES auth.users (id)
      ON DELETE SET NULL;
  ELSIF NOT public._f1_constraint_matches(
    'public.app_users'::regclass,
    'app_users_auth_user_id_fkey',
    'f',
    'FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL'
  ) THEN
    RAISE EXCEPTION
      'F1 blocked: constraint app_users_auth_user_id_fkey divergent: %',
      (
        SELECT pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE conname = 'app_users_auth_user_id_fkey'
          AND conrelid = 'public.app_users'::regclass
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_app_users_auth_user_id
  ON public.app_users (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_is_pscs_master
  ON public.app_users (is_pscs_master)
  WHERE is_pscs_master = true;

COMMENT ON COLUMN public.app_users.is_pscs_master IS
  'F1.1: permissão global de plataforma; não é role de company_memberships.';

COMMENT ON COLUMN public.app_users.auth_user_id IS
  'F1.1: FK UNIQUE para auth.users(id); NULL permitido para legado pré-Auth.';

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

UPDATE public.company_memberships
SET id = gen_random_uuid()
WHERE id IS NULL;

-- Preflight NULL críticos
DO $$
DECLARE
  null_company integer;
  null_user integer;
  null_id integer;
BEGIN
  SELECT COUNT(*) INTO null_company FROM public.company_memberships WHERE company_id IS NULL;
  SELECT COUNT(*) INTO null_user FROM public.company_memberships WHERE user_id IS NULL;
  SELECT COUNT(*) INTO null_id FROM public.company_memberships WHERE id IS NULL;

  IF null_company > 0 OR null_user > 0 OR null_id > 0 THEN
    RAISE EXCEPTION
      'F1 blocked: company_memberships nulls id=% company_id=% user_id=%',
      null_id, null_company, null_user;
  END IF;
END $$;

-- Preflight duplicatas (company_id, user_id)
DO $$
DECLARE
  dup_count integer;
  sample_ids text;
BEGIN
  SELECT COUNT(*)::integer, string_agg(company_id::text || '/' || user_id::text, ', ')
  INTO dup_count, sample_ids
  FROM (
    SELECT company_id, user_id
    FROM public.company_memberships
    GROUP BY company_id, user_id
    HAVING COUNT(*) > 1
    LIMIT 20
  ) d;

  IF COALESCE(dup_count, 0) > 0 THEN
    RAISE EXCEPTION
      'F1 blocked: duplicate company_memberships(company_id,user_id) count=% pairs=[%]',
      dup_count, coalesce(sample_ids, '');
  END IF;
END $$;

-- Preflight órfãos company / user / branch
DO $$
DECLARE
  orphan_company integer;
  orphan_user integer;
  orphan_branch integer;
  sample text;
BEGIN
  SELECT COUNT(*)::integer, string_agg(id::text, ', ')
  INTO orphan_company, sample
  FROM (
    SELECT m.id
    FROM public.company_memberships m
    WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = m.company_id)
    LIMIT 20
  ) x;
  IF COALESCE(orphan_company, 0) > 0 THEN
    RAISE EXCEPTION 'F1 blocked: membership orphan company_id count=% ids=[%]', orphan_company, coalesce(sample, '');
  END IF;

  SELECT COUNT(*)::integer, string_agg(id::text, ', ')
  INTO orphan_user, sample
  FROM (
    SELECT m.id
    FROM public.company_memberships m
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.user_id)
    LIMIT 20
  ) x;
  IF COALESCE(orphan_user, 0) > 0 THEN
    RAISE EXCEPTION 'F1 blocked: membership orphan user_id count=% ids=[%]', orphan_user, coalesce(sample, '');
  END IF;

  SELECT COUNT(*)::integer, string_agg(id::text, ', ')
  INTO orphan_branch, sample
  FROM (
    SELECT m.id
    FROM public.company_memberships m
    WHERE m.branch_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = m.branch_id)
    LIMIT 20
  ) x;
  IF COALESCE(orphan_branch, 0) > 0 THEN
    RAISE EXCEPTION 'F1 blocked: membership orphan branch_id count=% ids=[%]', orphan_branch, coalesce(sample, '');
  END IF;
END $$;

DO $$
BEGIN
  -- PK
  IF public._f1_any_constraint_matches(
    'public.company_memberships'::regclass, 'p', 'PRIMARY KEY (id)'
  ) THEN
    RAISE NOTICE 'F1: company_memberships PK equivalent exists';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_memberships_pkey'
      AND conrelid = 'public.company_memberships'::regclass
  ) THEN
    ALTER TABLE public.company_memberships
      ADD CONSTRAINT company_memberships_pkey PRIMARY KEY (id);
  ELSIF NOT public._f1_constraint_matches(
    'public.company_memberships'::regclass,
    'company_memberships_pkey',
    'p',
    'PRIMARY KEY (id)'
  ) THEN
    RAISE EXCEPTION 'F1 blocked: company_memberships_pkey divergent: %',
      (SELECT pg_get_constraintdef(oid) FROM pg_constraint
       WHERE conname = 'company_memberships_pkey'
         AND conrelid = 'public.company_memberships'::regclass);
  END IF;

  -- UNIQUE (company_id, user_id)
  IF public._f1_any_constraint_matches(
    'public.company_memberships'::regclass, 'u', 'UNIQUE (company_id, user_id)'
  ) THEN
    RAISE NOTICE 'F1: UNIQUE(company_id,user_id) equivalent exists';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_memberships_company_id_user_id_key'
      AND conrelid = 'public.company_memberships'::regclass
  ) THEN
    ALTER TABLE public.company_memberships
      ADD CONSTRAINT company_memberships_company_id_user_id_key
      UNIQUE (company_id, user_id);
  ELSIF NOT public._f1_constraint_matches(
    'public.company_memberships'::regclass,
    'company_memberships_company_id_user_id_key',
    'u',
    'UNIQUE (company_id, user_id)'
  ) THEN
    RAISE EXCEPTION 'F1 blocked: company_memberships_company_id_user_id_key divergent: %',
      (SELECT pg_get_constraintdef(oid) FROM pg_constraint
       WHERE conname = 'company_memberships_company_id_user_id_key'
         AND conrelid = 'public.company_memberships'::regclass);
  END IF;

  -- FK company
  IF public._f1_any_constraint_matches(
    'public.company_memberships'::regclass, 'f',
    'FOREIGN KEY (company_id) REFERENCES %companies(id) ON DELETE CASCADE'
  ) OR public._f1_any_constraint_matches(
    'public.company_memberships'::regclass, 'f',
    'FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE'
  ) OR public._f1_any_constraint_matches(
    'public.company_memberships'::regclass, 'f',
    'FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE'
  ) THEN
    RAISE NOTICE 'F1: FK company_id equivalent exists';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_memberships_company_id_fkey'
      AND conrelid = 'public.company_memberships'::regclass
  ) THEN
    ALTER TABLE public.company_memberships
      ADD CONSTRAINT company_memberships_company_id_fkey
      FOREIGN KEY (company_id)
      REFERENCES public.companies (id)
      ON DELETE CASCADE;
  ELSIF NOT (
    public._f1_constraint_matches(
      'public.company_memberships'::regclass,
      'company_memberships_company_id_fkey', 'f',
      '%FOREIGN KEY (company_id) REFERENCES%companies(id) ON DELETE CASCADE%'
    )
  ) THEN
    RAISE EXCEPTION 'F1 blocked: company_memberships_company_id_fkey divergent: %',
      (SELECT pg_get_constraintdef(oid) FROM pg_constraint
       WHERE conname = 'company_memberships_company_id_fkey'
         AND conrelid = 'public.company_memberships'::regclass);
  END IF;

  -- FK branch
  IF public._f1_any_constraint_matches(
    'public.company_memberships'::regclass, 'f',
    'FOREIGN KEY (branch_id) REFERENCES %branches(id) ON DELETE SET NULL'
  ) OR public._f1_any_constraint_matches(
    'public.company_memberships'::regclass, 'f',
    'FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL'
  ) OR public._f1_any_constraint_matches(
    'public.company_memberships'::regclass, 'f',
    'FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL'
  ) THEN
    RAISE NOTICE 'F1: FK branch_id equivalent exists';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_memberships_branch_id_fkey'
      AND conrelid = 'public.company_memberships'::regclass
  ) THEN
    ALTER TABLE public.company_memberships
      ADD CONSTRAINT company_memberships_branch_id_fkey
      FOREIGN KEY (branch_id)
      REFERENCES public.branches (id)
      ON DELETE SET NULL;
  ELSIF NOT (
    public._f1_constraint_matches(
      'public.company_memberships'::regclass,
      'company_memberships_branch_id_fkey', 'f',
      '%FOREIGN KEY (branch_id) REFERENCES%branches(id) ON DELETE SET NULL%'
    )
  ) THEN
    RAISE EXCEPTION 'F1 blocked: company_memberships_branch_id_fkey divergent: %',
      (SELECT pg_get_constraintdef(oid) FROM pg_constraint
       WHERE conname = 'company_memberships_branch_id_fkey'
         AND conrelid = 'public.company_memberships'::regclass);
  END IF;

  -- FK user
  IF public._f1_any_constraint_matches(
    'public.company_memberships'::regclass, 'f',
    'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'
  ) THEN
    RAISE NOTICE 'F1: FK user_id equivalent exists';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_memberships_user_id_fkey'
      AND conrelid = 'public.company_memberships'::regclass
  ) THEN
    ALTER TABLE public.company_memberships
      ADD CONSTRAINT company_memberships_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users (id)
      ON DELETE CASCADE;
  ELSIF NOT public._f1_constraint_matches(
    'public.company_memberships'::regclass,
    'company_memberships_user_id_fkey', 'f',
    'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'
  ) THEN
    RAISE EXCEPTION 'F1 blocked: company_memberships_user_id_fkey divergent: %',
      (SELECT pg_get_constraintdef(oid) FROM pg_constraint
       WHERE conname = 'company_memberships_user_id_fkey'
         AND conrelid = 'public.company_memberships'::regclass);
  END IF;
END $$;

-- NOT NULL seguros (somente se sem NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='company_memberships'
      AND column_name='company_id' AND is_nullable='YES'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.company_memberships WHERE company_id IS NULL
  ) THEN
    ALTER TABLE public.company_memberships ALTER COLUMN company_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='company_memberships'
      AND column_name='user_id' AND is_nullable='YES'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.company_memberships WHERE user_id IS NULL
  ) THEN
    ALTER TABLE public.company_memberships ALTER COLUMN user_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='company_memberships'
      AND column_name='role' AND is_nullable='YES'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.company_memberships WHERE role IS NULL
  ) THEN
    ALTER TABLE public.company_memberships ALTER COLUMN role SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='company_memberships'
      AND column_name='active' AND is_nullable='YES'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.company_memberships WHERE active IS NULL
  ) THEN
    ALTER TABLE public.company_memberships ALTER COLUMN active SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.company_memberships
  ALTER COLUMN role SET DEFAULT 'operator';

ALTER TABLE public.company_memberships
  ALTER COLUMN active SET DEFAULT true;

ALTER TABLE public.company_memberships
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.company_memberships
  ALTER COLUMN updated_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION public.enforce_membership_branch_company()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
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

-- CHECK de roles (recria somente se ausente ou divergente)
DO $f1chk$
DECLARE
  current_def text;
  is_equiv boolean;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO current_def
  FROM pg_constraint
  WHERE conname = 'company_memberships_role_check'
    AND conrelid = 'public.company_memberships'::regclass;

  is_equiv :=
    current_def IS NOT NULL
    AND current_def ILIKE '%owner%'
    AND current_def ILIKE '%admin%'
    AND current_def ILIKE '%manager%'
    AND current_def ILIKE '%sales%'
    AND current_def ILIKE '%operator%'
    AND current_def ILIKE '%kitchen%'
    AND current_def ILIKE '%finance%'
    AND current_def ILIKE '%viewer%';

  IF current_def IS NULL THEN
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
  ELSIF is_equiv THEN
    RAISE NOTICE 'F1: company_memberships_role_check equivalent exists';
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE role IS NULL
         OR NOT (
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
         )
    ) THEN
      RAISE EXCEPTION 'F1 blocked: company_memberships.role values outside allowed set';
    END IF;

    ALTER TABLE public.company_memberships
      DROP CONSTRAINT company_memberships_role_check;

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
  END IF;
END $f1chk$;

COMMENT ON TABLE public.company_memberships IS
  'F1.1: vínculo auth.users ↔ companies; role de empresa (não inclui pscs_master).';

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
-- 3) app_roles — índice único + seed (completa lacuna do CENÁRIO C)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'app_roles'
  ) THEN
    RAISE EXCEPTION 'F1 blocked: public.app_roles table is required but missing';
  END IF;
END $$;

-- Preflight duplicatas (company_id, role_key) antes do UNIQUE INDEX
DO $$
DECLARE
  dup_count integer;
  sample text;
BEGIN
  SELECT COUNT(*)::integer, string_agg(company_id::text || '/' || role_key, ', ')
  INTO dup_count, sample
  FROM (
    SELECT company_id, role_key
    FROM public.app_roles
    GROUP BY company_id, role_key
    HAVING COUNT(*) > 1
    LIMIT 20
  ) d;

  IF COALESCE(dup_count, 0) > 0 THEN
    RAISE EXCEPTION
      'F1 blocked: duplicate app_roles(company_id,role_key) count=% pairs=[%]',
      dup_count, coalesce(sample, '');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS app_roles_company_id_role_key_uidx
  ON public.app_roles (company_id, role_key);

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
-- Cleanup helpers temporários
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public._f1_constraint_matches(regclass, text, "char", text);
DROP FUNCTION IF EXISTS public._f1_any_constraint_matches(regclass, "char", text);

-- ---------------------------------------------------------------------------
-- Fim F1.1 — sem GRANT, sem RLS foundation (hardening em migration posterior)
-- =============================================================================

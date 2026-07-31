-- =============================================================================
-- F1.1 — Pré-validação SOMENTE LEITURA
-- Arquivo: scripts/sql/dev/check-f1-identity-memberships-readonly.sql
--
-- DEV ONLY
-- Projeto esperado: catering-ai-platform-DEV
-- Project ref esperado: yasprgtlqclwsjcshtls
-- NÃO EXECUTAR EM PROD
-- Somente leitura
-- Executar no SQL Editor com papel administrativo
--
-- FASE A: execução integral segura (statements ativos).
-- FASE B: detalhe manual em /* ... */ — descomentar um bloco se A5 = READY.
-- Fora de supabase/migrations (não roda por CLI migrations/seed).
-- =============================================================================

-- ############################################################################
-- FASE A — PREFLIGHT SEGURO PARA EXECUÇÃO INTEGRAL
-- ############################################################################

-- A2) Existência dos objetos
SELECT
  'A2_object_existence' AS check_name,
  t.object_name,
  CASE
    WHEN to_regclass(t.object_name) IS NULL THEN 'TABLE_ABSENT'
    ELSE 'TABLE_PRESENT'
  END AS status
FROM (
  VALUES
    ('public.app_users'),
    ('public.app_roles'),
    ('public.companies'),
    ('public.branches'),
    ('public.company_memberships'),
    ('auth.users')
) AS t(object_name)
ORDER BY t.object_name;

-- A3) Existência das colunas
-- TABLE ausente → NOT_CHECKED; senão COLUMN_PRESENT / COLUMN_ABSENT
-- Nomes de objeto literais (sem concatenacao, concat ou format)
SELECT
  'A3_column_existence' AS check_name,
  'public.app_users' AS object_name,
  required.column_name,
  CASE
    WHEN to_regclass('public.app_users') IS NULL THEN 'NOT_CHECKED'
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns AS c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'app_users'
        AND c.column_name = required.column_name
    ) THEN 'COLUMN_PRESENT'
    ELSE 'COLUMN_ABSENT'
  END AS status
FROM (
  VALUES
    ('auth_user_id'),
    ('company_id')
) AS required(column_name)

UNION ALL

SELECT
  'A3_column_existence' AS check_name,
  'public.app_roles' AS object_name,
  required.column_name,
  CASE
    WHEN to_regclass('public.app_roles') IS NULL THEN 'NOT_CHECKED'
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns AS c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'app_roles'
        AND c.column_name = required.column_name
    ) THEN 'COLUMN_PRESENT'
    ELSE 'COLUMN_ABSENT'
  END AS status
FROM (
  VALUES
    ('company_id'),
    ('role_key')
) AS required(column_name)

UNION ALL

SELECT
  'A3_column_existence' AS check_name,
  'public.company_memberships' AS object_name,
  required.column_name,
  CASE
    WHEN to_regclass('public.company_memberships') IS NULL THEN 'NOT_CHECKED'
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns AS c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'company_memberships'
        AND c.column_name = required.column_name
    ) THEN 'COLUMN_PRESENT'
    ELSE 'COLUMN_ABSENT'
  END AS status
FROM (
  VALUES
    ('user_id'),
    ('company_id'),
    ('branch_id'),
    ('role'),
    ('active')
) AS required(column_name)

ORDER BY object_name, column_name;

-- A4) Contagens opcionais — query_to_xml SOMENTE aqui, SQL literal por tabela
-- row_count NULL = tabela ausente (não interpretar como zero)
SELECT 'A4_row_count' AS check_name, 'public.app_users' AS object_name,
  CASE WHEN to_regclass('public.app_users') IS NULL THEN NULL
       ELSE (SELECT NULLIF((xpath('/table/row/cnt/text()', query_to_xml(
              'SELECT count(*)::bigint AS cnt FROM public.app_users', false, true, ''
            )))[1]::text, '')::bigint)
  END AS row_count,
  CASE WHEN to_regclass('public.app_users') IS NULL THEN 'TABLE_ABSENT' ELSE 'TABLE_PRESENT' END AS status;

SELECT 'A4_row_count' AS check_name, 'public.app_roles' AS object_name,
  CASE WHEN to_regclass('public.app_roles') IS NULL THEN NULL
       ELSE (SELECT NULLIF((xpath('/table/row/cnt/text()', query_to_xml(
              'SELECT count(*)::bigint AS cnt FROM public.app_roles', false, true, ''
            )))[1]::text, '')::bigint)
  END AS row_count,
  CASE WHEN to_regclass('public.app_roles') IS NULL THEN 'TABLE_ABSENT' ELSE 'TABLE_PRESENT' END AS status;

SELECT 'A4_row_count' AS check_name, 'public.companies' AS object_name,
  CASE WHEN to_regclass('public.companies') IS NULL THEN NULL
       ELSE (SELECT NULLIF((xpath('/table/row/cnt/text()', query_to_xml(
              'SELECT count(*)::bigint AS cnt FROM public.companies', false, true, ''
            )))[1]::text, '')::bigint)
  END AS row_count,
  CASE WHEN to_regclass('public.companies') IS NULL THEN 'TABLE_ABSENT' ELSE 'TABLE_PRESENT' END AS status;

SELECT 'A4_row_count' AS check_name, 'public.branches' AS object_name,
  CASE WHEN to_regclass('public.branches') IS NULL THEN NULL
       ELSE (SELECT NULLIF((xpath('/table/row/cnt/text()', query_to_xml(
              'SELECT count(*)::bigint AS cnt FROM public.branches', false, true, ''
            )))[1]::text, '')::bigint)
  END AS row_count,
  CASE WHEN to_regclass('public.branches') IS NULL THEN 'TABLE_ABSENT' ELSE 'TABLE_PRESENT' END AS status;

SELECT 'A4_row_count' AS check_name, 'public.company_memberships' AS object_name,
  CASE WHEN to_regclass('public.company_memberships') IS NULL THEN NULL
       ELSE (SELECT NULLIF((xpath('/table/row/cnt/text()', query_to_xml(
              'SELECT count(*)::bigint AS cnt FROM public.company_memberships', false, true, ''
            )))[1]::text, '')::bigint)
  END AS row_count,
  CASE WHEN to_regclass('public.company_memberships') IS NULL THEN 'TABLE_ABSENT' ELSE 'TABLE_PRESENT' END AS status;

SELECT 'A4_row_count' AS check_name, 'auth.users' AS object_name,
  CASE WHEN to_regclass('auth.users') IS NULL THEN NULL
       ELSE (SELECT NULLIF((xpath('/table/row/cnt/text()', query_to_xml(
              'SELECT count(*)::bigint AS cnt FROM auth.users', false, true, ''
            )))[1]::text, '')::bigint)
  END AS row_count,
  CASE WHEN to_regclass('auth.users') IS NULL THEN 'TABLE_ABSENT' ELSE 'TABLE_PRESENT' END AS status;

-- A5) Prontidão da Fase B (sem reexecutar detalhes)
-- READY | TABLE_ABSENT | COLUMN_ABSENT | NOT_CHECKED
SELECT
  'A5_phase_b_readiness' AS check_name,
  r.detail_check,
  CASE
    WHEN to_regclass(r.t1) IS NULL THEN 'TABLE_ABSENT'
    WHEN r.c1 IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns col
      WHERE col.table_schema = split_part(r.t1, '.', 1)
        AND col.table_name = split_part(r.t1, '.', 2)
        AND col.column_name = r.c1
    ) THEN 'COLUMN_ABSENT'
    WHEN r.t2 IS NOT NULL AND to_regclass(r.t2) IS NULL THEN 'TABLE_ABSENT'
    WHEN r.c2 IS NOT NULL AND to_regclass(COALESCE(r.t2, r.t1)) IS NULL THEN 'NOT_CHECKED'
    WHEN r.c2 IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns col
      WHERE col.table_schema = split_part(COALESCE(r.t2, r.t1), '.', 1)
        AND col.table_name = split_part(COALESCE(r.t2, r.t1), '.', 2)
        AND col.column_name = r.c2
    ) THEN 'COLUMN_ABSENT'
    ELSE 'READY'
  END AS status
FROM (
  VALUES
    ('B1_app_users_duplicate_auth_user_id', 'public.app_users', 'auth_user_id', NULL, NULL),
    ('B2_app_users_orphan_auth_user_id', 'public.app_users', 'auth_user_id', 'auth.users', NULL),
    ('B3_memberships_duplicate_company_user', 'public.company_memberships', 'company_id', NULL, 'user_id'),
    ('B4_memberships_orphan_user_id', 'public.company_memberships', 'user_id', 'auth.users', NULL),
    ('B5_memberships_orphan_company_id', 'public.company_memberships', 'company_id', 'public.companies', NULL),
    ('B6_memberships_orphan_branch_id', 'public.company_memberships', 'branch_id', 'public.branches', NULL),
    ('B7_memberships_branch_company_mismatch', 'public.company_memberships', 'branch_id', 'public.branches', 'company_id'),
    ('B8_app_roles_duplicate_company_role_key', 'public.app_roles', 'company_id', NULL, 'role_key'),
    ('B9_app_users_null_company_id', 'public.app_users', 'company_id', NULL, NULL)
) AS r(detail_check, t1, c1, t2, c2)
ORDER BY r.detail_check;

-- Fim Fase A

-- ############################################################################
-- FASE B — CONSULTAS MANUAIS DE DETALHE (comentadas; não rodam na execução integral)
-- ############################################################################

/*
-- EXECUTAR SOMENTE SE A FASE A INDICAR TABLE_PRESENT E COLUMN_PRESENT.
-- B1) auth_user_id duplicado em app_users
SELECT 'B1_app_users_duplicate_auth_user_id' AS check_name,
       au.auth_user_id, count(*)::bigint AS duplicate_count
FROM public.app_users AS au
WHERE au.auth_user_id IS NOT NULL
GROUP BY au.auth_user_id
HAVING count(*) > 1
ORDER BY duplicate_count DESC, au.auth_user_id;
*/

/*
-- EXECUTAR SOMENTE SE A FASE A INDICAR TABLE_PRESENT E COLUMN_PRESENT.
-- B2) auth_user_id órfão versus auth.users
SELECT 'B2_app_users_orphan_auth_user_id' AS check_name,
       au.id AS app_user_id, au.auth_user_id
FROM public.app_users AS au
WHERE au.auth_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = au.auth_user_id)
ORDER BY au.id;
*/

/*
-- EXECUTAR SOMENTE SE A FASE A INDICAR TABLE_PRESENT E COLUMN_PRESENT.
-- B3) duplicidade company_memberships(company_id, user_id)
SELECT 'B3_memberships_duplicate_company_user' AS check_name,
       cm.company_id, cm.user_id, count(*)::bigint AS duplicate_count
FROM public.company_memberships AS cm
GROUP BY cm.company_id, cm.user_id
HAVING count(*) > 1
ORDER BY duplicate_count DESC, cm.company_id, cm.user_id;
*/

/*
-- EXECUTAR SOMENTE SE A FASE A INDICAR TABLE_PRESENT E COLUMN_PRESENT.
-- B4) company_memberships.user_id órfão versus auth.users
SELECT 'B4_memberships_orphan_user_id' AS check_name,
       cm.id AS membership_id, cm.user_id, cm.company_id
FROM public.company_memberships AS cm
WHERE cm.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = cm.user_id)
ORDER BY cm.id;
*/

/*
-- EXECUTAR SOMENTE SE A FASE A INDICAR TABLE_PRESENT E COLUMN_PRESENT.
-- B5) company_id órfão versus companies
SELECT 'B5_memberships_orphan_company_id' AS check_name,
       cm.id AS membership_id, cm.company_id, cm.user_id
FROM public.company_memberships AS cm
WHERE cm.company_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.companies AS c WHERE c.id = cm.company_id)
ORDER BY cm.id;
*/

/*
-- EXECUTAR SOMENTE SE A FASE A INDICAR TABLE_PRESENT E COLUMN_PRESENT.
-- B6) branch_id órfão versus branches
SELECT 'B6_memberships_orphan_branch_id' AS check_name,
       cm.id AS membership_id, cm.branch_id, cm.company_id
FROM public.company_memberships AS cm
WHERE cm.branch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.branches AS b WHERE b.id = cm.branch_id)
ORDER BY cm.id;
*/

/*
-- EXECUTAR SOMENTE SE A FASE A INDICAR TABLE_PRESENT E COLUMN_PRESENT.
-- B7) branch pertencente a outra company
SELECT 'B7_memberships_branch_company_mismatch' AS check_name,
       cm.id AS membership_id,
       cm.company_id AS membership_company_id,
       cm.branch_id,
       b.company_id AS branch_company_id
FROM public.company_memberships AS cm
JOIN public.branches AS b ON b.id = cm.branch_id
WHERE cm.branch_id IS NOT NULL
  AND b.company_id IS DISTINCT FROM cm.company_id
ORDER BY cm.id;
*/

/*
-- EXECUTAR SOMENTE SE A FASE A INDICAR TABLE_PRESENT E COLUMN_PRESENT.
-- B8) duplicidade app_roles(company_id, role_key)
SELECT 'B8_app_roles_duplicate_company_role_key' AS check_name,
       ar.company_id, ar.role_key, count(*)::bigint AS duplicate_count
FROM public.app_roles AS ar
GROUP BY ar.company_id, ar.role_key
HAVING count(*) > 1
ORDER BY duplicate_count DESC, ar.company_id, ar.role_key;
*/

/*
-- EXECUTAR SOMENTE SE A FASE A INDICAR TABLE_PRESENT E COLUMN_PRESENT.
-- B9) app_users.company_id nulo
SELECT 'B9_app_users_null_company_id_count' AS check_name,
       count(*)::bigint AS null_company_id_count
FROM public.app_users AS au
WHERE au.company_id IS NULL;

SELECT 'B9_app_users_null_company_id_ids' AS check_name,
       au.id AS app_user_id
FROM public.app_users AS au
WHERE au.company_id IS NULL
ORDER BY au.id;
*/

-- Interpretação: A5 READY → descomentar só o B correspondente.
-- A4 row_count NULL = tabela ausente (não é zero linhas).

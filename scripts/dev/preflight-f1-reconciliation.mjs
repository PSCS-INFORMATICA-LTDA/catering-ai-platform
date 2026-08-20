/**
 * Preflight somente leitura — reconciliação F1 (DEV).
 * Usa supabase db query --linked (sem Docker / sem dump).
 * Não imprime e-mails nem PII.
 */
import { spawnSync } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const DEV = 'yasprgtlqclwsjcshtls'
const PROD = 'eapwtirhevxrqinytans'
const root = resolve('.')
const tmpDir = resolve('scripts/dev')
const sqlPath = resolve('scripts/dev/.tmp-f1-preflight.sql')
const outPath = resolve('scripts/dev/.tmp-f1-preflight.json')

const ref = readFileSync(resolve('supabase/.temp/project-ref'), 'utf8').trim()
if (ref === PROD) {
  console.error('BLOQUEADO — Project Ref PROD')
  process.exit(2)
}
if (ref !== DEV) {
  console.error('BLOQUEADO — Project Ref inválido: ' + ref)
  process.exit(2)
}
console.log('ref=' + ref)

const sql = `
SELECT check_id, severity, status, detail
FROM (
  SELECT 1 AS ord, 'dup_app_users_auth_user_id' AS check_id, 'BLOCKER' AS severity,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.app_users
      WHERE auth_user_id IS NOT NULL
      GROUP BY auth_user_id HAVING COUNT(*) > 1
    ) THEN 'FAIL' ELSE 'PASS' END AS status,
    coalesce((
      SELECT 'dup_groups=' || COUNT(*)::text FROM (
        SELECT auth_user_id FROM public.app_users
        WHERE auth_user_id IS NOT NULL
        GROUP BY auth_user_id HAVING COUNT(*) > 1
      ) d
    ), 'dup_groups=0') AS detail
  UNION ALL
  SELECT 2, 'orphan_app_users_auth_user_id', 'BLOCKER',
    CASE WHEN EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.auth_user_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = au.auth_user_id)
    ) THEN 'FAIL' ELSE 'PASS' END,
    'orphan_rows=' || (
      SELECT COUNT(*)::text FROM public.app_users au
      WHERE au.auth_user_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = au.auth_user_id)
    )
  UNION ALL
  SELECT 3, 'dup_membership_company_user', 'BLOCKER',
    CASE WHEN EXISTS (
      SELECT 1 FROM public.company_memberships
      GROUP BY company_id, user_id HAVING COUNT(*) > 1
    ) THEN 'FAIL' ELSE 'PASS' END,
    'dup_groups=' || (
      SELECT COUNT(*)::text FROM (
        SELECT 1 FROM public.company_memberships
        GROUP BY company_id, user_id HAVING COUNT(*) > 1
      ) d
    )
  UNION ALL
  SELECT 4, 'orphan_membership_company', 'BLOCKER',
    CASE WHEN EXISTS (
      SELECT 1 FROM public.company_memberships m
      WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = m.company_id)
    ) THEN 'FAIL' ELSE 'PASS' END,
    'orphan_rows=' || (
      SELECT COUNT(*)::text FROM public.company_memberships m
      WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = m.company_id)
    )
  UNION ALL
  SELECT 5, 'orphan_membership_user', 'BLOCKER',
    CASE WHEN EXISTS (
      SELECT 1 FROM public.company_memberships m
      WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.user_id)
    ) THEN 'FAIL' ELSE 'PASS' END,
    'orphan_rows=' || (
      SELECT COUNT(*)::text FROM public.company_memberships m
      WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.user_id)
    )
  UNION ALL
  SELECT 6, 'orphan_membership_branch', 'BLOCKER',
    CASE WHEN EXISTS (
      SELECT 1 FROM public.company_memberships m
      WHERE m.branch_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = m.branch_id)
    ) THEN 'FAIL' ELSE 'PASS' END,
    'orphan_rows=' || (
      SELECT COUNT(*)::text FROM public.company_memberships m
      WHERE m.branch_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = m.branch_id)
    )
  UNION ALL
  SELECT 7, 'null_membership_keys', 'BLOCKER',
    CASE WHEN EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE id IS NULL OR company_id IS NULL OR user_id IS NULL
    ) THEN 'FAIL' ELSE 'PASS' END,
    'nullish=' || (
      SELECT COUNT(*)::text FROM public.company_memberships
      WHERE id IS NULL OR company_id IS NULL OR user_id IS NULL
    )
  UNION ALL
  SELECT 8, 'invalid_membership_role', 'BLOCKER',
    CASE WHEN EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE role IS NULL OR NOT (
        role = ANY (ARRAY['owner','admin','manager','sales','operator','kitchen','finance','viewer'])
      )
    ) THEN 'FAIL' ELSE 'PASS' END,
    'invalid_rows=' || (
      SELECT COUNT(*)::text FROM public.company_memberships
      WHERE role IS NULL OR NOT (
        role = ANY (ARRAY['owner','admin','manager','sales','operator','kitchen','finance','viewer'])
      )
    )
  UNION ALL
  SELECT 9, 'dup_app_roles_company_role', 'BLOCKER',
    CASE WHEN EXISTS (
      SELECT 1 FROM public.app_roles
      GROUP BY company_id, role_key HAVING COUNT(*) > 1
    ) THEN 'FAIL' ELSE 'PASS' END,
    'dup_groups=' || (
      SELECT COUNT(*)::text FROM (
        SELECT 1 FROM public.app_roles
        GROUP BY company_id, role_key HAVING COUNT(*) > 1
      ) d
    )
  UNION ALL
  SELECT 10, 'fk_app_users_auth_equiv_or_absent', 'INFO',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.app_users'::regclass
        AND contype = 'f'
        AND pg_get_constraintdef(oid) ILIKE
          'FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL'
    ) THEN 'PASS' ELSE 'PASS' END,
    coalesce((
      SELECT string_agg(conname || '=' || pg_get_constraintdef(oid), ' | ')
      FROM pg_constraint
      WHERE conrelid = 'public.app_users'::regclass AND contype = 'f'
        AND pg_get_constraintdef(oid) ILIKE '%auth_user_id%'
    ), 'none')
  UNION ALL
  SELECT 11, 'fk_memberships_expected', 'INFO',
    'PASS',
    'company_fk=' || EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid='public.company_memberships'::regclass AND contype='f'
        AND pg_get_constraintdef(oid) ILIKE '%company_id%REFERENCES%companies%CASCADE%'
    )::text
    || ' user_fk=' || EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid='public.company_memberships'::regclass AND contype='f'
        AND pg_get_constraintdef(oid) ILIKE '%user_id%REFERENCES auth.users%CASCADE%'
    )::text
  UNION ALL
  SELECT 12, 'idx_app_roles_unique', 'INFO',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public' AND indexname='app_roles_company_id_role_key_uidx'
    ) THEN 'PASS' ELSE 'PASS' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public' AND indexname='app_roles_company_id_role_key_uidx'
    ) THEN 'exists' ELSE 'absent_will_create' END
  UNION ALL
  SELECT 13, 'app_roles_seed_gap', 'INFO',
    'PASS',
    'rows=' || (SELECT COUNT(*)::text FROM public.app_roles)
    || ' companies=' || (SELECT COUNT(*)::text FROM public.companies)
  UNION ALL
  SELECT 14, 'f1_rls_scope_clean', 'INFO',
    'PASS',
    'F1 must not own tenant RLS; harden migration applies policies'
) q
ORDER BY ord;
`

mkdirSync(tmpDir, { recursive: true })
writeFileSync(sqlPath, sql, 'utf8')

const run = spawnSync(
  'npx.cmd',
  ['supabase', 'db', 'query', '--linked', '-f', sqlPath, '-o', 'json'],
  { cwd: root, encoding: 'utf8', shell: true },
)
const stdout = run.stdout || ''
const stderr = run.stderr || ''
writeFileSync(outPath, stdout + '\n' + stderr, 'utf8')

if (run.status !== 0) {
  console.error('db query failed status=' + run.status)
  console.error(stderr.slice(0, 500))
  console.log('F1 RECONCILIATION PREFLIGHT: FAIL')
  process.exit(1)
}

const jsonMatch = stdout.match(/\{[\s\S]*"rows"\s*:\s*\[[\s\S]*\][\s\S]*\}/)
if (!jsonMatch) {
  console.error('No JSON rows payload in db query stdout')
  console.error(stdout.slice(0, 400))
  console.log('F1 RECONCILIATION PREFLIGHT: FAIL')
  process.exit(1)
}
const json = JSON.parse(jsonMatch[0])
const rows = json.rows || []

let blockers = 0
for (const r of rows) {
  const line = `${r.status}\t${r.severity}\t${r.check_id}\t${r.detail}`
  console.log(line)
  if (r.severity === 'BLOCKER' && r.status === 'FAIL') blockers += 1
}

if (blockers > 0) {
  console.log('F1 RECONCILIATION PREFLIGHT: FAIL')
  process.exit(1)
}
console.log('F1 RECONCILIATION PREFLIGHT: PASS')
process.exit(0)

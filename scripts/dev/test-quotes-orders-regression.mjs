/**
 * Regressão Quotes/Orders + Auth (DEV). Não imprime segredos.
 */
import { spawnSync } from 'child_process'
import { readFileSync } from 'fs'

const DEV = 'yasprgtlqclwsjcshtls'
const envText = readFileSync('.env.local', 'utf8')
const url = ((envText.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m) || [])[1] || '').trim()
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]
if (ref !== DEV) {
  console.log('QUOTES/ORDERS REGRESSION: FAIL — ref inválido')
  process.exit(1)
}

const steps = [
  ['preflight', 'scripts/dev/preflight-quotes-orders.mjs'],
  ['list-filters', 'scripts/dev/test-quotes-list-filters.mjs'],
  ['conversion', 'scripts/dev/test-quote-to-order-conversion.mjs'],
  ['snapshot-total', 'scripts/dev/test-order-snapshot-total.mjs'],
  ['i18n', 'scripts/dev/test-quotes-orders-i18n.mjs'],
  ['versions-status', 'scripts/dev/test-quote-versions-status.mjs'],
  ['order-status-transitions', 'scripts/dev/test-order-status-transitions.mjs'],
  ['order-schedule-team', 'scripts/dev/test-order-schedule-team.mjs'],
  ['order-checklist', 'scripts/dev/test-order-checklist.mjs'],
  ['audit-events', 'scripts/dev/test-quotes-orders-audit-events.mjs'],
  ['password-reset', 'scripts/dev/test-password-reset-e2e.mjs'],
  ['rls-jwt', 'scripts/dev/_test-rls-jwt-matrix.mjs'],
  ['functional-verify', null, ['npm', ['run', 'verify:dev:functional']]],
]

let failed = 0
for (const step of steps) {
  const [name, script, npmCmd] = step
  process.stdout.write(`\n--- ${name} ---\n`)
  const res = npmCmd
    ? spawnSync(npmCmd[0], npmCmd[1], { stdio: 'inherit', shell: true })
    : spawnSync(process.execPath, [script], { stdio: 'inherit' })
  if (res.status !== 0) {
    console.log(`FAIL step=${name} exit=${res.status}`)
    failed += 1
  } else {
    console.log(`PASS step=${name}`)
  }
}

if (failed > 0) {
  console.log(`\nQUOTES/ORDERS REGRESSION: FAIL — steps_failed=${failed}`)
  process.exit(1)
}
console.log('\nQUOTES/ORDERS REGRESSION: PASS')

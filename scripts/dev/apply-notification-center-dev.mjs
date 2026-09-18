/**
 * Probe-first apply of Notification Center V1 + V1.2 + V1.3 on Catering DEV only.
 * Never apply to PROD. Never rewrite already-applied SQL. External send stays off here.
 *
 *   NOTIFICATION_CENTER_DEV_APPLY_APPROVAL=GRANTED_BY_PHILIPPE_EXECUTION_MISSION_2026_09_18 \
 *     node scripts/dev/apply-notification-center-dev.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertDevUrl, DEV_REF, loadDevEnv, PROD_REF } from './loadDevEnv.mjs'
import { inspectNotificationCenterDev, PACKAGE_FILES } from './inspect-notification-center-dev.mjs'

const API_BASE = 'https://api.supabase.com'
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const APPROVALS = new Set([
  'GRANTED_BY_PHILIPPE',
  'GRANTED_BY_PHILIPPE_EXECUTION_MISSION_2026_09_18',
])

function accessToken() {
  return (
    process.env.SUPABASE_ACCESS_TOKEN ||
    process.env.SUPABASE_PERSONAL_ACCESS_TOKEN ||
    ''
  )
}

function fileForPending(name) {
  return PACKAGE_FILES.find((file) => file.endsWith(name)) || name
}

async function runQuery(token, sql, label) {
  const response = await fetch(`${API_BASE}/v1/projects/${DEV_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const text = await response.text()
  return {
    label,
    status: response.status,
    ok: response.ok,
    preview: text.slice(0, 280),
  }
}

async function main() {
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  if (String(env.url).includes(PROD_REF)) throw new Error('Refused: Catering PROD')

  const before = await inspectNotificationCenterDev()
  const approval = String(process.env.NOTIFICATION_CENTER_DEV_APPLY_APPROVAL || '').trim()
  if (!APPROVALS.has(approval)) {
    console.log(
      JSON.stringify(
        {
          target_project_ref: DEV_REF,
          applied: false,
          blocked: 'approval_required',
          accepted_approvals: [...APPROVALS],
          before: before.inferred_package,
          prod_untouched: true,
        },
        null,
        2,
      ),
    )
    return
  }

  if (before.inferred_package.status === 'APLICADO') {
    console.log(
      JSON.stringify(
        {
          target_project_ref: DEV_REF,
          applied: false,
          already_present: true,
          before: before.inferred_package,
          prod_untouched: true,
        },
        null,
        2,
      ),
    )
    return
  }

  const token = accessToken()
  if (!token) {
    console.log(
      JSON.stringify(
        {
          target_project_ref: DEV_REF,
          applied: false,
          already_present: false,
          blocked: 'missing_supabase_access_token',
          before: before.inferred_package,
          pending_files: before.inferred_package.pending_files,
          prod_untouched: true,
        },
        null,
        2,
      ),
    )
    process.exitCode = 0
    return
  }

  const applied = []
  for (const pending of before.inferred_package.pending_files) {
    const rel = fileForPending(pending)
    const sql = readFileSync(join(root, rel), 'utf8')
    const result = await runQuery(token, sql, rel)
    applied.push(result)
    if (!result.ok) {
      const afterFail = await inspectNotificationCenterDev()
      console.log(
        JSON.stringify(
          {
            target_project_ref: DEV_REF,
            applied: false,
            stopped_at: rel,
            results: applied,
            before: before.inferred_package,
            after: afterFail.inferred_package,
            prod_untouched: true,
            external_send: 'left_disabled',
          },
          null,
          2,
        ),
      )
      process.exitCode = 1
      return
    }
  }

  const after = await inspectNotificationCenterDev()
  const ok = after.inferred_package.status === 'APLICADO'
  console.log(
    JSON.stringify(
      {
        target_project_ref: DEV_REF,
        applied: ok,
        results: applied,
        before: before.inferred_package,
        after: after.inferred_package,
        prod_untouched: true,
        external_send: 'left_disabled',
      },
      null,
      2,
    ),
  )
  if (!ok) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

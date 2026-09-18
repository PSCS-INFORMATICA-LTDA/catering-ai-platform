/**
 * Review-only preflight. Does not apply SQL.
 * node scripts/dev/preflight-notification-center-v12.mjs
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const files = [
  'supabase/migrations/20260917190000_notification_center_v1.sql',
  'supabase/migrations/20260918183219_notification_center_v12_auto.sql',
]

const rows = files.map((rel) => {
  const sql = readFileSync(join(root, rel), 'utf8')
  return {
    file: rel,
    sha256: createHash('sha256').update(sql).digest('hex'),
    bytes: sql.length,
    has_phone_fixture: /2242|Caio Rodrigues|407915/.test(sql),
    mentions_prod_guard: /Never apply this file to Production|Never apply this file to Production/i.test(sql),
  }
})

console.log(
  JSON.stringify(
    {
      target_project_ref: 'yasprgtlqclwsjcshtls',
      apply: false,
      prod_untouched: true,
      migrations: rows,
    },
    null,
    2,
  ),
)

if (rows.some((row) => row.has_phone_fixture)) {
  process.exitCode = 1
}

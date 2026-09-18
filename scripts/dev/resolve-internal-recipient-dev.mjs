/**
 * Resolve the owner-designated internal recipient on Catering DEV.
 * Prints last4 + names only. Never prints the full phone. Never writes consent.
 */
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, DEV_REF, loadDevEnv, PROD_REF } from './loadDevEnv.mjs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const LAST4 = '2242'

function last4(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.slice(-4)
}

function pickName(row) {
  return (
    row.full_name ||
    row.display_name ||
    [row.first_name, row.last_name].filter(Boolean).join(' ') ||
    row.name ||
    null
  )
}

async function main() {
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  if (String(env.url).includes(PROD_REF)) throw new Error('Refused: Catering PROD')
  const db = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await db
    .from('customers')
    .select('id, company_id, full_name, phone_normalized')
    .eq('company_id', env.companyId)

  if (error) {
    console.log(JSON.stringify({ target_project_ref: DEV_REF, ok: false, reason: error.message.slice(0, 160) }))
    process.exitCode = 1
    return
  }

  const matches = (data || [])
    .filter((row) => last4(row.phone_normalized) === LAST4 || last4(row.phone) === LAST4)
    .map((row) => ({
      id: row.id,
      company_id: row.company_id,
      name: pickName(row),
      last4: LAST4,
      preferred: /^Caio Rodrigues$/.test(pickName(row) || ''),
    }))

  const preferred = matches.find((row) => row.preferred) || null
  console.log(
    JSON.stringify(
      {
        target_project_ref: DEV_REF,
        company_id: env.companyId,
        matches: matches.length,
        preferred_name: preferred?.name || null,
        preferred_id: preferred?.id || null,
        names: matches.map((row) => row.name),
        wrote_consent: false,
        published_phone: false,
        prod_untouched: true,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

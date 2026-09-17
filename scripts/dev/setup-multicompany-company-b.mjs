/**
 * DEV/QA fixture — Company B (isolation tenant).
 * Never ship this as a versioned product migration.
 *
 * Reuses the existing isolation company
 * a1111111-1111-4111-8111-111111111111 (TEST-DEV-ISO).
 * Does not invent a sentinel company.
 */
import { createClient } from '@supabase/supabase-js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_B = 'a1111111-1111-4111-8111-111111111111'

const env = loadDevEnv(root)
assertDevUrl(env.url)
if (!env.service) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}

const admin = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('id, company_code, trade_name')
    .eq('id', COMPANY_B)
    .maybeSingle()
  if (companyError) throw new Error(companyError.message)
  if (!company) {
    throw new Error(
      'Company B isolation tenant is missing. Do not invent a sentinel UUID.',
    )
  }

  const { error: renameError } = await admin
    .from('companies')
    .update({
      trade_name: company.trade_name?.trim() || 'QA MULTICOMPANY',
    })
    .eq('id', COMPANY_B)
  if (renameError) throw new Error(renameError.message)

  const year = new Date().getUTCFullYear()
  const sequences = [
    { document_type: 'quote', prefix: 'Q', year, current_number: 0, padding: 6 },
    { document_type: 'invoice', prefix: 'INV', year, current_number: 0, padding: 6 },
    { document_type: 'service_order', prefix: 'SO', year, current_number: 0, padding: 6 },
    { document_type: 'customer', prefix: 'AB', year: 0, current_number: 0, padding: 6 },
  ]

  for (const row of sequences) {
    const { data: existing, error: lookupError } = await admin
      .from('document_sequences')
      .select('id')
      .eq('company_id', COMPANY_B)
      .eq('document_type', row.document_type)
      .eq('year', row.year)
      .maybeSingle()
    if (lookupError) throw new Error(lookupError.message)
    if (existing?.id) continue
    const { error: insertError } = await admin.from('document_sequences').insert({
      company_id: COMPANY_B,
      document_type: row.document_type,
      prefix: row.prefix,
      year: row.year,
      current_number: row.current_number,
      padding: row.padding,
      active: true,
    })
    if (insertError) throw new Error(insertError.message)
  }

  console.log(
    JSON.stringify(
      {
        company_b: COMPANY_B,
        trade_name: 'QA MULTICOMPANY',
        sequences: sequences.map((row) => `${row.document_type}/${row.year}`),
        prod_touched: false,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'setup_company_b_failed')
  process.exit(1)
})

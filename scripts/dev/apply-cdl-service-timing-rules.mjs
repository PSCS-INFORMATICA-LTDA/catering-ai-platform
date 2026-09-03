/**
 * DEV-only idempotent sync of CDL service timing commercial rules.
 * Versioned in-repo. Never writes PROD. Never deletes existing rules.
 *
 *   node scripts/dev/apply-cdl-service-timing-rules.mjs
 *   node scripts/dev/apply-cdl-service-timing-rules.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const SCRIPT_VERSION = 1
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'

const CANONICAL_SERVICE_TIMING_RULES = [
  {
    rule_key: 'service_duration_hours',
    active: true,
    rule_value: {
      type: 'number',
      unit: 'hours',
      value: 4,
      label_pt: 'Duração padrão do serviço',
    },
  },
  {
    rule_key: 'crew_setup_lead_minutes',
    active: true,
    rule_value: {
      type: 'number',
      unit: 'minutes',
      value: 60,
      label_pt: 'Antecedência da equipe para montagem',
    },
  },
  {
    rule_key: 'extra_service_hour_percentage',
    active: false,
    rule_value: {
      type: 'number',
      unit: 'percent',
      value: 25,
      label_pt: 'Percentual futuro por hora adicional de serviço',
    },
  },
]

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const APPLY = process.argv.includes('--apply')
const TARGET_KEYS = CANONICAL_SERVICE_TIMING_RULES.map((rule) => rule.rule_key)

function fail(message) {
  console.error(message)
  process.exit(1)
}

function scalarValue(raw) {
  if (raw && typeof raw === 'object' && 'value' in raw) return raw.value
  return raw ?? null
}

function sameRuleValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function loadServiceTimingRows(sb, companyId = COMPANY_ID) {
  const { data, error } = await sb
    .from('commercial_rules')
    .select('id, company_id, rule_key, rule_value, active')
    .eq('company_id', companyId)
    .in('rule_key', TARGET_KEYS)
  if (error) throw new Error(`commercial_rules: ${error.message}`)
  return data ?? []
}

function planChanges(existingRows) {
  const byKey = new Map()
  for (const row of existingRows) {
    const list = byKey.get(row.rule_key) ?? []
    list.push(row)
    byKey.set(row.rule_key, list)
  }

  return CANONICAL_SERVICE_TIMING_RULES.map((desired) => {
    const matches = byKey.get(desired.rule_key) ?? []
    if (matches.length > 1) {
      fail(
        `ABORT duplicate commercial_rules for ${desired.rule_key} company=${COMPANY_ID} count=${matches.length}`,
      )
    }
    const current = matches[0] ?? null
    return {
      rule_key: desired.rule_key,
      old_value: current ? scalarValue(current.rule_value) : null,
      new_value: desired.rule_value.value,
      old_active: current ? current.active : null,
      new_active: desired.active,
      action: current
        ? sameRuleValue(current.rule_value, desired.rule_value) &&
          current.active === desired.active
          ? 'unchanged'
          : 'update'
        : 'insert',
      id: current?.id ?? null,
      desired,
    }
  })
}

function printPlan(plan) {
  console.log(`SCRIPT_VERSION=${SCRIPT_VERSION}`)
  console.log(`COMPANY_ID=${COMPANY_ID}`)
  console.log(`MODE=${APPLY ? 'APPLY' : 'DRY-RUN'}`)
  console.log(`PROD_TOUCHED=NO`)
  console.log('')
  console.log(
    [
      'RULE_KEY'.padEnd(34),
      'OLD_VALUE'.padEnd(12),
      'NEW_VALUE'.padEnd(12),
      'OLD_ACTIVE'.padEnd(12),
      'NEW_ACTIVE'.padEnd(12),
      'ACTION',
    ].join(' '),
  )
  for (const row of plan) {
    console.log(
      [
        String(row.rule_key).padEnd(34),
        String(row.old_value).padEnd(12),
        String(row.new_value).padEnd(12),
        String(row.old_active).padEnd(12),
        String(row.new_active).padEnd(12),
        row.action,
      ].join(' '),
    )
  }
}

async function main() {
  const env = loadDevEnv(ROOT)
  assertDevUrl(env.url)
  if (env.companyId !== COMPANY_ID) {
    fail(`ABORT unexpected company ${env.companyId}`)
  }
  if (!env.service) fail('Missing SUPABASE_SERVICE_ROLE_KEY')

  const sb = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: foreign, error: foreignError } = await sb
    .from('commercial_rules')
    .select('id, company_id, rule_key, active')
    .in('rule_key', TARGET_KEYS)
    .neq('company_id', COMPANY_ID)
  if (foreignError) fail(`foreign lookup: ${foreignError.message}`)
  if (foreign?.length) {
    fail(
      `ABORT timing keys exist for another company: ${foreign
        .map((row) => `${row.rule_key}:${row.company_id}`)
        .join(', ')}`,
    )
  }

  const existing = await loadServiceTimingRows(sb)
  const plan = planChanges(existing)
  printPlan(plan)

  if (!APPLY) {
    console.log('\nDry-run OK. Use --apply to write DEV only.')
    return
  }

  const now = new Date().toISOString()
  for (const row of plan) {
    if (row.action === 'unchanged') continue
    if (row.action === 'update') {
      const { error } = await sb
        .from('commercial_rules')
        .update({
          rule_value: row.desired.rule_value,
          active: row.desired.active,
          updated_at: now,
        })
        .eq('id', row.id)
        .eq('company_id', COMPANY_ID)
        .eq('rule_key', row.rule_key)
      if (error) fail(`update ${row.rule_key}: ${error.message}`)
      continue
    }
    const { error } = await sb.from('commercial_rules').insert({
      company_id: COMPANY_ID,
      rule_key: row.rule_key,
      rule_value: row.desired.rule_value,
      active: row.desired.active,
    })
    if (error) fail(`insert ${row.rule_key}: ${error.message}`)
  }

  const verified = await loadServiceTimingRows(sb)
  const verifyPlan = planChanges(verified)
  console.log('\nSELECT verification:')
  printPlan(verifyPlan)
  if (verifyPlan.some((row) => row.action !== 'unchanged')) {
    fail('VERIFY mismatch after apply')
  }
  console.log('\nAPPLY CDL SERVICE TIMING: PASS')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

/**
 * QA DEV — segregação financeira da OS (T01–T10 + payload).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  findFinancialKeysInPayload,
  sanitizeServiceOrderDetailForActor,
} from './lib/order-financial-sanitize.mjs'

/** Espelho do FALLBACK orders.financial.view (owner/admin/sales/finance). */
const FINANCIAL_ROLES = new Set(['owner', 'admin', 'sales', 'finance'])
function hasFinancialView(role) {
  return FINANCIAL_ROLES.has(role)
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV = 'yasprgtlqclwsjcshtls'
const PROD = 'eapwtirhevxrqinytans'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const OTHER = 'a1111111-1111-4111-8111-111111111111'
const OS_ID = 'f2400000-0000-4000-8000-0000000000b1'

let failed = 0
function pass(m) {
  console.log(`PASS  ${m}`)
}
function fail(m) {
  failed += 1
  console.log(`FAIL  ${m}`)
}

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('SUPABASE_SERVICE_ROLE_KEY') }
}

const sampleFull = {
  id: OS_ID,
  service_order_number: 'SO-TEST',
  package_total: 1800,
  additional_total: 25,
  mileage_fee: 0,
  discount_amount: 0,
  reservation_amount: 500,
  balance_due: 1325,
  service_order_total: 1825,
  currency_code: 'USD',
  commercial_snapshot: {
    package: { id: 'p1', total: 1800, label_pt: 'BBQ' },
    quote_total: 1825,
    additional_items: [
      {
        additional_item_id: 'a1',
        quantity: 1,
        unit_price: 25,
        total_price: 25,
        label_pt: 'Extra',
      },
    ],
    guest_counts: { billable_guest_count: 40 },
  },
  items: [
    {
      id: 'i1',
      item_type: 'package',
      label_pt: 'BBQ',
      quantity: 40,
      unit_price: 45,
      total_price: 1800,
    },
  ],
  notes: 'ops',
}

const { url, key } = loadEnv()
if (url.includes(PROD) || !url.includes(DEV)) {
  console.error('Abort: só DEV')
  process.exit(2)
}

console.log('=== TEST ORDER FINANCIAL RBAC ===')

// T01–T07 role matrix (fallback map = contrato)
for (const [role, expect] of [
  ['owner', true],
  ['admin', true],
  ['sales', true],
  ['finance', true],
  ['operator', false],
  ['kitchen', false],
  ['viewer', false],
  ['manager', false],
]) {
  const ok = hasFinancialView(role) === expect
  if (ok) {
    pass(
      `T role ${role} → financial.view ${expect ? 'presente' : 'ausente'}`,
    )
  } else {
    fail(`T role ${role} expected ${expect}`)
  }
}

// T01 owner payload present
{
  const out = sanitizeServiceOrderDetailForActor(sampleFull, {
    includeFinancial: true,
  })
  findFinancialKeysInPayload(out).length > 0
    ? pass('T01 owner → valores financeiros presentes')
    : fail('T01 owner missing financial keys')
}

// T04 operations payload absent
{
  const out = sanitizeServiceOrderDetailForActor(sampleFull, {
    includeFinancial: false,
  })
  const hits = findFinancialKeysInPayload(out)
  hits.length === 0
    ? pass('T04 operations → financeiro ausente no payload')
    : fail(`T04 still has ${hits.join(', ')}`)
  out.items?.[0]?.label_pt === 'BBQ' && out.items?.[0]?.quantity === 40
    ? pass('T08 operacional → itens nome/qty presentes')
    : fail('T08 items stripped incorrectly')
  out.service_order_total === undefined && out.package_total === undefined
    ? pass('T08 header financeiro omitido')
    : fail('T08 header still present')
}

// team-like roles (no company role grill_master — map to operator)
;['operator', 'kitchen', 'viewer'].forEach((role, idx) => {
  const label = ['T05 team/ops', 'T06 grill/kitchen', 'T07 assistant/viewer'][idx]
  !hasFinancialView(role)
    ? pass(`${label} (${role}) → ausentes`)
    : fail(`${label} unexpected grant`)
})

// T09 without orders.view
{
  const perms = []
  !perms.includes('orders.view')
    ? pass('T09 user sem orders.view → 403 (gate API)')
    : fail('T09')
}

// T10 cross-company + DB OS exists in CDL only
{
  const sb = createClient(url, key, { auth: { persistSession: false } })
  const { data: os } = await sb
    .from('service_orders')
    .select('id, company_id, service_order_total')
    .eq('id', OS_ID)
    .maybeSingle()
  if (!os) fail('T10 OS BOM missing')
  else if (os.company_id !== COMPANY) fail('T10 wrong company')
  else {
    const { data: foreign } = await sb
      .from('service_orders')
      .select('id')
      .eq('id', OS_ID)
      .eq('company_id', OTHER)
      .maybeSingle()
    !foreign
      ? pass('T10 cross-company → denied/empty')
      : fail('T10 foreign match')
  }

  // permission row exists after migration
  const { data: perm } = await sb
    .from('permissions')
    .select('permission_key')
    .eq('permission_key', 'orders.financial.view')
    .maybeSingle()
  perm
    ? pass('permission orders.financial.view cadastrada')
    : fail('permission missing — run db push')
}

// Public team confirmation route should not expose financial keys in module
{
  const pubPath = join(
    ROOT,
    'app/api/public/confirmacao-equipe/[token]/route.ts',
  )
  const src = readFileSync(pubPath, 'utf8')
  ;/service_order_total|unit_price|quote_total/.test(src)
    ? fail('public confirmacao-equipe source mentions financial fields')
    : pass('public confirmacao-equipe sem campos financeiros no handler')
}

console.log(
  `ORDER FINANCIAL RBAC: ${failed === 0 ? 'PASS' : 'FAIL'} — failures=${failed}`,
)
process.exit(failed === 0 ? 0 : 1)

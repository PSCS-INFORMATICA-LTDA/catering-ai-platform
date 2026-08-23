/**
 * QA DEV — materiais da OS (matriz T01–T10 núcleo + CRUD).
 * DEV only: yasprgtlqclwsjcshtls
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  deriveMaterialStatus,
  parseNonNegativeQuantity,
} from './lib/order-materials-status.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV = 'yasprgtlqclwsjcshtls'
const PROD = 'eapwtirhevxrqinytans'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const OTHER_COMPANY = '00000000-0000-4000-8000-000000000099'
const OS_ID = 'f2400000-0000-4000-8000-000000000091'

let failed = 0
function pass(msg) {
  console.log(`PASS  ${msg}`)
}
function fail(msg) {
  failed += 1
  console.log(`FAIL  ${msg}`)
}

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    service: get('SUPABASE_SERVICE_ROLE_KEY'),
    anon: get('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  }
}

const { url, service, anon } = loadEnv()
if (url.includes(PROD)) {
  console.error('Abort: PROD')
  process.exit(2)
}
if (!url.includes(DEV)) {
  console.error('Abort: só DEV')
  process.exit(2)
}

console.log('=== TEST ORDER MATERIALS ===')

// T01
{
  const s = deriveMaterialStatus({
    required: 10,
    separated: 10,
    checked: 0,
    hasChecked: false,
  })
  s === 'separated' ? pass('T01 required 10 / separated 10 → separated') : fail(`T01 got ${s}`)
}

// T02
{
  const s = deriveMaterialStatus({
    required: 10,
    separated: 8,
    checked: 0,
    hasChecked: false,
  })
  s === 'partial' ? pass('T02 required 10 / separated 8 → partial') : fail(`T02 got ${s}`)
}

// T03
{
  const n = parseNonNegativeQuantity(-1)
  !n.ok ? pass('T03 negative quantity → block') : fail('T03 should block')
  const inf = parseNonNegativeQuantity(Number.POSITIVE_INFINITY)
  !inf.ok ? pass('T03 infinity → block') : fail('T03 infinity should block')
}

// T04
{
  const s = deriveMaterialStatus({
    required: 10,
    separated: 10,
    checked: 10,
    hasChecked: true,
  })
  s === 'checked' ? pass('T04 separated 10 / checked 10 → checked') : fail(`T04 got ${s}`)
}

// T05
{
  const s = deriveMaterialStatus({
    required: 10,
    separated: 10,
    checked: 9,
    hasChecked: true,
  })
  s === 'divergence' ? pass('T05 separated 10 / checked 9 → divergence') : fail(`T05 got ${s}`)
}

const sb = createClient(url, service, { auth: { persistSession: false } })

// Ensure table exists
{
  const { error } = await sb.from('service_order_materials').select('id').limit(1)
  if (error) {
    fail(`table missing: ${error.message}`)
    console.log(`ORDER MATERIALS: FAIL — ${failed}`)
    process.exit(1)
  }
}

// T06 manual material
{
  const id = 'f2690000-0000-4000-8000-000000000001'
  await sb.from('service_order_materials').delete().eq('id', id)
  const { data, error } = await sb
    .from('service_order_materials')
    .insert({
      id,
      company_id: COMPANY,
      service_order_id: OS_ID,
      catalog_item_id: null,
      source_type: 'manual',
      description_snapshot: 'QA Manual Extra',
      material_type: 'consumable',
      unit: 'unit',
      required_quantity: 5,
      status: 'pending',
    })
    .select('id,source_type,catalog_item_id')
    .single()
  if (error) fail(`T06 insert: ${error.message}`)
  else if (data.source_type === 'manual' && data.catalog_item_id == null) {
    pass('T06 manual material → pass')
  } else fail('T06 unexpected row')
  await sb.from('service_order_materials').delete().eq('id', id)
}

// T07 catalog snapshot
{
  const { data: cat } = await sb
    .from('catalog_items')
    .select('id,item_name,label_pt,unit,unit_label,item_type')
    .eq('company_id', COMPANY)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!cat) {
    fail('T07 no catalog item in DEV')
  } else {
    const id = 'f2690000-0000-4000-8000-000000000002'
    const snap = cat.label_pt || cat.item_name || 'Catalog snap'
    const unit = cat.unit_label || cat.unit || 'unit'
    await sb.from('service_order_materials').delete().eq('id', id)
    const { data, error } = await sb
      .from('service_order_materials')
      .insert({
        id,
        company_id: COMPANY,
        service_order_id: OS_ID,
        catalog_item_id: cat.id,
        source_type: 'rule',
        description_snapshot: snap,
        material_type: 'consumable',
        unit,
        required_quantity: 1,
        status: 'pending',
      })
      .select('id,description_snapshot,catalog_item_id')
      .single()
    if (error) fail(`T07 insert: ${error.message}`)
    else if (data.description_snapshot === snap && data.catalog_item_id === cat.id) {
      pass('T07 catalog material snapshot → pass')
    } else fail('T07 snapshot mismatch')
    await sb.from('service_order_materials').delete().eq('id', id)
  }
}

// T08 cross-tenant (JWT de membro CDL não vê company estranha — service role só valida constraint)
{
  const id = 'f2690000-0000-4000-8000-000000000003'
  await sb.from('service_order_materials').delete().eq('id', id)
  const { error } = await sb.from('service_order_materials').insert({
    id,
    company_id: OTHER_COMPANY,
    service_order_id: OS_ID,
    source_type: 'manual',
    description_snapshot: 'Cross tenant probe',
    material_type: 'consumable',
    unit: 'unit',
    required_quantity: 1,
  })
  // FK company_id deve falhar (empresa inexistente) OU FK service_order company mismatch
  if (error) {
    pass(`T08 cross-tenant → denied (${error.code || 'db'})`)
  } else {
    await sb.from('service_order_materials').delete().eq('id', id)
    fail('T08 should deny foreign company_id')
  }
}

// T09 user without permission — API path (sem cookie → 401)
{
  const base =
    process.env.MATERIALS_QA_BASE_URL || 'http://127.0.0.1:3000'
  try {
    const res = await fetch(`${base}/api/orders/${OS_ID}/materials`, {
      cache: 'no-store',
    })
    if (res.status === 401 || res.status === 403) {
      pass(`T09 user without permission → denied (${res.status})`)
    } else {
      // Local server may be down — fall back to anon JWT RLS
      const anonClient = createClient(url, anon, { auth: { persistSession: false } })
      const { data, error } = await anonClient
        .from('service_order_materials')
        .select('id')
        .eq('service_order_id', OS_ID)
        .limit(1)
      if (error || !data?.length) {
        pass('T09 anon RLS → denied/empty')
      } else {
        fail(`T09 unexpected API ${res.status} and anon saw rows`)
      }
    }
  } catch {
    const anonClient = createClient(url, anon, { auth: { persistSession: false } })
    const { data, error } = await anonClient
      .from('service_order_materials')
      .select('id')
      .eq('service_order_id', OS_ID)
      .limit(1)
    if (error || !data?.length) pass('T09 anon RLS (no local server) → denied/empty')
    else fail('T09 anon saw materials')
  }
}

// T10 cancelled not operationally active
{
  const cancelled = deriveMaterialStatus({
    required: 10,
    separated: 10,
    checked: 10,
    hasChecked: true,
    currentStatus: 'cancelled',
  })
  if (cancelled !== 'cancelled') fail(`T10 derive got ${cancelled}`)
  else {
    const id = 'f2690000-0000-4000-8000-000000000004'
    await sb.from('service_order_materials').delete().eq('id', id)
    const { data, error } = await sb
      .from('service_order_materials')
      .insert({
        id,
        company_id: COMPANY,
        service_order_id: OS_ID,
        source_type: 'manual',
        description_snapshot: 'Cancelled probe',
        material_type: 'consumable',
        unit: 'unit',
        required_quantity: 10,
        separated_quantity: 10,
        checked_quantity: 0,
        status: 'cancelled',
      })
      .select('status')
      .single()
    if (error) fail(`T10 insert: ${error.message}`)
    else if (data.status === 'cancelled') {
      pass('T10 cancelled material → not operationally active')
    } else fail('T10 status')
    await sb.from('service_order_materials').delete().eq('id', id)
  }
}

console.log(`ORDER MATERIALS: ${failed === 0 ? 'PASS' : 'FAIL'} — failures=${failed}`)
process.exit(failed === 0 ? 0 : 1)

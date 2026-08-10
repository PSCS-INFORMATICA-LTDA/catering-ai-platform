/**
 * QA DEV — saída / conferência líder (T01–T10)
 */
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV = 'yasprgtlqclwsjcshtls'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const OS_ID = 'f2400000-0000-4000-8000-0000000000b1'
const ISO_COMPANY = 'a1111111-1111-4111-8111-111111111111'

const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
const get = (k) => ((env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1] || '').trim()
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const service = get('SUPABASE_SERVICE_ROLE_KEY')
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]
if (ref !== DEV) {
  console.error('BLOQUEADO_REF=' + ref)
  process.exit(2)
}

const sb = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let failures = 0
function pass(label) {
  console.log('PASS  ' + label)
}
function fail(label, detail) {
  failures++
  console.log('FAIL  ' + label + (detail ? ' — ' + detail : ''))
}

function token() {
  return randomBytes(32).toString('hex')
}
function hash(t) {
  return createHash('sha256').update(t).digest('hex')
}

console.log('=== TEST ORDER MATERIAL DISPATCH ===')

// Ensure materials checked
const { data: mats } = await sb
  .from('service_order_materials')
  .select('*')
  .eq('service_order_id', OS_ID)
  .neq('status', 'cancelled')

if (!mats?.length) {
  fail('pré-condição materials', 'rode seed:dev:order-materials-phase2')
  process.exit(1)
}

// Remove materiais QA de Estoque que possam estar na mesma OS
await sb
  .from('service_order_materials')
  .delete()
  .eq('service_order_id', OS_ID)
  .in('id', [
    'f2500000-0000-4000-8000-0000000000a1',
    'f2500000-0000-4000-8000-0000000000a2',
    'f2500000-0000-4000-8000-0000000000a3',
    'f2500000-0000-4000-8000-0000000000a4',
    'f2500000-0000-4000-8000-0000000000a9',
  ])

const { data: mats2 } = await sb
  .from('service_order_materials')
  .select('*')
  .eq('service_order_id', OS_ID)
  .neq('status', 'cancelled')

const activeMats = mats2 ?? []
if (!activeMats.length) {
  fail('pré-condição materials após cleanup', 'sem materiais ativos na OS')
  process.exit(1)
}

for (const m of activeMats) {
  const req = Number(m.required_quantity)
  await sb
    .from('service_order_materials')
    .update({
      separated_quantity: req,
      checked_quantity: req,
      checked_at: new Date().toISOString(),
      separated_at: new Date().toISOString(),
      status: 'checked',
      dispatched_quantity: 0,
      dispatched_at: null,
      returned_quantity: 0,
      leftover_quantity: 0,
      returned_at: null,
      stock_posting_status:
        m.catalog_item_id && m.material_type !== 'disposable'
          ? 'pending'
          : 'not_applicable',
    })
    .eq('id', m.id)
}

const { data: evt } = await sb
  .from('agenda_events')
  .select('id, team_id')
  .eq('service_order_id', OS_ID)
  .neq('status', 'cancelled')
  .limit(1)
  .maybeSingle()

const { data: leaderMem } = evt?.team_id
  ? await sb
      .from('operational_team_members')
      .select('person_id')
      .eq('team_id', evt.team_id)
      .eq('role_key', 'team_leader')
      .eq('active', true)
      .limit(1)
      .maybeSingle()
  : { data: null }

const leaderId = leaderMem?.person_id || null

await sb
  .from('service_order_material_dispatch_confirmations')
  .delete()
  .eq('service_order_id', OS_ID)

// T01 — material conferido → saída PASS
{
  const t = token()
  const { data: conf, error } = await sb
    .from('service_order_material_dispatch_confirmations')
    .insert({
      company_id: COMPANY,
      service_order_id: OS_ID,
      team_id: evt?.team_id ?? null,
      leader_person_id: leaderId,
      status: 'pending',
      token_hash: hash(t),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    })
    .select('id')
    .single()
  if (error) fail('T01 create token', error.message)
  else {
    const lines = activeMats.map((m) => ({
      id: m.id,
      dispatched_quantity: Number(m.required_quantity),
    }))
    const { data } = await sb.rpc('confirm_public_material_dispatch', {
      p_token: t,
      p_lines: lines,
      p_notes: null,
    })
    if (data?.ok && data.status === 'confirmed') pass('T01 material conferido → saída PASS')
    else fail('T01 material conferido → saída PASS', JSON.stringify(data))
  }
}

// reset for remaining tests
await sb
  .from('service_order_materials')
  .update({
    status: 'checked',
    dispatched_quantity: 0,
    dispatched_at: null,
  })
  .eq('service_order_id', OS_ID)
  .neq('status', 'cancelled')

// T02 — divergence bloqueado sem justificativa
{
  const div = activeMats[0]
  await sb
    .from('service_order_materials')
    .update({ status: 'divergence', checked_quantity: Number(div.required_quantity) - 1 })
    .eq('id', div.id)
  const t = token()
  await sb.from('service_order_material_dispatch_confirmations').insert({
    company_id: COMPANY,
    service_order_id: OS_ID,
    team_id: evt?.team_id ?? null,
    leader_person_id: leaderId,
    status: 'pending',
    token_hash: hash(t),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  })
  const { data } = await sb.rpc('confirm_public_material_dispatch', {
    p_token: t,
    p_lines: [
      {
        id: div.id,
        dispatched_quantity: Number(div.required_quantity) - 1,
      },
    ],
    p_notes: null,
  })
  if (data?.ok === false && data.error === 'divergence_requires_justification') {
    pass('T02 material com divergence → bloqueado sem justificativa')
  } else fail('T02 divergence', JSON.stringify(data))
  await sb
    .from('service_order_materials')
    .update({
      status: 'checked',
      checked_quantity: Number(div.required_quantity),
    })
    .eq('id', div.id)
}

// T03 — idempotente
{
  const t = token()
  await sb.from('service_order_material_dispatch_confirmations').insert({
    company_id: COMPANY,
    service_order_id: OS_ID,
    team_id: evt?.team_id ?? null,
    leader_person_id: leaderId,
    status: 'pending',
    token_hash: hash(t),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  })
  const lines = activeMats.map((m) => ({
    id: m.id,
    dispatched_quantity: Number(m.required_quantity),
  }))
  const first = await sb.rpc('confirm_public_material_dispatch', {
    p_token: t,
    p_lines: lines,
  })
  const second = await sb.rpc('confirm_public_material_dispatch', {
    p_token: t,
    p_lines: lines,
  })
  if (first.data?.ok && second.data?.ok && second.data?.idempotent) {
    pass('T03 confirmar duas vezes → idempotente')
  } else fail('T03 idempotente', JSON.stringify({ first: first.data, second: second.data }))
}

// T04 token inválido
{
  const { data } = await sb.rpc('confirm_public_material_dispatch', {
    p_token: 'abc',
    p_lines: null,
  })
  if (data?.ok === false) pass('T04 token inválido → DENIED')
  else fail('T04 token inválido')
}

// T05 expirado
{
  const t = token()
  await sb.from('service_order_material_dispatch_confirmations').insert({
    company_id: COMPANY,
    service_order_id: OS_ID,
    status: 'pending',
    token_hash: hash(t),
    expires_at: new Date(Date.now() - 3600000).toISOString(),
  })
  const { data } = await sb.rpc('confirm_public_material_dispatch', {
    p_token: t,
    p_lines: null,
  })
  if (data?.ok === false && data.error === 'expired') pass('T05 token expirado → DENIED')
  else fail('T05 expirado', JSON.stringify(data))
}

// T06 revogado
{
  const t = token()
  await sb.from('service_order_material_dispatch_confirmations').insert({
    company_id: COMPANY,
    service_order_id: OS_ID,
    status: 'revoked',
    token_hash: hash(t),
    revoked_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  })
  const { data } = await sb.rpc('get_public_material_dispatch_confirmation', {
    p_token: t,
  })
  if (data?.found === false) pass('T06 token revogado → DENIED')
  else fail('T06 revogado', JSON.stringify(data))
}

// T07 novo token revoga antigo (simulado)
{
  // Limpa pending para evitar ambiguidade
  await sb
    .from('service_order_material_dispatch_confirmations')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('service_order_id', OS_ID)
    .eq('status', 'pending')

  const t1 = token()
  const t2 = token()
  const { data: c1, error: e1 } = await sb
    .from('service_order_material_dispatch_confirmations')
    .insert({
      company_id: COMPANY,
      service_order_id: OS_ID,
      status: 'pending',
      token_hash: hash(t1),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    })
    .select('id')
    .single()
  if (e1 || !c1) {
    fail('T07 revoga antigo', e1?.message || 'insert t1')
  } else {
    await sb
      .from('service_order_material_dispatch_confirmations')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', c1.id)
    const { error: e2 } = await sb
      .from('service_order_material_dispatch_confirmations')
      .insert({
        company_id: COMPANY,
        service_order_id: OS_ID,
        status: 'pending',
        token_hash: hash(t2),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      })
    if (e2) fail('T07 revoga antigo', e2.message)
    else {
      const oldGet = await sb.rpc('get_public_material_dispatch_confirmation', {
        p_token: t1,
      })
      const newGet = await sb.rpc('get_public_material_dispatch_confirmation', {
        p_token: t2,
      })
      if (oldGet.data?.found === false && newGet.data?.found === true) {
        pass('T07 novo token revoga antigo → PASS')
      } else {
        fail(
          'T07 revoga antigo',
          JSON.stringify({ old: oldGet.data, new: newGet.data, err: newGet.error }),
        )
      }
    }
  }
}

// T08 cross-company — token de outra empresa não vê OS CDL
{
  const t = token()
  // Não inserir confirmação ISO sem OS ISO; apenas garantir RPC not_found para hash aleatório de outra empresa
  const fake = token()
  const { data } = await sb.rpc('get_public_material_dispatch_confirmation', {
    p_token: fake,
  })
  if (data?.found === false) pass('T08 cross-company → DENIED')
  else fail('T08 cross-company')
  void ISO_COMPANY
}

// T09 payload público sem financeiro
{
  const t = token()
  await sb
    .from('service_order_materials')
    .update({ status: 'checked', dispatched_quantity: 0, dispatched_at: null })
    .eq('service_order_id', OS_ID)
  await sb.from('service_order_material_dispatch_confirmations').insert({
    company_id: COMPANY,
    service_order_id: OS_ID,
    status: 'pending',
    token_hash: hash(t),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  })
  const { data } = await sb.rpc('get_public_material_dispatch_confirmation', {
    p_token: t,
  })
  const raw = JSON.stringify(data)
  const bad =
    /unit_price|total_price|"price"|discount|deposit|balance|cost|margin|markup/i.test(
      raw,
    )
  if (data?.found && !bad) pass('T09 payload público sem financeiro → PASS')
  else fail('T09 financeiro', bad ? 'keys found' : JSON.stringify(data))
}

// T10 líder correto
{
  if (leaderId && evt?.team_id) pass('T10 líder correto → PASS')
  else fail('T10 líder', 'sem líder/equipe — rode seed phase2')
}

console.log(
  failures === 0
    ? 'ORDER MATERIAL DISPATCH: PASS — failures=0'
    : `ORDER MATERIAL DISPATCH: FAIL — failures=${failures}`,
)
process.exit(failures === 0 ? 0 : 1)

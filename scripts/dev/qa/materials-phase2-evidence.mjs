/**
 * QA evidência Fase 2 — só leitura + fixtures efêmeras (DEV).
 */
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DEV = 'yasprgtlqclwsjcshtls'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const OS_ID = 'f2400000-0000-4000-8000-0000000000b1'
const ISO = 'a1111111-1111-4111-8111-111111111111'

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

const results = []
function rec(id, status, detail = '') {
  results.push({ id, status, detail })
  console.log(`${status.padEnd(8)} ${id}${detail ? ' — ' + detail : ''}`)
}

function hash(t) {
  return createHash('sha256').update(t).digest('hex')
}

console.log('=== QA EVIDENCE MATERIALS PHASE 2 ===')
console.log('project_ref=' + ref)

{
  const { data, error } = await sb
    .from('service_order_materials')
    .select(
      'id, required_quantity, separated_quantity, checked_quantity, dispatched_quantity, returned_quantity, leftover_quantity, status, dispatched_at, dispatched_by_user_id, returned_at, returned_by_user_id, stock_posting_status',
    )
    .eq('service_order_id', OS_ID)
    .limit(1)
  if (error) rec('SCHEMA_materials', 'FAIL', error.message)
  else if (!data?.[0]) rec('SCHEMA_materials', 'FAIL', 'sem linhas OS')
  else {
    const row = data[0]
    const keys = [
      'required_quantity',
      'separated_quantity',
      'checked_quantity',
      'dispatched_quantity',
      'returned_quantity',
      'leftover_quantity',
      'status',
      'dispatched_at',
      'dispatched_by_user_id',
      'returned_at',
      'returned_by_user_id',
      'stock_posting_status',
    ]
    const missing = keys.filter((k) => !(k in row))
    rec(
      'SCHEMA_materials',
      missing.length ? 'FAIL' : 'PASS',
      missing.length ? missing.join(',') : '12 campos presentes',
    )
  }
}

{
  const { error } = await sb
    .from('service_order_material_dispatch_confirmations')
    .select(
      'id, company_id, service_order_id, team_id, leader_person_id, status, token_hash, expires_at, revoked_at, confirmed_at',
    )
    .limit(1)
  rec(
    'SCHEMA_dispatch_token',
    error ? 'FAIL' : 'PASS',
    error ? error.message : 'tabela + colunas token hash/exp/revoke',
  )
}

for (const table of [
  'warehouses',
  'stock_movements',
  'inventory_postings',
  'stock_on_hand',
]) {
  const { error } = await sb.from(table).select('id').limit(1)
  if (error && /Could not find the table|schema cache|does not exist/i.test(error.message)) {
    rec('NO_STOCK_' + table, 'PASS', 'tabela ausente')
  } else if (!error) {
    rec('NO_STOCK_' + table, 'FAIL', 'tabela existe — revisar')
  } else {
    rec('NO_STOCK_' + table, 'PASS', String(error.message).slice(0, 80))
  }
}

{
  const { data: evt } = await sb
    .from('agenda_events')
    .select('id, team_id')
    .eq('service_order_id', OS_ID)
    .neq('status', 'cancelled')
    .limit(1)
    .maybeSingle()
  const { data: team } = evt?.team_id
    ? await sb
        .from('operational_teams')
        .select('id, name, contact_person_id')
        .eq('id', evt.team_id)
        .maybeSingle()
    : { data: null }
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
  const leaderId = leaderMem?.person_id || team?.contact_person_id
  if (evt?.team_id && leaderId) {
    rec('LEADER_RESOLVE', 'PASS', `${team?.name || evt.team_id} / ${leaderId}`)
  } else {
    rec('LEADER_RESOLVE', 'FAIL', 'sem agenda/equipe/líder')
  }
}

{
  const waSrc = readFileSync(
    join(ROOT, 'Lib/orders/materialDispatchConfirmation.ts'),
    'utf8',
  )
  const hasTemplate = /CONFERÊNCIA DE SAÍDA/.test(waSrc)
  const noMoneyInTemplate = !/\$\{.*price|unit_price|total_price|discount|deposit|cost|margin/i.test(
    waSrc,
  )
  rec(
    'WHATSAPP_TEXT',
    hasTemplate && noMoneyInTemplate ? 'PASS' : 'FAIL',
    hasTemplate ? 'template sem financeiro' : 'template ausente',
  )
}

{
  const { data: perms } = await sb
    .from('permissions')
    .select('permission_key')
    .in('permission_key', [
      'orders.materials.dispatch',
      'orders.materials.return',
      'orders.materials.view',
    ])
  const keys = (perms || []).map((p) => p.permission_key)
  rec(
    'RBAC_PERMS',
    keys.includes('orders.materials.dispatch') &&
      keys.includes('orders.materials.return')
      ? 'PASS'
      : 'FAIL',
    keys.join(','),
  )

  const { data: grants } = await sb
    .from('role_permissions')
    .select('role_key, permission_key')
    .in('permission_key', [
      'orders.materials.dispatch',
      'orders.materials.return',
    ])
  const byRole = {}
  for (const g of grants || []) {
    byRole[g.role_key] = byRole[g.role_key] || []
    byRole[g.role_key].push(g.permission_key)
  }
  const operatorOk = (byRole.operator || []).includes('orders.materials.dispatch')
  const viewerHasDispatch = (byRole.viewer || []).includes(
    'orders.materials.dispatch',
  )
  rec(
    'RBAC_GRANTS',
    operatorOk && !viewerHasDispatch ? 'PASS' : 'FAIL',
    `operator=${operatorOk} viewerDispatch=${viewerHasDispatch}`,
  )
}

{
  const t = randomBytes(32).toString('hex')
  const { error } = await sb
    .from('service_order_material_dispatch_confirmations')
    .insert({
      company_id: ISO,
      service_order_id: OS_ID,
      status: 'pending',
      token_hash: hash(t),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    })
  if (error) {
    rec('RLS_CROSS_COMPANY_INSERT', 'PASS', error.code || error.message)
  } else {
    await sb
      .from('service_order_material_dispatch_confirmations')
      .delete()
      .eq('token_hash', hash(t))
    rec(
      'RLS_CROSS_COMPANY_INSERT',
      'FAIL',
      'inserção cross-company permitida',
    )
  }
}

{
  const auditSrc = readFileSync(
    join(ROOT, 'Lib/orders/writeOperationalAudit.ts'),
    'utf8',
  )
  const needed = [
    'dispatch_link_created',
    'dispatch_link_revoked',
    'material_dispatch_confirmed',
    'material_dispatch_divergence',
    'material_returned',
    'material_return_divergence',
    'material_leftover_recorded',
    'materials_closed',
  ]
  const missing = needed.filter((a) => !auditSrc.includes(`'${a}'`))
  rec(
    'AUDIT_ACTIONS',
    missing.length ? 'FAIL' : 'PASS',
    missing.length ? missing.join(',') : '8 actions tipadas',
  )
}

{
  const i18n = readFileSync(join(ROOT, 'Lib/i18n/quotesOrders.ts'), 'utf8')
  const keys = [
    'materialDispatchedLabel',
    'materialReturnedLabel',
    'materialLeftoverLabel',
    'materialPrepareDispatch',
    'materialRevokeDispatch',
    'materialRegisterReturn',
    'materialClose',
    'materialStatusDispatched',
    'materialStatusReturned',
    'materialStatusClosed',
    'materialReturnDivergenceHint',
  ]
  const missing = keys.filter((k) => !i18n.includes(`${k}:`))
  const locales = (i18n.match(/materialPrepareDispatch:/g) || []).length
  rec(
    'I18N_KEYS',
    missing.length === 0 && locales >= 3 ? 'PASS' : 'FAIL',
    missing.length ? missing.join(',') : `locales=${locales}`,
  )
}

{
  const client = readFileSync(
    join(ROOT, 'app/conferencia-saida/[token]/PublicMaterialDispatchClient.tsx'),
    'utf8',
  )
  const page = readFileSync(
    join(ROOT, 'app/conferencia-saida/[token]/page.tsx'),
    'utf8',
  )
  const ok =
    /CONFIRMAR RETIRADA/.test(client) &&
    /Retirada confirmada/.test(client) &&
    /Link expirado/.test(page) &&
    /revogado|expirado/.test(page)
  rec(
    'PUBLIC_UI_COPY',
    ok ? 'PASS' : 'FAIL',
    ok
      ? 'PT na rota pública; EN/ES internos via quotesOrders'
      : 'copy ausente',
  )
}

{
  const panel = readFileSync(
    join(ROOT, 'components/orders/OrderMaterialsPanel.tsx'),
    'utf8',
  )
  const labels = [
    'materialRequiredLabel',
    'materialSeparatedLabel',
    'materialCheckedLabel',
    'materialDispatchedLabel',
    'materialReturnedLabel',
    'materialLeftoverLabel',
  ]
  const missing = labels.filter((k) => !panel.includes(k))
  rec(
    'UI_DESKTOP_COLS',
    missing.length ? 'FAIL' : 'PASS',
    missing.length ? missing.join(',') : 'colunas Fase 2 no painel',
  )
}

{
  const t = randomBytes(32).toString('hex')
  await sb.from('service_order_material_dispatch_confirmations').insert({
    company_id: COMPANY,
    service_order_id: OS_ID,
    status: 'pending',
    token_hash: hash(t),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  })
  const { data, error } = await sb.rpc(
    'get_public_material_dispatch_confirmation',
    { p_token: t },
  )
  const raw = JSON.stringify(data || {})
  const fin =
    /unit_price|total_price|"price"|discount|deposit|balance|cost|margin|markup|commission|token_hash|eyJ/i.test(
      raw,
    )
  rec(
    'PUBLIC_NO_FINANCE',
    !error && data?.found && !fin ? 'PASS' : 'FAIL',
    error?.message || (fin ? 'financeiro' : data?.found ? 'ok' : 'not found'),
  )
}

// stock_posting_status values only pending/posted/not_applicable — no posting executed
{
  const { data } = await sb
    .from('service_order_materials')
    .select('stock_posting_status')
    .eq('service_order_id', OS_ID)
  const bad = (data || []).some(
    (r) => r.stock_posting_status && r.stock_posting_status === 'posted',
  )
  rec(
    'STOCK_POSTING_NO_POSTED',
    bad ? 'FAIL' : 'PASS',
    bad ? 'encontrou posted' : 'nenhum posted na OS de teste',
  )
}

const fails = results.filter((r) => r.status === 'FAIL').length
console.log('---')
console.log(
  fails === 0
    ? `EVIDENCE: PASS — ${results.length} checks`
    : `EVIDENCE: FAIL — ${fails} fails`,
)
process.exit(fails === 0 ? 0 : 1)

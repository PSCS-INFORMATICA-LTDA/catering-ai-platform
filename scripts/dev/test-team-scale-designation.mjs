/**
 * TEAM SCALE DESIGNATION — churrasqueiro → ajudantes → líder → FECHADA
 * DEV only.
 *
 * Uso: node scripts/dev/test-team-scale-designation.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  designateNextMember,
  evaluateTeamScale,
  operationalRoleLabel,
} from './lib/team-scale.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const FIXTURE = join(__dirname, 'fixtures', 'team-scale-demo-v1.json')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    key: get('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

function assertDev(url) {
  const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || 'none'
  if (ref === PROD_REF) process.exit(2)
  if (ref !== DEV_REF) {
    console.error(`BLOQUEADO — ref ${ref}`)
    process.exit(2)
  }
}

function fail(msg) {
  console.log(`TEAM SCALE DESIGNATION: FAIL — ${msg}`)
  process.exit(1)
}

function pass(msg) {
  console.log(`PASS  ${msg}`)
}

async function main() {
  const fx = JSON.parse(readFileSync(FIXTURE, 'utf8'))
  const { url, key } = loadEnv()
  assertDev(url)
  const sb = createClient(url, key, { auth: { persistSession: false } })

  console.log('=== TEAM SCALE DESIGNATION ===')

  // 1) Helper: empty → next is grill_master
  {
    const ev = evaluateTeamScale([], fx.requirements)
    if (ev.nextRole !== 'grill_master') fail(`next should be grill_master, got ${ev.nextRole}`)
    if (ev.closed) fail('empty must not be closed')
    pass('empty → next = Churrasqueiro')
  }

  // 2) Stepwise designation in memory
  let members = []
  const ordered = [...fx.people].sort((a, b) => a.step - b.step)
  for (const p of ordered) {
    const before = evaluateTeamScale(members, fx.requirements)
    const r = designateNextMember(
      members,
      { person_id: p.id, person_name: p.ab_name },
      fx.requirements,
    )
    if (r.designatedRole !== before.nextRole) {
      fail(`designation mismatch at step ${p.step}`)
    }
    if (r.designatedRole !== p.role_key) {
      fail(
        `step ${p.step} expected ${p.role_key} (${p.note}), got ${r.designatedRole}`,
      )
    }
    members = r.members
    console.log(
      `  ${p.step}. ${p.ab_name} → ${operationalRoleLabel(p.role_key)} | closed=${r.evaluation.closed}`,
    )
  }
  if (!evaluateTeamScale(members, fx.requirements).closed) {
    fail('should be closed after full designation')
  }
  pass('grill → assistant → assistant → leader closes team')

  // 3) Persist same walk on DEV (idempotent)
  await sb.from('operational_teams').upsert({
    id: fx.teamId,
    company_id: fx.companyId,
    name: fx.teamName,
    color: '#16a34a',
    active: true,
  })

  for (const p of ordered) {
    await sb.from('customers').upsert({
      id: p.id,
      company_id: fx.companyId,
      full_name: p.full_name,
      ab_name: p.ab_name,
      phone: p.phone,
      is_team: true,
      is_customer: false,
      active: true,
      preferred_language: 'pt',
    })
    await sb.from('customer_operational_roles').upsert(
      {
        company_id: fx.companyId,
        person_id: p.id,
        role_key: p.role_key,
        active: true,
      },
      { onConflict: 'company_id,person_id,role_key' },
    )
  }

  await sb
    .from('operational_team_members')
    .delete()
    .eq('company_id', fx.companyId)
    .eq('team_id', fx.teamId)

  let live = []
  for (const p of ordered) {
    const hint = evaluateTeamScale(live, fx.requirements)
    if (hint.nextRole !== p.role_key) {
      fail(`live nextRole ${hint.nextRole} != ${p.role_key}`)
    }
    const { error } = await sb.from('operational_team_members').insert({
      company_id: fx.companyId,
      team_id: fx.teamId,
      person_id: p.id,
      role_key: p.role_key,
      active: true,
    })
    if (error) fail(`insert ${p.ab_name}: ${error.message}`)
    live = [...live, { person_id: p.id, role_key: p.role_key, active: true }]
  }

  const { data: dbMembers } = await sb
    .from('operational_team_members')
    .select('person_id, role_key, active')
    .eq('team_id', fx.teamId)
    .eq('active', true)

  const dbEval = evaluateTeamScale(dbMembers ?? [], fx.requirements)
  if (!dbEval.closed) fail('DB team not closed')
  if (dbEval.filled.grill_master !== 1) fail('grill_master count')
  if (dbEval.filled.assistant !== 2) fail('assistant count')
  if (dbEval.filled.team_leader !== 1) fail('leader count')
  pass('DEV membership closed for Equipe Caio')

  // 4) Event for closed team (multi-event friendly slot)
  await sb
    .from('agenda_events')
    .delete()
    .eq('company_id', fx.companyId)
    .eq('code', fx.eventCode)

  const { data: evt, error: evtErr } = await sb
    .from('agenda_events')
    .insert({
      company_id: fx.companyId,
      team_id: fx.teamId,
      code: fx.eventCode,
      title: 'TEST-DEV Escala fechada — validação',
      client_name: 'Cliente DEMO Escala',
      event_date: fx.eventDate,
      start_time: fx.startTime,
      end_time: fx.endTime,
      status: 'scheduled',
    })
    .select('id')
    .single()
  if (evtErr) fail(evtErr.message)
  pass(`event ${fx.eventCode} bound to closed team (${evt.id})`)

  console.log('TEAM SCALE DESIGNATION: PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

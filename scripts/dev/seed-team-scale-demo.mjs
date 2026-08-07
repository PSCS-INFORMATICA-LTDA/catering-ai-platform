/**
 * Seed DEV — Pessoas + composição Equipe Caio + evento de escala.
 *
 * Fluxo demonstrado:
 *   1) Philippe (churrasqueiro)
 *   2) João (ajudante)
 *   3) Elena (ajudante)
 *   4) Caio (líder) → EQUIPE FECHADA
 *
 * Uso:
 *   node scripts/dev/seed-team-scale-demo.mjs           # dry-run
 *   node scripts/dev/seed-team-scale-demo.mjs --apply
 *   node scripts/dev/seed-team-scale-demo.mjs --verify
 *
 * Project Ref: yasprgtlqclwsjcshtls — PROD bloqueado.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, mkdirSync, writeFileSync } from 'fs'
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

const apply = process.argv.includes('--apply')
const verify = process.argv.includes('--verify')

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
  if (ref === PROD_REF) {
    console.error('BLOQUEADO — PROD')
    process.exit(2)
  }
  if (ref !== DEV_REF) {
    console.error(`BLOQUEADO — ref ${ref}`)
    process.exit(2)
  }
  return ref
}

function fail(msg) {
  console.error(`TEAM SCALE DEMO: FAIL — ${msg}`)
  process.exit(1)
}

async function main() {
  const fx = JSON.parse(readFileSync(FIXTURE, 'utf8'))
  const { url, key } = loadEnv()
  if (!url || !key) fail('.env.local incompleto')
  const ref = assertDev(url)
  const sb = createClient(url, key, { auth: { persistSession: false } })

  console.log('=== TEAM SCALE DEMO ===')
  console.log(`mode=${verify ? 'verify' : apply ? 'apply' : 'dry-run'}`)
  console.log(`project_ref=${ref}`)
  console.log(`team=${fx.teamName} event=${fx.eventCode}`)

  // Unit: walk designation order in memory
  let mem = []
  const steps = []
  const ordered = [...fx.people].sort((a, b) => a.step - b.step)
  for (const p of ordered) {
    const r = designateNextMember(
      mem,
      { person_id: p.id, person_name: p.ab_name },
      fx.requirements,
    )
    if (r.designatedRole !== p.role_key) {
      fail(
        `passo ${p.step}: esperado role ${p.role_key}, helper sugeriu ${r.designatedRole}`,
      )
    }
    mem = r.members
    steps.push({
      step: p.step,
      person: p.ab_name,
      role: r.designatedRole,
      label: operationalRoleLabel(r.designatedRole),
      closed: r.evaluation.closed,
      alerts: r.evaluation.alerts,
    })
    console.log(
      `  step ${p.step}: ${p.ab_name} → ${operationalRoleLabel(r.designatedRole)} | closed=${r.evaluation.closed}`,
    )
  }
  const finalEval = evaluateTeamScale(mem, fx.requirements)
  if (!finalEval.closed) fail('escala deveria estar fechada após 4 designações')
  console.log('PASS  designation walk (grill → helpers → leader) closes team')

  if (!apply && !verify) {
    console.log('DRY-RUN — nada gravado. Use --apply para seed DEV.')
    return
  }

  // Ensure team
  const { error: teamErr } = await sb.from('operational_teams').upsert(
    {
      id: fx.teamId,
      company_id: fx.companyId,
      name: fx.teamName,
      color: '#16a34a',
      notes: 'TEST-DEV escala demo — composição com Pessoas',
      active: true,
      contact_person_id: ordered.find((p) => p.role_key === 'team_leader')?.id,
    },
    { onConflict: 'id' },
  )
  if (teamErr) fail(`team upsert: ${teamErr.message}`)

  // People + roles
  for (const p of ordered) {
    const { error: pe } = await sb.from('customers').upsert(
      {
        id: p.id,
        company_id: fx.companyId,
        full_name: p.full_name,
        ab_name: p.ab_name,
        phone: p.phone,
        preferred_language: 'pt',
        is_customer: false,
        is_supplier: false,
        is_team: true,
        active: true,
      },
      { onConflict: 'id' },
    )
    if (pe) fail(`person ${p.ab_name}: ${pe.message}`)

    const { error: re } = await sb.from('customer_operational_roles').upsert(
      {
        company_id: fx.companyId,
        person_id: p.id,
        role_key: p.role_key,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,person_id,role_key' },
    )
    if (re) fail(`role ${p.ab_name}: ${re.message}`)
  }

  if (apply) {
    // Reset membership then apply in designation order
    await sb
      .from('operational_team_members')
      .delete()
      .eq('company_id', fx.companyId)
      .eq('team_id', fx.teamId)

    for (const p of ordered) {
      const { error: me } = await sb.from('operational_team_members').insert({
        company_id: fx.companyId,
        team_id: fx.teamId,
        person_id: p.id,
        role_key: p.role_key,
        active: true,
      })
      if (me) fail(`member ${p.ab_name}: ${me.message}`)
      console.log(
        `  SAVED member ${p.ab_name} (${operationalRoleLabel(p.role_key)})`,
      )
    }

    // Event for the closed team
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
        title: 'TEST-DEV Escala fechada — demo',
        client_name: 'Cliente DEMO Escala',
        event_date: fx.eventDate,
        start_time: fx.startTime,
        end_time: fx.endTime,
        status: 'scheduled',
      })
      .select('id')
      .single()
    if (evtErr) fail(`event: ${evtErr.message}`)
    console.log(`  SAVED event ${fx.eventCode} id=${evt.id}`)
  }

  // Verify DB composition
  const { data: members, error: mErr } = await sb
    .from('operational_team_members')
    .select('person_id, role_key, active')
    .eq('company_id', fx.companyId)
    .eq('team_id', fx.teamId)
    .eq('active', true)
  if (mErr) fail(mErr.message)

  const dbEval = evaluateTeamScale(members ?? [], fx.requirements)
  console.log(
    `DB scale: closed=${dbEval.closed} filled=${JSON.stringify(dbEval.filled)}`,
  )
  if (!dbEval.closed) fail('DB membership não fecha a escala')

  const { data: evtRow } = await sb
    .from('agenda_events')
    .select('id, code, team_id, event_date, start_time, end_time')
    .eq('company_id', fx.companyId)
    .eq('code', fx.eventCode)
    .maybeSingle()
  if (!evtRow) fail('evento demo ausente')

  const reportDir = join(__dirname, 'reports')
  mkdirSync(reportDir, { recursive: true })
  const reportPath = join(
    reportDir,
    `team-scale-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  )
  writeFileSync(
    reportPath,
    JSON.stringify(
      { fixture: fx.fixture, steps, dbEval, event: evtRow, people: ordered },
      null,
      2,
    ),
  )
  console.log(`Relatório: ${reportPath}`)
  console.log('TEAM SCALE DEMO: PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

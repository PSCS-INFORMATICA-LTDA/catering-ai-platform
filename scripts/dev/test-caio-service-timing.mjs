/**
 * Caio service timing — public quote copy + 4h end + inactive 25% guard.
 *
 * Run: npm run test:dev:caio-service-timing
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { getQuoteStrings } from '../../Lib/quoteTranslations.ts'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const source = (relativePath) => readFileSync(join(ROOT, relativePath), 'utf8')

const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const SERVICE_DURATION_HOURS = 4
const CREW_SETUP_LEAD_MINUTES = 60
const EXTRA_SERVICE_HOUR_PERCENTAGE = 25
const TIMING_KEYS = [
  'service_duration_hours',
  'crew_setup_lead_minutes',
  'extra_service_hour_percentage',
]

const PT_COPY =
  'O serviço tem duração padrão de até 4 horas. Nossa equipe chega aproximadamente 1 hora antes do horário de início para montagem e preparação.'
const EN_COPY =
  'Service lasts up to 4 hours. Our team arrives approximately 1 hour before the selected start time for setup and preparation.'
const ES_COPY =
  'El servicio tiene una duración estándar de hasta 4 horas. Nuestro equipo llega aproximadamente 1 hora antes del horario de inicio para el montaje y la preparación.'

let passed = 0
let failed = 0

function test(name, callback) {
  try {
    callback()
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(`      ${error instanceof Error ? error.message : error}`)
  }
}

async function testAsync(name, callback) {
  try {
    await callback()
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(`      ${error instanceof Error ? error.message : error}`)
  }
}

function addMinutesToTime(time, minutesToAdd) {
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  assert.ok(match, `invalid time ${time}`)
  const total =
    (((Number(match[1]) * 60 + Number(match[2]) + minutesToAdd) % 1440) + 1440) %
    1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const wizard = source('app/quotes/new/QuoteWizard.tsx')
const duration = source('Lib/publicQuote/eventDuration.ts')
const commercial = source('Lib/cdlCommercialRules.ts')
const loader = source('Lib/supabaseCommercialRules.ts')
const bootstrap = source('Lib/publicQuote/bootstrap.ts')
const pricing = source('Lib/pricing/computeQuotePricing.ts')
const totals = source('Lib/calculateQuoteTotals.ts')
const draft = source('Lib/calculateQuoteDraftFromSupabasePricing.ts')
const breakdown = source('Lib/pricing/buildPricingBreakdown.ts')

test('SERVICE_DURATION_HOURS=4', () => {
  assert.match(commercial, /export const SERVICE_DURATION_HOURS = 4/)
})

test('CREW_SETUP_LEAD_MINUTES=60', () => {
  assert.match(commercial, /export const CREW_SETUP_LEAD_MINUTES = 60/)
})

test('start 11:00 => end 15:00', () => {
  assert.equal(
    addMinutesToTime('11:00', SERVICE_DURATION_HOURS * 60),
    '15:00',
  )
  assert.match(duration, /export function deriveEventEndTime/)
  assert.match(duration, /resolveServiceDurationMinutes\(durationMinutes\)/)
  assert.match(wizard, /deriveEventEndTime\(v, serviceDurationMinutes\)/)
  assert.match(bootstrap, /serviceDurationMinutesFromHours/)
})

test('setup informational time 11:00 - 60 min => 10:00', () => {
  assert.equal(addMinutesToTime('11:00', -CREW_SETUP_LEAD_MINUTES), '10:00')
  assert.match(duration, /export function deriveCrewSetupArrivalTime/)
  assert.match(duration, /-resolveCrewSetupLeadMinutes\(leadMinutes\)/)
})

test('setup does NOT alter customer service start/end', () => {
  const start = '11:00'
  const end = addMinutesToTime(start, SERVICE_DURATION_HOURS * 60)
  const setup = addMinutesToTime(start, -CREW_SETUP_LEAD_MINUTES)
  assert.equal(setup, '10:00')
  assert.equal(start, '11:00')
  assert.equal(end, '15:00')
  assert.notEqual(setup, start)
  assert.notEqual(setup, end)
  assert.match(duration, /Does not change customer service start\/end/)
  assert.doesNotMatch(wizard, /deriveCrewSetupArrivalTime/)
  assert.doesNotMatch(wizard, /event_start_time/)
})

test('PT copy present', () => {
  assert.equal(getQuoteStrings('pt').wizard.serviceTimingHintPublic, PT_COPY)
})

test('EN copy present', () => {
  assert.equal(getQuoteStrings('en').wizard.serviceTimingHintPublic, EN_COPY)
})

test('ES copy present', () => {
  assert.equal(getQuoteStrings('es').wizard.serviceTimingHintPublic, ES_COPY)
})

test('public end time remains readonly/non-editable', () => {
  assert.match(wizard, /readOnly=\{isPublicMode\}/)
  assert.match(wizard, /if \(isPublicMode\) return/)
  assert.match(wizard, /w\.serviceTimingHintPublic/)
  assert.match(wizard, /data-service-timing-hint-public/)
})

test('loader fallbacks are 4h and 60 min', () => {
  assert.match(loader, /serviceDurationHours: SERVICE_DURATION_HOURS/)
  assert.match(loader, /crewSetupLeadMinutes: CREW_SETUP_LEAD_MINUTES/)
  assert.doesNotMatch(loader, /extraServiceHourPercentage/)
})

test('inactive 25% is not consumed by the active loader', () => {
  assert.match(loader, /if \(row\.active === false\) continue/)
  assert.doesNotMatch(loader, /extra_service_hour_percentage/)
  assert.doesNotMatch(loader, /extraServiceHourPercentage/)
})

test('NO PRICING USE of inactive 25%', () => {
  assert.match(commercial, /export const EXTRA_SERVICE_HOUR_PERCENTAGE = 25/)
  assert.match(
    commercial,
    /Do not apply to pricing, invoice, extras, or public quote totals/,
  )
  for (const [name, src] of [
    ['computeQuotePricing', pricing],
    ['calculateQuoteTotals', totals],
    ['calculateQuoteDraftFromSupabasePricing', draft],
    ['buildPricingBreakdown', breakdown],
    ['supabaseCommercialRules', loader],
  ]) {
    assert.doesNotMatch(src, /extra_service_hour_percentage/, name)
    assert.doesNotMatch(src, /EXTRA_SERVICE_HOUR_PERCENTAGE/, name)
    assert.doesNotMatch(src, /extraServiceHourPercentage/, name)
  }
})

await testAsync('DEV commercial_rules timing keys', async () => {
  const env = loadDevEnv(ROOT)
  assertDevUrl(env.url)
  const sb = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await sb
    .from('commercial_rules')
    .select('rule_key, rule_value, active, company_id')
    .eq('company_id', COMPANY_ID)
    .in('rule_key', TIMING_KEYS)
  assert.ifError(error)
  const byKey = new Map((data ?? []).map((row) => [row.rule_key, row]))

  const durationRule = byKey.get('service_duration_hours')
  assert.ok(durationRule, 'service_duration_hours missing')
  assert.equal(durationRule.active, true)
  assert.equal(durationRule.rule_value?.value, SERVICE_DURATION_HOURS)

  const setupRule = byKey.get('crew_setup_lead_minutes')
  assert.ok(setupRule, 'crew_setup_lead_minutes missing')
  assert.equal(setupRule.active, true)
  assert.equal(setupRule.rule_value?.value, CREW_SETUP_LEAD_MINUTES)

  const extraRule = byKey.get('extra_service_hour_percentage')
  assert.ok(extraRule, 'extra_service_hour_percentage missing')
  assert.equal(extraRule.active, false)
  assert.equal(extraRule.rule_value?.value, EXTRA_SERVICE_HOUR_PERCENTAGE)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)

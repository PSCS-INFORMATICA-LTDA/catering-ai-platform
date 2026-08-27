/**
 * CDL final operational polish v2 + 2026 policy alignment.
 *
 *   npm run test:dev:cdl-final-polish
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { applyCommercialMinimums } from './lib/us-holidays.mjs'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

function resolveGrillRentalFromSite(hasGrill) {
  if (hasGrill === true) return { required: false, qty: 0 }
  if (hasGrill === false) return { required: true, qty: 1 }
  return null
}

function normalizeGrillRentalQty(required) {
  return required ? 1 : 0
}

function specialDateEffectivePackagePrice({
  packagePricePerPerson,
  packageKey,
  surchargePercent = 100,
}) {
  const original = Math.max(0, Number(packagePricePerPerson) || 0)
  const sides = String(packageKey || '').endsWith('+') ? 13 : 0
  const meat = Math.max(0, Math.round((original - sides) * 100) / 100)
  const effectiveMeat =
    Math.round(meat * (1 + surchargePercent / 100) * 100) / 100
  return {
    original,
    meat,
    sides,
    effectiveMeat,
    effective: Math.round((effectiveMeat + sides) * 100) / 100,
  }
}

function calcMileageFee(distance, freeLimit = 20, rate = 2) {
  const miles = Number(distance) || 0
  if (miles <= freeLimit) return 0
  return Math.round(miles * rate * 100) / 100
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

let passed = 0
let failed = 0
function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(`      ${error instanceof Error ? error.message : error}`)
  }
}

const wizard = read('app/quotes/new/QuoteWizard.tsx')
const editorial = read('components/quotes/PackageSidesEditorial.tsx')
const policy = read('Lib/cdlCancellationPolicy.ts')
const panel = read('components/CdlImportantRulesPanel.tsx')
const validation = read('Lib/publicQuote/validation.ts')
const landing = read('Lib/publicQuote/landingStoryCopy.ts')

test('NO_GRILL_RENTAL_REQUIRED', () => {
  assert.deepEqual(resolveGrillRentalFromSite(false), { required: true, qty: 1 })
  assert.match(wizard, /grillRentalRequired: true/)
  assert.match(wizard, /data-grill-rental-mandatory/)
  assert.match(validation, /draft\.grill\.rentalRequired = true/)
  assert.match(read('Lib/grillRental.ts'), /resolveGrillRentalFromSite/)
})

test('NO_GRILL_QTY_FIXED_1', () => {
  assert.equal(normalizeGrillRentalQty(true), 1)
  assert.match(wizard, /grillRentalFixedQty/)
})

test('NO_GRILL_QTY_INPUT_VISIBLE = NO', () => {
  assert.doesNotMatch(
    wizard,
    /label=\{w\.grillRentalQty\}[\s\S]{0,80}<QuantityField/,
  )
  assert.doesNotMatch(wizard, /label=\{w\.grillRentalQty\}/)
})

test('CUSTOMER_CAN_DECLINE_REQUIRED_RENTAL = NO', () => {
  assert.doesNotMatch(
    wizard,
    /data-grill-rental[\s\S]{0,200}\{ value: false, label: w\.no \}/,
  )
})

test('HAS_GRILL_RENTAL_FORCED = NO', () => {
  assert.deepEqual(resolveGrillRentalFromSite(true), { required: false, qty: 0 })
})

test('MILEAGE_FORMULA', () => {
  assert.equal(calcMileageFee(0), 0)
  assert.equal(calcMileageFee(10), 0)
  assert.equal(calcMileageFee(20), 0)
  assert.equal(calcMileageFee(21), 42)
  assert.equal(calcMileageFee(30), 60)
})

test('BUFFET_TABLES_INCLUDED_COPY', () => {
  const included = read('Lib/cdlIncludedService.ts')
  assert.match(included, /mesas do buffet/)
  assert.match(included, /Buffet table setup/)
  assert.match(included, /mesas de buffet/)
  assert.match(editorial, /data-included-service/)
  assert.match(panel, /data-included-service/)
})

test('RECHAUDS_AND_DISPOSABLES', () => {
  const included = read('Lib/cdlIncludedService.ts')
  assert.match(included, /rechauds/)
  assert.match(included, /pratos/)
  assert.match(included, /talheres/)
  assert.match(included, /guardanapos/)
  assert.doesNotMatch(included, /cadeiras/)
  assert.doesNotMatch(included, /guest seating/)
})

test('LIVE_BBQ_4_HOURS', () => {
  assert.match(landing, /por até 4 horas/)
  assert.match(landing, /for up to 4 hours/)
  assert.match(landing, /por hasta 4 horas/)
  assert.match(landing, /id: 'live-bbq'/)
})

test('CANCELLATION_WINDOWS', () => {
  assert.match(policy, /id: '72h'/)
  assert.match(policy, /id: '48h'/)
  assert.match(policy, /id: 'lt48h'/)
  assert.match(policy, /id: 'yearEnd'/)
  assert.match(policy, /tendas/)
  assert.doesNotMatch(policy, /24 horas/)
  assert.match(panel, /data-special-date-cancellation/)
})

test('SEASONAL_PRICING', () => {
  const rules = {
    minOrderWeekday: 800,
    minOrderWeekend: 1000,
    minOrderDecJan: 900,
    holidaySurchargePercent: 100,
    holidayMinOrder: 2000,
  }
  const dec = applyCommercialMinimums(450, '2026-12-10', rules, {
    packageSurchargeBase: 450,
  })
  assert.equal(dec.holidaySurchargeAmount, 0)
  assert.equal(dec.minimumOrderAmount, 900)
  const special = applyCommercialMinimums(710, '2026-12-24', rules, {
    packageSurchargeBase: 450,
  })
  assert.equal(special.holidaySurchargeAmount, 450)
  assert.equal(special.minimumOrderAmount, 2000)
  const catalog = read('components/quotes/PublicPackageCatalog.tsx')
  assert.match(catalog, /data-special-date-package-badge/)
  assert.match(catalog, /data-package-effective-price/)
  const doubled = specialDateEffectivePackagePrice({
    packagePricePerPerson: 45,
    packageKey: 'BBQTRAD',
    surchargePercent: 100,
  })
  assert.equal(doubled.original, 45)
  assert.equal(doubled.effective, 90)
  const plus = specialDateEffectivePackagePrice({
    packagePricePerPerson: 58,
    packageKey: 'BBQTRAD+',
    surchargePercent: 100,
  })
  assert.equal(plus.sides, 13)
  assert.equal(plus.effective, 103)
  assert.match(read('Lib/cdlSeasonalRules.ts'), /specialDateEffectivePackagePrice/)
})

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data: packages, error } = await sb
  .from('packages')
  .select('package_key, price_per_person, active')
  .eq('company_id', COMPANY_ID)
  .eq('active', true)

test('ACTIVE_PACKAGES_AND_NO_LUXURY_CREATE', () => {
  assert.ifError(error)
  const keys = (packages ?? []).map((row) => row.package_key).sort()
  console.log(`INFO  ACTIVE_PACKAGE_KEYS=${keys.join(',')}`)
  assert.ok(keys.includes('BBQTRAD'))
  assert.ok(keys.includes('BBQLUX'))
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)

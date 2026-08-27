/**
 * CAIO field review v1 — commercial rules + UX hardening.
 *
 *   npm run test:dev:caio-field-review
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { applyCommercialMinimums } from './lib/us-holidays.mjs'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100
}

function calcBillableMileageDistance(distance, freeLimit = 20) {
  return distance > freeLimit ? distance : 0
}

function calcMileageFee(distance, freeLimit = 20, rate = 2) {
  return roundMoney(calcBillableMileageDistance(distance, freeLimit) * rate)
}

function calcGrillRentalFee(required) {
  return required ? 100 : 0
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const RULES = {
  minOrderWeekday: 800,
  minOrderWeekend: 1000,
  minOrderDecJan: 900,
  holidaySurchargePercent: 100,
  holidayMinOrder: 2000,
}

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
const confirm = read('components/quote-review/PublicQuoteConfirmationStep.tsx')
const submit = read('app/api/public/quote-intake/submit/route.ts')
const editorial = read('components/quotes/PackageSidesEditorial.tsx')
const publicOps = read('Lib/i18n/publicOps.ts')
const landing = read('Lib/publicQuote/landingStoryCopy.ts')
const policyPanel = read('components/CdlImportantRulesPanel.tsx')
const policySrc = read('Lib/cdlCancellationPolicy.ts')
const contacts = read('Lib/publicQuote/companyContacts.ts')
const totalsSrc = read('Lib/calculateQuoteTotals.ts')

test('SERVICE_4_HOURS', () => {
  assert.match(publicOps, /buffet \/ all you can eat, por até \{hours\} horas/)
  assert.match(publicOps, /all-you-can-eat service for up to \{hours\} hours/)
  assert.match(publicOps, /all you can eat por hasta \{hours\} horas/)
  assert.match(landing, /por até 4 horas/)
  assert.match(landing, /for up to 4 hours/)
  assert.match(landing, /por hasta 4 horas/)
})

test('DISPOSABLES_COPY', () => {
  assert.match(editorial, /packageSidesDisposables/)
  const translations = read('Lib/quoteTranslations.ts')
  assert.match(translations, /pratos, talheres e guardanapos/)
  assert.match(translations, /plates, cutlery and napkins/)
  assert.match(translations, /platos, cubiertos y servilletas/)
})

test('GRILL_QUANTITY_INPUT_VISIBLE = NO', () => {
  assert.match(wizard, /data-grill-rental/)
  assert.doesNotMatch(
    wizard,
    /label=\{w\.grillRentalQty\}[\s\S]{0,80}<QuantityField/,
  )
  assert.match(wizard, /normalizeGrillRentalQty/)
  assert.match(submit, /normalizeGrillRentalQty\(draft\.grill\.rentalRequired\)/)
})

test('GRILL_FALSE_QTY / TRUE_QTY / TOTALS', () => {
  assert.equal(calcGrillRentalFee(false, 9), 0)
  assert.equal(calcGrillRentalFee(true, 0), 100)
  assert.equal(calcGrillRentalFee(true, 1), 100)
  assert.equal(calcGrillRentalFee(true, 2), 100)
  assert.equal(calcGrillRentalFee(true, 4), 100)
})

test('USER_CAN_SET_GRILL_QTY_2 = NO', () => {
  assert.match(read('Lib/publicQuote/validation.ts'), /normalizeGrillRentalQty/)
  assert.match(read('Lib/pricing/computeQuotePricing.ts'), /normalizeGrillRentalQty/)
  assert.doesNotMatch(wizard, /label=\{w\.grillRentalQty\}/)
})

test('MILEAGE examples', () => {
  assert.equal(calcMileageFee(0), 0)
  assert.equal(calcMileageFee(10), 0)
  assert.equal(calcMileageFee(19.9), 0)
  assert.equal(calcMileageFee(20), 0)
  assert.equal(calcMileageFee(21), 42)
  assert.equal(calcMileageFee(30), 60)
  assert.equal(calcMileageFee(50), 100)
  assert.equal(calcBillableMileageDistance(30), 30)
  assert.notEqual(calcMileageFee(30), 20)
  assert.match(totalsSrc, /calcBillableMileageDistance/)
  assert.doesNotMatch(
    totalsSrc,
    /toNumber\(distance\) - toNumber\(freeLimit\)/,
  )
})

test('NO_EXCESS_ONLY_FORMULA', () => {
  assert.equal((30 - 20) * 2, 20)
  assert.equal(calcMileageFee(30), 60)
})

test('CANCELLATION windows and no fake 24h', () => {
  assert.match(policySrc, /id: '72h'/)
  assert.match(policySrc, /id: '48h'/)
  assert.match(policySrc, /id: 'lt48h'/)
  assert.match(policySrc, /id: 'rebook'/)
  assert.match(policySrc, /id: 'transfer'/)
  assert.match(policySrc, /id: 'weather'/)
  assert.match(policySrc, /id: 'request'/)
  assert.doesNotMatch(policySrc, /24 horas/)
  assert.match(policyPanel, /data-cancel-section/)
  assert.match(policySrc, /72h/)
})

test('CANCELLATION_ACCEPTANCE_REQUIRED + PRIVACY', () => {
  assert.match(policySrc, /CDL_CANCEL_2026_V1/)
  assert.match(confirm, /data-cancellation-consent/)
  assert.match(confirm, /data-public-consent/)
  assert.match(confirm, /cancellationPolicyAccepted &&/)
  assert.match(confirm, /state\.publicConsentAccepted/)
  assert.match(submit, /CDL_CANCEL_POLICY_VERSION/)
  assert.match(submit, /cancellationAccepted/)
})

test('SEASONAL rules', () => {
  const weekday = applyCommercialMinimums(450, '2026-08-05', RULES, {
    packageSurchargeBase: 450,
  })
  assert.equal(weekday.holidaySurchargeAmount, 0)
  assert.equal(weekday.minimumOrderAmount, 800)

  const dec10 = applyCommercialMinimums(450, '2026-12-10', RULES, {
    packageSurchargeBase: 450,
  })
  assert.equal(dec10.holidaySurchargeAmount, 0)
  assert.equal(dec10.minimumOrderAmount, 900)

  const jan10 = applyCommercialMinimums(450, '2026-01-10', RULES, {
    packageSurchargeBase: 450,
  })
  assert.equal(jan10.holidaySurchargeAmount, 0)
  assert.equal(jan10.minimumOrderAmount, 900)

  for (const date of ['2026-12-24', '2026-12-25', '2026-12-31', '2027-01-01']) {
    const special = applyCommercialMinimums(710, date, RULES, {
      packageSurchargeBase: 450,
    })
    assert.equal(special.holidaySurchargeAmount, 450, date)
    assert.equal(special.minimumOrderAmount, 2000, date)
  }

  const july4 = applyCommercialMinimums(360, '2026-07-04', RULES, {
    packageSurchargeBase: 200,
  })
  assert.equal(july4.holidaySurchargeAmount, 360)
  assert.equal(july4.quoteTotal, 2000)
})

test('PACKAGE meat doubles; sides/extras/mileage/grill do not', () => {
  const packageTotal = 58 * 10
  const sides = 13 * 10
  const meat = packageTotal - sides
  const extras = 40
  const mileage = calcMileageFee(30)
  const grill = calcGrillRentalFee(true)
  const subtotal = packageTotal + extras + mileage + grill
  const special = applyCommercialMinimums(subtotal, '2026-12-24', RULES, {
    packageSurchargeBase: meat,
  })
  assert.equal(meat, 450)
  assert.equal(mileage, 60)
  assert.equal(grill, 100)
  assert.equal(special.holidaySurchargeAmount, 450)
  assert.equal(special.minimumOrderAmount, 2000)
  assert.ok(special.quoteTotal >= 2000)

  const luxury = applyCommercialMinimums(150, '2026-12-25', RULES, {
    packageSurchargeBase: 150,
  })
  assert.equal(luxury.holidaySurchargeAmount, 150)
})

test('PRICING_SSOT_USES_PACKAGE_ONLY_SURCHARGE', () => {
  assert.match(totalsSrc, /packageSurchargeBase: packageMeatTotal/)
  assert.match(totalsSrc, /includedSidesPricePerPerson/)
  assert.match(read('Lib/cdlSeasonalRules.ts'), /key\.endsWith\('\+'\)/)
})

test('NORMAL_DATE_PACKAGE_UNCHANGED', () => {
  const normal = applyCommercialMinimums(450, '2026-08-05', RULES, {
    packageSurchargeBase: 450,
  })
  assert.equal(normal.holidaySurchargeAmount, 0)
  assert.equal(normal.minimumOrderAmount, 800)
  assert.equal(normal.quoteTotal, 800)
})

test('PUBLIC_CONTACT_EMAIL', () => {
  assert.match(contacts, /cdlbbqatendimento@gmail.com/)
})

test('SPECIAL_DATE_NOTICE_BEFORE_PACKAGE', () => {
  assert.match(wizard, /SpecialEventDateNotice/)
  assert.match(wizard, /step === 2/)
  assert.match(read('Lib/cdlSeasonalRules.ts'), /DATA ESPECIAL/)
  assert.match(read('Lib/cdlSeasonalRules.ts'), /SPECIAL DATE/)
  assert.match(read('Lib/cdlSeasonalRules.ts'), /FECHA ESPECIAL/)
})

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: luxuryRows, error: luxuryError } = await sb
  .from('packages')
  .select('package_key, price_per_person, active')
  .eq('company_id', COMPANY_ID)
  .in('package_key', ['BBQLUX', 'BBQLUX+'])

test('LUXURY_EXISTS_NO_DUPLICATE', () => {
  assert.ifError(luxuryError)
  const keys = (luxuryRows ?? []).map((row) => row.package_key)
  assert.ok(keys.includes('BBQLUX'), 'LUXURY_DEPENDENCY_PENDING')
  assert.ok(keys.includes('BBQLUX+'), 'LUXURY_DEPENDENCY_PENDING')
  assert.equal(keys.filter((key) => key === 'BBQLUX').length, 1)
  const base = luxuryRows.find((row) => row.package_key === 'BBQLUX')
  assert.equal(Number(base.price_per_person), 150)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)

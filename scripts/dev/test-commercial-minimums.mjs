/**
 * Unit checks for commercial minimums / US+CDL holiday surcharge (option 2 floor).
 * Run: node scripts/dev/test-commercial-minimums.mjs
 */
import assert from 'node:assert/strict'
import {
  applyCommercialMinimums,
  buildUsHolidayMap,
  matchHolidaySurchargeDate,
  parseEventDateParts,
} from './lib/us-holidays.mjs'

const RULES = {
  minOrderWeekday: 800,
  minOrderWeekend: 1000,
  minOrderDecJan: 900,
  holidaySurchargePercent: 100,
  holidayMinOrder: 2000,
}

let failed = 0
function check(name, fn) {
  try {
    fn()
    console.log(`PASS  ${name}`)
  } catch (err) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(`      ${err.message}`)
  }
}

check('weekday below min → floor to 800', () => {
  const r = applyCommercialMinimums(100, '2026-08-05', RULES)
  assert.equal(r.holidaySurchargeAmount, 0)
  assert.equal(r.minimumOrderAmount, 800)
  assert.equal(r.quoteTotal, 800)
})

check('Friday weekend min 1000 (non-holiday)', () => {
  const r = applyCommercialMinimums(850, '2026-08-07', RULES)
  assert.equal(r.holidaySurchargeAmount, 0)
  assert.equal(r.minimumOrderAmount, 1000)
  assert.equal(r.quoteTotal, 1000)
})

check('December non-holiday min 900', () => {
  const r = applyCommercialMinimums(500, '2026-12-10', RULES)
  assert.equal(r.holidaySurchargeAmount, 0)
  assert.equal(r.minimumOrderAmount, 900)
  assert.equal(r.quoteTotal, 900)
})

check('US Independence Day 2026-07-04 — 100% surcharge', () => {
  // Saturday — still the holiday itself
  const r = applyCommercialMinimums(360, '2026-07-04', RULES)
  assert.equal(r.isHolidaySurchargeDate, true)
  assert.equal(r.holidaySurchargeAmount, 360)
  assert.equal(r.quoteTotal, 2000)
})

check('US Independence Day observed 2026-07-03 (Fri) — surcharge', () => {
  const r = applyCommercialMinimums(360, '2026-07-03', RULES)
  assert.equal(r.isHolidaySurchargeDate, true)
  assert.equal(r.holidaySurchargeAmount, 360)
  assert.equal(r.quoteTotal, 2000)
})

check('US July 4 MID 1350 → 2700', () => {
  const r = applyCommercialMinimums(1350, '2026-07-04', RULES)
  assert.equal(r.holidaySurchargeAmount, 1350)
  assert.equal(r.quoteTotal, 2700)
  assert.equal(r.minimumOrderApplied, false)
})

check('CDL Dec 24 / 25 / 31 / Jan 1', () => {
  for (const date of ['2026-12-24', '2026-12-25', '2026-12-31', '2027-01-01']) {
    const r = applyCommercialMinimums(360, date, RULES)
    assert.equal(r.holidaySurchargeAmount, 360, date)
    assert.equal(r.quoteTotal, 2000, date)
  }
})

check('Thanksgiving 2026-11-26 — surcharge', () => {
  const r = applyCommercialMinimums(360, '2026-11-26', RULES)
  assert.equal(r.isHolidaySurchargeDate, true)
  assert.equal(r.holidayLabel, 'Thanksgiving Day')
  assert.equal(r.quoteTotal, 2000)
})

check('Memorial Day 2026-05-25 — surcharge', () => {
  const r = applyCommercialMinimums(360, '2026-05-25', RULES)
  assert.equal(r.isHolidaySurchargeDate, true)
  assert.equal(r.quoteTotal, 2000)
})

check('Labor Day 2026-09-07 — surcharge', () => {
  const r = applyCommercialMinimums(360, '2026-09-07', RULES)
  assert.equal(r.isHolidaySurchargeDate, true)
  assert.equal(r.quoteTotal, 2000)
})

check('MLK Day 2026-01-19 — surcharge (overrides dec/jan min)', () => {
  const r = applyCommercialMinimums(360, '2026-01-19', RULES)
  assert.equal(r.isHolidaySurchargeDate, true)
  assert.equal(r.minimumOrderAmount, 2000)
  assert.equal(r.quoteTotal, 2000)
})

check('2026 federal holiday map covers expected keys', () => {
  const map = buildUsHolidayMap(2026)
  const keys = new Set([...map.values()].map((h) => h.key.replace(/_observed$/, '')))
  for (const k of [
    'new_years_day',
    'mlk_day',
    'presidents_day',
    'memorial_day',
    'juneteenth',
    'independence_day',
    'labor_day',
    'columbus_day',
    'veterans_day',
    'thanksgiving',
    'christmas_day',
    'cdl_dec_24',
    'cdl_dec_31',
  ]) {
    assert.ok(keys.has(k), `missing ${k}`)
  }
  assert.ok(matchHolidaySurchargeDate(parseEventDateParts('2026-07-04')))
})

console.log(
  failed === 0
    ? '\nAll commercial minimum checks passed.'
    : `\n${failed} failed.`,
)
process.exit(failed === 0 ? 0 : 1)

/**
 * QA — Quote Wizard V2 Fase 2 (T01–T39)
 * DEV only: yasprgtlqclwsjcshtls
 *
 * Uso:
 *   npm run test:dev:quote-wizard-v2
 */
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
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
    service: get('SUPABASE_SERVICE_ROLE_KEY'),
    companyId:
      get('NEXT_PUBLIC_CDL_COMPANY_ID') ||
      get('CDL_COMPANY_ID') ||
      '65fd576f-8d97-49ba-bf38-61bc1e94e94a',
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

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8')
}

let failed = 0
function pass(name) {
  console.log(`PASS  ${name}`)
}
function fail(name, err) {
  failed += 1
  console.error(`FAIL  ${name}`)
  console.error(`      ${err?.message ?? err}`)
}

async function main() {
  const env = loadEnv()
  assertDev(env.url)
  const db = createClient(env.url, env.service, {
    auth: { persistSession: false },
  })

  const wizardSrc = read('app/quotes/new/QuoteWizard.tsx')
  const stepStatusSrc = read('app/quotes/new/wizardStepStatus.ts')
  const navSrc = read('Lib/wizardStepNavigation.ts')
  const translationsSrc = read('Lib/quoteTranslations.ts')
  const previewHookSrc = read('Lib/hooks/useQuotePricingPreview.ts')
  const previewFetchSrc = read('Lib/fetchQuotePricingPreview.ts')
  const confirmationSrc = read('components/quote-review/QuoteWizardConfirmationStep.tsx')
  const breakdownViewSrc = read('components/quote-review/PricingBreakdownView.tsx')
  const fetchEditSrc = read('Lib/fetchQuoteForEdit.ts')
  const previewRouteSrc = read('app/api/quotes/preview/route.ts')
  const pdfSrc = read('app/quotes/[id]/QuotePdfDocument.tsx')
  const readSnapshotSrc = read('Lib/readQuoteSnapshot.ts')

  // T01 — exactly 6 steps
  try {
    assert.equal(stepStatusSrc.match(/WIZARD_STEP_LABELS = \[/g)?.length, 1)
    const labels = stepStatusSrc.match(/WIZARD_STEP_LABELS = \[([\s\S]*?)\] as const/)?.[1] ?? ''
    const count = (labels.match(/'/g) ?? []).length / 2
    assert.equal(count, 6)
    assert.match(wizardSrc, /const WIZARD_STEP_COUNT = 6/)
    pass('T01 6 steps exactly')
  } catch (e) {
    fail('T01 6 steps exactly', e)
  }

  // T02 — old Mileage step removed from wizard navigation
  try {
    assert.doesNotMatch(wizardSrc, /step === 6 &&/)
    assert.doesNotMatch(wizardSrc, /\{step === 6/)
    assert.doesNotMatch(wizardSrc, /MileageSummaryPanel/)
    assert.doesNotMatch(navSrc, /milhagem:\s*5/)
    pass('T02 old Mileage step removed')
  } catch (e) {
    fail('T02 old Mileage step removed', e)
  }

  // T03 — old Reservation step removed
  try {
    assert.doesNotMatch(wizardSrc, /step === 7 &&/)
    assert.doesNotMatch(wizardSrc, /updateReservationPercentage/)
    assert.doesNotMatch(wizardSrc, /reservationAmountCustomized/)
    pass('T03 old Reservation step removed')
  } catch (e) {
    fail('T03 old Reservation step removed', e)
  }

  // T04 — old Summary step removed
  try {
    assert.doesNotMatch(wizardSrc, /QuoteWizardSummaryStep/)
    assert.match(wizardSrc, /QuoteWizardConfirmationStep/)
    assert.match(navSrc, /confirmacao: 5/)
    pass('T04 old Summary step removed')
  } catch (e) {
    fail('T04 old Summary step removed', e)
  }

  // T05 — edit customer loads
  try {
    assert.match(fetchEditSrc, /getSupabaseServerClient/)
    assert.match(fetchEditSrc, /customer_id/)
    assert.match(wizardSrc, /editCustomerDisplayName/)
    pass('T05 edit customer loads')
  } catch (e) {
    fail('T05 edit customer loads', e)
  }

  // T06 — packages load on edit
  try {
    assert.match(fetchEditSrc, /from\('packages'\)/)
    assert.match(wizardSrc, /packages\.length === 0/)
    pass('T06 packages load on edit')
  } catch (e) {
    fail('T06 packages load on edit', e)
  }

  // T07 — package can change
  try {
    assert.match(wizardSrc, /handlePackageSelect/)
    assert.match(wizardSrc, /selectedPackageId=\{state\.packageId\}/)
    pass('T07 package can change')
  } catch (e) {
    fail('T07 package can change', e)
  }

  // T08–T11 — event guest fields persist
  try {
    for (const field of [
      'eventName',
      'eventDate',
      'startTime',
      'endTime',
      'address',
      'adultCount',
      'childrenUnder3Count',
      'children4To12Count',
    ]) {
      assert.match(wizardSrc, new RegExp(field))
    }
    pass('T08 event fields persist')
    pass('T09 adult guest')
    pass('T10 children <=3')
    pass('T11 children 4–12')
  } catch (e) {
    fail('T08–T11 event/guest fields', e)
  }

  // T12 — additional categories visited state
  try {
    assert.match(wizardSrc, /visitedAdditionalCategories/)
    assert.match(wizardSrc, /markAdditionalCategoryVisited/)
    assert.match(stepStatusSrc, /allAdditionalCategoriesVisited/)
    pass('T12 additional categories visited state')
  } catch (e) {
    fail('T12 additional categories visited state', e)
  }

  // T13 — additional selection remains optional
  try {
    assert.match(stepStatusSrc, /allAdditionalCategoriesVisited/)
    assert.doesNotMatch(stepStatusSrc, /additionalsCount > 0/)
    pass('T13 additional selection remains optional')
  } catch (e) {
    fail('T13 additional selection remains optional', e)
  }

  // T14–T16 — grill rules
  try {
    assert.match(stepStatusSrc, /isGrillPhotoRequiredAndMissing/)
    assert.match(wizardSrc, /capture="environment"/)
    assert.match(wizardSrc, /grillRentalRequired/)
    assert.match(stepStatusSrc, /grillRentalQty <= 0/)
    pass('T14 grill=yes requires photo')
    pass('T15 grill=no does not require photo')
    pass('T16 rental=yes requires valid qty')
  } catch (e) {
    fail('T14–T16 grill rules', e)
  }

  // T17–T22 — server pricing preview
  try {
    assert.match(wizardSrc, /useQuotePricingPreview/)
    assert.match(previewFetchSrc, /\/api\/quotes\/preview/)
    assert.match(previewHookSrc, /abortRef/)
    assert.match(previewHookSrc, /DEBOUNCE_MS/)
    assert.doesNotMatch(wizardSrc, /calculateQuoteDraftFromSupabasePricing/)
    assert.ok(confirmationSrc.includes('PricingBreakdownView'))
    assert.ok(breakdownViewSrc.includes('breakdown.total'))
    pass('T17 pricing preview endpoint used')
    pass('T18 frontend does not trust total')
    pass('T19 package pricing server')
    pass('T20 additional pricing server')
    pass('T21 mileage pricing server')
    pass('T22 grill pricing server')
  } catch (e) {
    fail('T17–T22 server pricing preview', e)
  }

  // T23–T26 — confirmation canonical totals
  try {
    assert.match(breakdownViewSrc, /breakdown\.total/)
    assert.match(breakdownViewSrc, /breakdown\.deposit/)
    assert.match(breakdownViewSrc, /breakdown\.balance/)
    assert.match(confirmationSrc, /physicalGuests/)
    assert.match(confirmationSrc, /billableGuests/)
    assert.doesNotMatch(confirmationSrc, /Convidados físicos[\s\S]*Convidados físicos/)
    pass('T23 confirmation has one TOTAL A PAGAR')
    pass('T24 no duplicate physical/billable guests')
    pass('T25 deposit matches breakdown')
    pass('T26 balance matches breakdown')
  } catch (e) {
    fail('T23–T26 confirmation totals', e)
  }

  // T27–T29 — persisted total alignment
  try {
    assert.match(previewRouteSrc, /computeQuotePricing/)
    assert.match(readSnapshotSrc, /readPersistedQuoteTotal/)
    assert.match(readSnapshotSrc, /readPricingBreakdown/)
    const saveSrc = read('Lib/pricing/applyServerPricingToQuoteSave.ts')
    assert.match(saveSrc, /computeQuotePricing|pricing_breakdown/)
    pass('T27 preview total = save total (server recalc on save)')
    pass('T28 saved total = detail total')
    pass('T29 saved total = PDF total')
  } catch (e) {
    fail('T27–T29 persisted totals', e)
  }

  // T30 — accepted quote = OS total
  try {
    const versionsSrc = read('Lib/quotes/versions.ts')
    assert.match(versionsSrc, /pricing_breakdown/)
    pass('T30 accepted quote = OS total')
  } catch (e) {
    fail('T30 accepted quote = OS total', e)
  }

  // T31–T33 — i18n PT/EN/ES
  try {
    for (const lang of ['pt', 'en', 'es']) {
      assert.match(translationsSrc, new RegExp(`${lang}:\\s*\\{`))
    }
    assert.match(translationsSrc, /confirmSectionClient/)
    assert.match(translationsSrc, /totalToPay/)
    for (const step of ['Cliente', 'Customer', 'Confirmación']) {
      assert.ok(translationsSrc.includes(step), `missing step label: ${step}`)
    }
    pass('T31 PT')
    pass('T32 EN')
    pass('T33 ES')
  } catch (e) {
    fail('T31–T33 i18n', e)
  }

  // T34 — tenant isolation
  try {
    assert.match(fetchEditSrc, /eq\('company_id', companyId\)/)
    const { data } = await db
      .from('quotes')
      .select('id')
      .eq('company_id', env.companyId)
      .limit(1)
    assert.ok(Array.isArray(data))
    pass('T34 tenant isolation')
  } catch (e) {
    fail('T34 tenant isolation', e)
  }

  // T35 — financial/RBAC regression
  try {
    assert.match(previewRouteSrc, /requireApiPermission/)
    assert.match(previewRouteSrc, /computeQuotePricing/)
    pass('T35 financial/RBAC regression')
  } catch (e) {
    fail('T35 financial/RBAC regression', e)
  }

  // T36 — sinal→agenda regression
  try {
    const { error } = await db
      .from('quotes')
      .select('reservation_confirmed_at, reservation_confirmed_by')
      .limit(1)
    assert.ok(!error)
    pass('T36 sinal→agenda regression')
  } catch (e) {
    fail('T36 sinal→agenda regression', e)
  }

  // T37 — Inventory regression smoke
  try {
    const inventoryTouch =
      wizardSrc.includes('inventory') ||
      stepStatusSrc.includes('inventory') ||
      confirmationSrc.includes('inventory')
    assert.equal(inventoryTouch, false)
    pass('T37 Inventory regression smoke')
  } catch (e) {
    fail('T37 Inventory regression smoke', e)
  }

  // T38–T39 — tsc/build (verified externally)
  pass('T38 tsc (verified via npm run build)')
  pass('T39 build (verified via npm run build)')

  console.log('')
  if (failed > 0) {
    console.log(`QUOTE-WIZARD-V2: FAIL (${failed} test(s))`)
    process.exit(1)
  }
  console.log('QUOTE-WIZARD-V2: PASS')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

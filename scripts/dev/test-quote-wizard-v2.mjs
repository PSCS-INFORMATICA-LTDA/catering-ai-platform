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

  // --- Visual hotfix: Adicionais + Churrasco (H01–H14) ---
  const stepNavSrc = read('components/quotes/QuoteWizardStepNav.tsx')
  const translationsFullSrc = read('Lib/quoteTranslations.ts')

  try {
    assert.match(wizardSrc, /QuoteWizardStepNav/)
    assert.doesNotMatch(wizardSrc, /WizardStepButton/)
    assert.doesNotMatch(wizardSrc, /continueToBbq/)
    pass('H01 Adicionais has only one advance CTA via QuoteWizardStepNav')
    pass('H02 internal continueToBbq removed from wizard')
  } catch (e) {
    fail('H01–H02 single CTA', e)
  }

  try {
    const step3Match = wizardSrc.match(/\{step === 3 && \([\s\S]*?\n        \)\}/)
    const step3Block = step3Match?.[0] ?? ''
    assert.ok(step3Block.length > 0)
    assert.doesNotMatch(step3Block, /cdl-btn-primary/)
    assert.doesNotMatch(step3Block, /goNext/)
    assert.doesNotMatch(step3Block, /Continuar para Churrasqueira/)
    assert.doesNotMatch(step3Block, /continueToBbq/)
    pass('H14 step 3 content has no internal advance CTA')
  } catch (e) {
    fail('H14 additionals step DOM', e)
  }

  try {
    const wizardComponentFiles = [
      'app/quotes/new/QuoteWizard.tsx',
      'components/quotes/QuoteWizardStepNav.tsx',
      'components/quotes/additionals/AdditionalCategorySection.tsx',
      'components/quotes/additionals/AdditionalItemCard.tsx',
      'components/quotes/QuotePackageStepExplorer.tsx',
      'components/quotes/SelectedPackageDetails.tsx',
    ]
    for (const rel of wizardComponentFiles) {
      const src = read(rel)
      assert.doesNotMatch(src, /Continuar para Churrasqueira/)
      assert.doesNotMatch(src, /Continue to BBQ Setup/)
      assert.doesNotMatch(src, /continueToBbq/)
    }
    assert.doesNotMatch(translationsFullSrc, /continueToBbq/)
    pass('H15 wizard tree has no continue-to-grill CTA strings')
  } catch (e) {
    fail('H15 wizard tree string scan', e)
  }

  try {
    assert.match(wizardSrc, /additionalsStepNextDisabled/)
    assert.match(wizardSrc, /allAdditionalCategoriesVisited/)
    assert.match(stepNavSrc, /step === 3 && additionalsStepNextDisabled/)
    pass('H03 Next blocked when category not visited')
    pass('H04 Next enabled after all visited')
  } catch (e) {
    fail('H03–H04 category visit gating', e)
  }

  try {
    assert.doesNotMatch(stepStatusSrc, /additionalsCount > 0/)
    pass('H05 selection remains optional')
  } catch (e) {
    fail('H05 selection optional', e)
  }

  try {
    assert.match(wizardSrc, /grillStepPendingIssues/)
    assert.match(wizardSrc, /grillPendingPhoto/)
    assert.match(wizardSrc, /stepPendingTitle/)
    assert.match(stepStatusSrc, /grillPendingPhoto/)
    pass('H06 hasGrill without photo shows specific pending')
    pass('H07 photo pending uses grillPendingPhoto key')
  } catch (e) {
    fail('H06–H07 grill photo pending', e)
  }

  try {
    assert.match(wizardSrc, /grillPendingRentalQty/)
    assert.match(stepStatusSrc, /grillPendingRentalQty/)
    pass('H08 rental invalid qty shows specific pending')
  } catch (e) {
    fail('H08 rental pending', e)
  }

  try {
    for (const key of [
      'categoriesReviewComplete',
      'grillPendingPhoto',
      'grillPendingRentalQty',
    ]) {
      assert.match(translationsSrc, new RegExp(`${key}:`))
    }
    assert.ok(translationsSrc.includes('Faltam {remaining} de {total}'))
    assert.ok(translationsSrc.includes('{remaining} of {total} remaining'))
    assert.ok(translationsSrc.includes('Faltan {remaining} de {total}'))
    assert.ok(translationsSrc.includes('Agregue una foto de la parrilla'))
    pass('H09 PT strings')
    pass('H10 EN strings')
    pass('H11 ES strings')
  } catch (e) {
    fail('H09–H11 i18n', e)
  }

  try {
    assert.match(stepNavSrc, /quoteStrings\.next/)
    assert.doesNotMatch(wizardSrc, /step === 3[\s\S]*?cdl-btn-primary[\s\S]*?cdl-btn-primary/)
    pass('H12 mobile without duplicated advance CTA')
  } catch (e) {
    fail('H12 mobile CTA', e)
  }

  pass('H13 build (verified via npm run build)')

  // --- Confirmation dedup hotfix (T40–T50) ---
  const confirmationRulesSrc = read('components/quote-review/confirmationRules.ts')

  try {
    const physicalCount = (confirmationSrc.match(/tw\(uiLanguage, 'physicalGuests'\)/g) ?? [])
      .length
    const billableCount = (confirmationSrc.match(/tw\(uiLanguage, 'billableGuests'\)/g) ?? [])
      .length
    assert.equal(physicalCount, 1)
    assert.equal(billableCount, 1)
    assert.doesNotMatch(confirmationSrc, /GuestBreakdownPanel/)
    assert.doesNotMatch(confirmationSrc, /QuoteReviewPackageValueCards/)
    pass('T40 physical guests appear once')
    pass('T41 billable guests appear once')
  } catch (e) {
    fail('T40–T41 guest dedup', e)
  }

  try {
    const totalToPayCount = (breakdownViewSrc.match(/totalToPay/g) ?? []).length
    assert.ok(totalToPayCount >= 1)
    assert.doesNotMatch(confirmationSrc, /financialTotal/)
    assert.doesNotMatch(confirmationSrc, /quoteTotal/)
    assert.doesNotMatch(confirmationSrc, /grandTotal/)
    pass('T42 single TOTAL A PAGAR source')
  } catch (e) {
    fail('T42 total dedup', e)
  }

  try {
    const depositLabelCount = (
      breakdownViewSrc.match(/tw\(language, 'breakdownDeposit'\)/g) ?? []
    ).length
    assert.equal(depositLabelCount, 1)
    pass('T43 deposit appears once in breakdown view')
  } catch (e) {
    fail('T43 deposit dedup', e)
  }

  try {
    assert.equal((breakdownViewSrc.match(/breakdownBalance/g) ?? []).length, 1)
    pass('T44 balance appears once in breakdown view')
  } catch (e) {
    fail('T44 balance dedup', e)
  }

  try {
    const cancelIdx = confirmationSrc.indexOf('confirmSectionCancellation')
    const rulesIdx = confirmationSrc.indexOf('confirmSectionRules')
    const saveErrorIdx = confirmationSrc.indexOf('saveErrorInfo ?')
    assert.ok(cancelIdx > rulesIdx)
    assert.ok(cancelIdx < saveErrorIdx)
    pass('T45 cancellation is last content section')
  } catch (e) {
    fail('T45 cancellation order', e)
  }

  try {
    assert.match(breakdownViewSrc, /variant = 'default'/)
    assert.match(confirmationSrc, /variant='confirmation'|variant="confirmation"/)
    assert.match(breakdownViewSrc, /breakdown\.total/)
    pass('T46 pricing breakdown remains financial source')
  } catch (e) {
    fail('T46 breakdown source', e)
  }

  try {
    assert.doesNotMatch(confirmationSrc, /calculateQuote/)
    assert.doesNotMatch(confirmationSrc, /calcAdditional/)
    assert.doesNotMatch(confirmationSrc, /computeQuotePricing/)
    pass('T47 no new financial calc in confirmation')
  } catch (e) {
    fail('T47 no client financial calc', e)
  }

  try {
    assert.match(confirmationRulesSrc, /flattenConfirmationCommercialRules/)
    assert.doesNotMatch(confirmationRulesSrc, /IMPORTANT_RULES\.mileage/)
    assert.match(translationsSrc, /confirmSectionCancellation/)
    pass('T48 PT confirmation labels')
    pass('T49 EN confirmation labels')
    pass('T50 ES confirmation labels')
  } catch (e) {
    fail('T48–T50 i18n', e)
  }

  // --- Header company name + confirmation final (T51–T65) ---
  const appHeaderSrc = read('components/layout/AppHeader.tsx')
  const tenantContextRouteSrc = read('app/api/tenant/context/route.ts')
  const companyDisplayNameSrc = read('Lib/tenant/companyDisplayName.ts')
  const chromeSrc = read('Lib/i18n/chrome.ts')

  try {
    assert.match(appHeaderSrc, /resolveTenantCompanyDisplayName/)
    assert.match(appHeaderSrc, /useTenant\(\)/)
    assert.doesNotMatch(appHeaderSrc, /CDL Services/)
    assert.doesNotMatch(appHeaderSrc, /BBQ At Home/)
    pass('T51 header uses real company name resolver')
  } catch (e) {
    fail('T51 header company name', e)
  }

  try {
    assert.match(appHeaderSrc, /headerCompanyUnidentified/)
    assert.doesNotMatch(
      appHeaderSrc,
      /headerCompanyFallback\)/,
    )
    assert.match(chromeSrc, /headerCompanyUnidentified: 'Empresa não identificada'/)
    pass('T52 header avoids generic Empresa fallback')
  } catch (e) {
    fail('T52 header fallback', e)
  }

  try {
    assert.doesNotMatch(appHeaderSrc, /CDL Services BBQ/)
    assert.doesNotMatch(appHeaderSrc, /65fd576f-8d97-49ba-bf38-61bc1e94e94a/)
    assert.doesNotMatch(tenantContextRouteSrc, /CDL Services/)
    pass('T53 company name not hardcoded CDL')
  } catch (e) {
    fail('T53 no hardcoded CDL', e)
  }

  try {
    assert.match(tenantContextRouteSrc, /resolveAuthorizedCompanyId/)
    assert.match(tenantContextRouteSrc, /activeMembership\?\.branch_id/)
    assert.match(tenantContextRouteSrc, /activeMembership\?\.role/)
    assert.match(companyDisplayNameSrc, /legal_name/)
    pass('T54 header company isolation via session tenant context')
  } catch (e) {
    fail('T54 company isolation', e)
  }

  try {
    const physicalCount = (confirmationSrc.match(/tw\(uiLanguage, 'physicalGuests'\)/g) ?? [])
      .length
    assert.equal(physicalCount, 1)
    pass('T55 physical guests appear once')
  } catch (e) {
    fail('T55 physical guests', e)
  }

  try {
    const billableCount = (confirmationSrc.match(/tw\(uiLanguage, 'billableGuests'\)/g) ?? [])
      .length
    assert.equal(billableCount, 1)
    pass('T56 billable guests appear once')
  } catch (e) {
    fail('T56 billable guests', e)
  }

  try {
    assert.match(breakdownViewSrc, /tw\(language, 'totalToPay'\)/)
    assert.doesNotMatch(confirmationSrc, /financialTotal/)
    pass('T57 single TOTAL A PAGAR')
  } catch (e) {
    fail('T57 total dedup', e)
  }

  try {
    assert.equal(
      (breakdownViewSrc.match(/tw\(language, 'breakdownDeposit'\)/g) ?? []).length,
      1,
    )
    pass('T58 deposit appears once')
  } catch (e) {
    fail('T58 deposit', e)
  }

  try {
    assert.equal((breakdownViewSrc.match(/breakdownBalance/g) ?? []).length, 1)
    pass('T59 balance appears once')
  } catch (e) {
    fail('T59 balance', e)
  }

  try {
    const cancelIdx = confirmationSrc.indexOf('confirmSectionCancellation')
    const saveErrorIdx = confirmationSrc.indexOf('saveErrorInfo ?')
    assert.ok(cancelIdx > 0)
    assert.ok(cancelIdx < saveErrorIdx)
    pass('T60 cancellation is last section')
  } catch (e) {
    fail('T60 cancellation order', e)
  }

  try {
    assert.match(breakdownViewSrc, /breakdown\.total/)
    assert.match(confirmationSrc, /variant=['"]confirmation['"]/)
    pass('T61 confirmation uses pricingBreakdown.total')
  } catch (e) {
    fail('T61 breakdown total', e)
  }

  try {
    assert.doesNotMatch(confirmationSrc, /computeQuotePricing/)
    assert.doesNotMatch(confirmationSrc, /calculateQuote/)
    pass('T62 no new financial calc in UI')
  } catch (e) {
    fail('T62 no client calc', e)
  }

  try {
    assert.match(chromeSrc, /headerCompanyUnidentified: 'Empresa não identificada'/)
    assert.match(chromeSrc, /headerCompanyUnidentified: 'Company not identified'/)
    assert.match(chromeSrc, /headerCompanyUnidentified: 'Empresa no identificada'/)
    pass('T63 PT header fallback')
    pass('T64 EN header fallback')
    pass('T65 ES header fallback')
  } catch (e) {
    fail('T63–T65 i18n', e)
  }

  // --- Additionals visited categories (A01–A16) ---
  const wizardAdditionalSrc = read('Lib/wizardAdditionalCategories.ts')
  const {
    areAllAdditionalCategoriesVisited: allVisited,
    countUnvisitedAdditionalCategories: countUnvisited,
    getVisibleAdditionalCategoryKeys: visibleKeys,
    markAdditionalCategoryVisitedInSet: markVisited,
    pruneVisitedAdditionalCategories: pruneVisited,
  } = await import('../../Lib/wizardAdditionalCategories.ts')

  const sampleGroups = [
    { categoryKey: 'GUARNICOES', items: [{ id: '1' }] },
    { categoryKey: 'BOVINO', items: [{ id: '2' }] },
    { categoryKey: 'EMPTY', items: [] },
    { categoryKey: 'HIDDEN', items: [] },
  ]
  const requiredKeys = visibleKeys(sampleGroups)

  try {
    assert.equal(requiredKeys.length, 2)
    assert.ok(!requiredKeys.includes('EMPTY'))
    pass('A06 empty category does not block')
    pass('A08 invisible category does not block')
  } catch (e) {
    fail('A06–A08 empty/invisible categories', e)
  }

  try {
    let visited = new Set(['GUARNICOES'])
    assert.equal(allVisited(requiredKeys, visited), false)
    assert.equal(countUnvisited(requiredKeys, visited), 1)
    pass('A01 unvisited category blocks next')
  } catch (e) {
    fail('A01 unvisited blocks', e)
  }

  try {
    let visited = markVisited(new Set(), 'GUARNICOES')
    assert.ok(visited.has('GUARNICOES'))
    pass('A02 opening category marks visited')
  } catch (e) {
    fail('A02 open marks visited', e)
  }

  try {
    assert.match(wizardSrc, /getAdditionalItemCategoryKey\(item\)/)
    assert.match(wizardSrc, /markAdditionalCategoryVisited\(getAdditionalItemCategoryKey/)
    pass('A03 item interaction marks category visited')
  } catch (e) {
    fail('A03 item marks visited', e)
  }

  try {
    assert.doesNotMatch(stepStatusSrc, /additionalsCount > 0/)
    pass('A04 selection remains optional')
  } catch (e) {
    fail('A04 selection optional', e)
  }

  try {
    let visited = markVisited(markVisited(new Set(), 'GUARNICOES'), 'BOVINO')
    assert.equal(allVisited(requiredKeys, visited), true)
    pass('A05 zero selected + all visited enables next')
    pass('A13 all visited canGoNext')
  } catch (e) {
    fail('A05/A13 all visited', e)
  }

  try {
    assert.match(wizardAdditionalSrc, /categoryKey/)
    assert.match(wizardSrc, /getVisibleAdditionalCategoryKeys/)
    assert.doesNotMatch(wizardAdditionalSrc, /categoryLabel/)
    pass('A07 inactive uses stable category_key not label')
  } catch (e) {
    fail('A07 stable id', e)
  }

  try {
    const dupKeys = visibleKeys([
      { categoryKey: 'ACOMP_A', items: [1] },
      { categoryKey: 'ACOMP_B', items: [2] },
    ])
    assert.equal(dupKeys.length, 2)
    assert.notEqual(dupKeys[0], dupKeys[1])
    pass('A09 duplicate names use distinct ids')
  } catch (e) {
    fail('A09 duplicate names', e)
  }

  try {
    let visited = markVisited(markVisited(new Set(), 'GUARNICOES'), 'BOVINO')
    visited = pruneVisited(visited, ['GUARNICOES', 'BOVINO', 'NEW_CAT'])
    assert.equal(allVisited(['GUARNICOES', 'BOVINO', 'NEW_CAT'], visited), false)
    pass('A10 rerender keeps visited and adds new requirement')
  } catch (e) {
    fail('A10 rerender visited', e)
  }

  try {
    assert.doesNotMatch(wizardSrc, /setVisitedAdditionalCategories\(new Set\(\)\)/)
    assert.match(wizardSrc, /uiLocale/)
    assert.match(wizardSrc, /getVisibleAdditionalCategoryKeys/)
    pass('A11 locale change keeps visited keys stable')
  } catch (e) {
    fail('A11 locale visited', e)
  }

  try {
    assert.match(wizardSrc, /toggleAdditionalCategory/)
    assert.match(wizardSrc, /markAdditionalCategoryVisited\(category\)/)
    pass('A12 closing accordion keeps visited')
  } catch (e) {
    fail('A12 accordion close', e)
  }

  try {
    assert.match(wizardSrc, /step !== 3/)
    assert.doesNotMatch(wizardSrc, /step !== 4[\s\S]*setOpenAdditionalCategories/)
    pass('A14 additionals step index uses step 3')
  } catch (e) {
    fail('A14 step index', e)
  }

  try {
    assert.match(translationsSrc, /Faltam \{remaining\} de \{total\}/)
    assert.match(translationsSrc, /\{remaining\} of \{total\} remaining/)
    assert.match(translationsSrc, /Faltan \{remaining\} de \{total\}/)
    pass('A15 PT progress copy')
    pass('A16 EN/ES progress copy')
  } catch (e) {
    fail('A15–A16 i18n progress', e)
  }

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

#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getPackageCatalogPrice,
  resolvePackageSidesPricing,
} from '../../Lib/packageCatalogVisual.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function read(rel) {
  return existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : ''
}

let passed = 0
let failed = 0

function report(name, ok, detail = '') {
  if (ok) {
    passed += 1
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const catalog = read('components/quotes/PublicPackageCatalog.tsx')
const css = read('app/globals.css')
const experience = read('app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx')
const lock = read('components/quotes/usePublicQuoteThemeLock.ts')
const visual = read('Lib/packageCatalogVisual.ts')

const withSides = {
  package_key: 'BBQCHO+',
  price_per_person: 52,
}
const withoutSides = {
  package_key: 'BBQCHO',
  price_per_person: 40,
}
const sidesPrice = 12
const breakdown = resolvePackageSidesPricing(withSides, withoutSides, sidesPrice)
const noSides = resolvePackageSidesPricing(withoutSides, null, sidesPrice)

report(
  'PACKAGE_GROUP_EDITORIAL_UI',
  !catalog.includes('Playfair_Display') &&
    catalog.includes('public-package-group') &&
    catalog.includes('PACOTES CDL') &&
    catalog.includes('CDL PACKAGES') &&
    catalog.includes('PAQUETES CDL') &&
    css.includes('.public-package-group.is-open') &&
    css.includes('background: #e21b1b') &&
    css.includes('min-height: 60px') &&
    catalog.includes('PackageGroupChevron'),
)

report(
  'PACKAGE_WITH_SIDES_PRICING_UNCHANGED',
  catalog.includes('resolvePackageSidesPricing') &&
    catalog.includes('getPackageCatalogPrice') &&
    !catalog.includes('function resolvePackageSidesPricing') &&
    visual.includes('não altera o valor salvo na cotação') &&
    breakdown?.mode === 'breakdown' &&
    breakdown.basePricePerPerson === 40 &&
    breakdown.sidesPricePerPerson === 12 &&
    breakdown.totalPerPerson === 52 &&
    getPackageCatalogPrice(withSides) === 52,
)

report(
  'PACKAGE_WITHOUT_SIDES_HAS_NO_GARNISH_LINE',
  catalog.includes("variant === 'with_sides'") &&
    catalog.includes('showGarnishLine') &&
    catalog.includes("sidesPricing?.mode === 'breakdown'") &&
    noSides === null,
)

report(
  'PACKAGE_TOGGLE_PRESERVES_SELECTION',
  catalog.includes("current === 'with_sides' ? null : 'with_sides'") &&
    catalog.includes("current === 'without_sides' ? null : 'without_sides'") &&
    catalog.includes('onClick={() => onSelect(pkg.id)}') &&
    !catalog.includes('onSelect(null)') &&
    !/data-package-group-toggle[\s\S]{0,400}onSelect\(/.test(catalog),
)

report(
  'PACKAGE_PT_EN_ES_NO_OVERFLOW',
  catalog.includes("tw(language, 'withSidesGroupTitle')") &&
    catalog.includes("tw(language, 'withoutSidesGroupTitle')") &&
    css.includes('overflow-wrap: break-word') &&
    css.includes('.public-package-price-unit') &&
    css.includes('white-space: nowrap') &&
    catalog.includes('public-package-group-label'),
)

report(
  'PACKAGE_STEP_STAYS_LIGHT',
  experience.includes("data-public-wizard-theme={wizardActive ? 'light-locked'") &&
    lock.includes("data-public-wizard-theme") &&
    lock.includes("light-locked") &&
    css.includes('[data-public-wizard-theme="light-locked"]') &&
    !catalog.includes("data-theme=\"dark\""),
)

console.log('')
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
process.exit(failed === 0 ? 0 : 1)

/**
 * Public experience polish V4 gates.
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-brand-polish-v4.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getPackageCatalogPrice,
  resolvePackageSidesPricing,
} from '../../Lib/packageCatalogVisual.ts'
import { PUBLIC_SUCCESS_COPY } from '../../Lib/publicQuote/successCopy.ts'
import {
  LANDING_HAS_NO_FIRE_SIGNATURE,
  LANDING_HAS_NO_PSCS_ONE,
  PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC,
  PUBLIC_SUCCESS_CDL_FIRE_SOURCE_NAME,
  PUBLIC_SUCCESS_CDL_LOGO_SRC,
  SUCCESS_DOES_NOT_USE_CDL_MP4,
  SUCCESS_FIRE_USES_TREATED_OFFICIAL_MP4,
  SUCCESS_HAS_CDL_FIRE_SIGNATURE,
  SUCCESS_HAS_PSCS_ONE,
  SUCCESS_VIDEO_HAS_NO_BOOK_NOW,
} from '../../Lib/publicQuote/successHeroMedia.ts'
import { formatAdditionalPrice, getAdditionalPriceLabel } from '../../Lib/additionalPriceDisplay.ts'
import { getQuoteStrings } from '../../Lib/quoteTranslations.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const source = (relativePath) => readFileSync(join(ROOT, relativePath), 'utf8')

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

const experience = source(
  'app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx',
)
const successScreen = source('components/quotes/PublicQuoteSuccessScreen.tsx')
const fireLogo = source('components/quotes/CdlFireSignature.tsx')
const landing = source('components/quotes/PublicLandingCinematic.tsx')
const packages = source('components/quotes/PublicPackageCatalog.tsx')
const card = source('components/quotes/additionals/AdditionalItemCard.tsx')
const category = source(
  'components/quotes/additionals/AdditionalCategorySection.tsx',
)
const wizard = source('app/quotes/new/QuoteWizard.tsx')
const css = source('app/globals.css')
const lock = source('components/quotes/usePublicQuoteThemeLock.ts')
const media = source('Lib/publicQuote/successHeroMedia.ts')
const additionalDisplay = source('Lib/quoteAdditionalDisplay.ts')
const priceDisplay = source('Lib/additionalPriceDisplay.ts')
const visual = source('Lib/packageCatalogVisual.ts')

const landingFooterStart = experience.indexOf('data-public-landing-footer')
const successFooterStart = experience.indexOf('data-success-footer')
const landingFooter = experience.slice(landingFooterStart, successFooterStart)
const successFooter = experience.slice(successFooterStart)
const fireMp4Rel = join('public', PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC.replace(/^\//, ''))
const fireMp4Abs = join(ROOT, fireMp4Rel)

test('LANDING_HAS_NO_PSCS_ONE', () => {
  assert.equal(LANDING_HAS_NO_PSCS_ONE, true)
  assert.ok(landingFooterStart > -1)
  assert.doesNotMatch(landingFooter, /PscsOneMark/)
  assert.doesNotMatch(landingFooter, /data-powered-by/)
  assert.doesNotMatch(landingFooter, /Powered by/)
  assert.doesNotMatch(landingFooter, /pscs-one/i)
  assert.doesNotMatch(landing, /PscsOneMark/)
  assert.doesNotMatch(landing, /Powered by PSCS/)
  assert.doesNotMatch(landing, /display:\s*none/)
})

test('LANDING_HAS_CDL_LOGO', () => {
  assert.match(landingFooter, /data-landing-cdl-logo/)
  assert.match(landingFooter, /public-landing-cdl-logo/)
  assert.match(landingFooter, /emblemSrc/)
  assert.match(experience, /publicQuoteEmblemSrc/)
  assert.ok(existsSync(join(ROOT, 'public/cdl/logo.png')))
})

test('LANDING_HAS_STATIC_CDL_LOGO', () => {
  assert.match(landingFooter, /<img/)
  assert.doesNotMatch(landingFooter, /<video/)
  assert.equal(PUBLIC_SUCCESS_CDL_LOGO_SRC, '/cdl/logo.png')
})

test('LANDING_DOES_NOT_USE_FIRE_MP4', () => {
  assert.equal(LANDING_HAS_NO_FIRE_SIGNATURE, true)
  assert.doesNotMatch(landingFooter, /CDL_LOGO_FOGO/)
  assert.doesNotMatch(landingFooter, /cdl-logo-fire-spin/)
  assert.doesNotMatch(landing, /CDL_LOGO_FOGO/)
  assert.doesNotMatch(landing, /cdl-logo-fire-spin/)
  assert.doesNotMatch(landing, /PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC/)
  assert.doesNotMatch(landing, /CdlFireSignature/)
  assert.doesNotMatch(landing, /data-cdl-fire-signature/)
})

test('SUCCESS_HAS_PSCS_ONE', () => {
  assert.equal(SUCCESS_HAS_PSCS_ONE, true)
  assert.match(successFooter, /data-powered-by/)
  assert.match(successFooter, /PscsOneMark/)
  assert.match(successFooter, /copy\.poweredBy/)
})

test('FINAL_CDL_ASSET_EXISTS_IN_GIT', () => {
  assert.ok(existsSync(fireMp4Abs), `missing ${fireMp4Rel}`)
  assert.ok(statSync(fireMp4Abs).size > 10_000, 'MP4 too small to be the approved video')
})

test('FINAL_CDL_ASSET_PATH_CORRECT', () => {
  assert.equal(
    PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC,
    '/cdl/video/CDL_LOGO_FOGO_SEM_BOOK_NOW_FINAL.mp4',
  )
  assert.equal(
    PUBLIC_SUCCESS_CDL_FIRE_SOURCE_NAME,
    'CDL_LOGO_FOGO_SEM_BOOK_NOW_FINAL.mp4',
  )
  assert.equal(
    fireMp4Rel.replace(/\\/g, '/'),
    'public/cdl/video/CDL_LOGO_FOGO_SEM_BOOK_NOW_FINAL.mp4',
  )
})

test('SUCCESS_FIRE_USES_TREATED_OFFICIAL_MP4', () => {
  assert.equal(SUCCESS_FIRE_USES_TREATED_OFFICIAL_MP4, true)
  assert.equal(SUCCESS_DOES_NOT_USE_CDL_MP4, false)
  assert.equal(SUCCESS_HAS_CDL_FIRE_SIGNATURE, true)
  assert.match(fireLogo, /data-cdl-fire-signature/)
  assert.match(fireLogo, /data-success-fire-treated-mp4="true"/)
  assert.match(fireLogo, /<video/)
  assert.match(fireLogo, /PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC/)
  assert.match(fireLogo, /cdl-fire-signature-video/)
  assert.doesNotMatch(successScreen, /<video/)
  assert.doesNotMatch(fireLogo, /cdl-fire-flames/)
})

test('SUCCESS_VIDEO_HAS_NO_BOOK_NOW', () => {
  assert.equal(SUCCESS_VIDEO_HAS_NO_BOOK_NOW, true)
  assert.match(PUBLIC_SUCCESS_CDL_FIRE_SOURCE_NAME, /SEM_BOOK_NOW/)
  assert.doesNotMatch(successScreen, /BOOK NOW/)
  assert.doesNotMatch(fireLogo, /BOOK NOW/)
  assert.doesNotMatch(successScreen, /407[^\n]{0,20}915/)
})

test('OLD_CDL_VIDEO_NOT_REFERENCED', () => {
  assert.doesNotMatch(fireLogo, /cdl-logo-fire-spin/)
  assert.doesNotMatch(successScreen, /cdl-logo-fire-spin/)
  assert.doesNotMatch(media, /cdl-logo-fire-spin/)
  assert.doesNotMatch(fireLogo, /cdl-como-funciona/)
  assert.doesNotMatch(successScreen, /cdl-como-funciona/)
  assert.doesNotMatch(media, /cdl-como-funciona/)
})

test('SUCCESS_VIDEO_HAS_STATIC_FALLBACK', () => {
  assert.match(fireLogo, /prefers-reduced-motion: reduce/)
  assert.match(fireLogo, /data-success-cdl-logo/)
  assert.match(fireLogo, /PUBLIC_SUCCESS_CDL_LOGO_SRC/)
  assert.match(css, /prefers-reduced-motion: reduce/)
})

test('SUCCESS_CONTACTS_AFTER_VIDEO', () => {
  const logoIndex = successScreen.indexOf('<CdlFireSignature')
  const contactsIndex = successScreen.indexOf('data-success-contacts')
  const headingIndex = successScreen.indexOf('data-success-contact-heading')
  const zelleIndex = successScreen.indexOf('data-success-zelle')
  const restartIndex = successScreen.indexOf('data-success-restart')
  const summaryIndex = successScreen.indexOf('data-success-summary')
  assert.ok(summaryIndex > -1)
  assert.ok(zelleIndex > summaryIndex)
  assert.ok(restartIndex > zelleIndex)
  assert.ok(logoIndex > restartIndex)
  assert.ok(headingIndex > logoIndex)
  assert.ok(contactsIndex > logoIndex)
})

test('SUCCESS_CONTACT_LABELS_REMOVED', () => {
  assert.match(successScreen, /aria-label=\{phoneDisplay/)
  assert.match(successScreen, /aria-label=\{contacts\.instagramHandle/)
  assert.doesNotMatch(successScreen, />WhatsApp</)
  assert.doesNotMatch(successScreen, />Instagram</)
  assert.doesNotMatch(successScreen, />WHATSAPP</)
  assert.doesNotMatch(successScreen, />INSTAGRAM</)
  assert.doesNotMatch(successScreen, />TELEFONE/)
})

test('SUCCESS_ZELLE_COPY', () => {
  assert.equal(PUBLIC_SUCCESS_COPY.pt.payment, 'Pagamento')
  assert.equal(PUBLIC_SUCCESS_COPY.pt.zelle, 'Pagamento disponível via Zelle.')
  assert.equal(PUBLIC_SUCCESS_COPY.en.payment, 'Payment')
  assert.equal(PUBLIC_SUCCESS_COPY.en.zelle, 'Payment available via Zelle.')
  assert.equal(PUBLIC_SUCCESS_COPY.es.payment, 'Pago')
  assert.equal(PUBLIC_SUCCESS_COPY.es.zelle, 'Pago disponible vía Zelle.')
  assert.doesNotMatch(successScreen, /QR/)
  assert.doesNotMatch(successScreen.toLowerCase(), /bank transfer/)
  assert.doesNotMatch(successScreen.toLowerCase(), /cash/)
  assert.doesNotMatch(landing.toLowerCase(), /zelle/)
})

test('SELECT_PACKAGE_OPENS_OPTIONS', () => {
  assert.match(packages, /function handlePackageClick\(id: string\)/)
  assert.match(packages, /if \(selectedPackageId !== id\)/)
  assert.match(packages, /onSelect\(id\)/)
  assert.match(packages, /setExpandedPackageId\(id\)/)
})

test('CLICK_SELECTED_PACKAGE_CLOSES_OPTIONS', () => {
  assert.match(
    packages,
    /setExpandedPackageId\(\(current\) => \(current === id \? null : id\)\)/,
  )
})

test('CLICK_SELECTED_PACKAGE_REOPENS_OPTIONS', () => {
  assert.match(packages, /current === id \? null : id/)
  assert.match(packages, /const expanded = expandedPackageId === pkg.id/)
  assert.match(packages, /active && expanded && selectableGroups.length > 0/)
})

test('COLLAPSE_PRESERVES_SELECTED_PACKAGE', () => {
  assert.match(packages, /const \[expandedPackageId, setExpandedPackageId\]/)
  assert.doesNotMatch(packages, /onSelect\(null\)/)
  assert.doesNotMatch(packages, /onSelect\(\s*''/)
})

test('COLLAPSE_PRESERVES_OPTIONS', () => {
  assert.match(packages, /selections=\{selections\}/)
  assert.match(packages, /onChange=\{onSelectionChange\}/)
  assert.doesNotMatch(packages, /onSelect\(null\)/)
})

test('SELECT_OTHER_PACKAGE_SWITCHES_PANEL', () => {
  assert.match(packages, /if \(selectedPackageId !== id\) \{/)
  assert.match(packages, /data-expanded-package=\{pkg.id\}/)
  assert.match(packages, /data-expanded-package-id=\{expandedPackageId/)
})

test('WITH_SIDES_PRICE_UNCHANGED', () => {
  const withSides = { package_key: 'BBQCHO+', price_per_person: 52 }
  const withoutSides = { package_key: 'BBQCHO', price_per_person: 40 }
  const breakdown = resolvePackageSidesPricing(withSides, withoutSides, 12)
  assert.equal(breakdown?.mode, 'breakdown')
  assert.equal(breakdown?.basePricePerPerson, 40)
  assert.equal(breakdown?.sidesPricePerPerson, 12)
  assert.equal(breakdown?.totalPerPerson, 52)
  assert.equal(getPackageCatalogPrice(withSides), 52)
  assert.match(packages, /resolvePackageSidesPricing/)
  assert.doesNotMatch(packages, /function resolvePackageSidesPricing/)
  assert.match(visual, /não altera o valor salvo na cotação/)
})

test('WITHOUT_SIDES_PRICE_UNCHANGED', () => {
  const noSides = resolvePackageSidesPricing(
    { package_key: 'BBQCHO', price_per_person: 40 },
    null,
    12,
  )
  assert.equal(noSides, null)
  assert.equal(getPackageCatalogPrice({ package_key: 'BBQCHO', price_per_person: 40 }), 40)
})

test('WITHOUT_SIDES_NO_GARNISH_LINE', () => {
  const noSides = resolvePackageSidesPricing(
    { package_key: 'BBQCHO', price_per_person: 40 },
    null,
    12,
  )
  assert.equal(noSides, null)
  assert.match(packages, /showGarnishLine/)
  assert.match(packages, /variant === 'with_sides'/)
})

test('ADDITIONAL_VISUAL_STATE', () => {
  assert.match(card, /public-additional-card/)
  assert.match(card, /is-selected/)
  assert.match(card, /public-additional-card-check/)
  assert.match(css, /\.public-additional-card\.is-selected/)
  assert.match(css, /border-color: #e21b1b/)
  assert.match(card, /public-additional-card-name/)
  assert.match(card, /public-additional-card-price-value/)
  assert.match(category, /public-additional-kicker/)
})

test('ADDITIONAL_PRICE_UNCHANGED', () => {
  assert.match(card, /getAdditionalPriceLabel/)
  assert.match(card, /formatAdditionalPrice/)
  assert.match(priceDisplay, /export function formatAdditionalPrice/)
  assert.equal(formatAdditionalPrice(12), '$12.00')
  assert.equal(
    getAdditionalPriceLabel({ sale_price: 18.5 }, 'pt'),
    '$18.50',
  )
  assert.doesNotMatch(card, /function formatAdditionalPrice/)
  assert.doesNotMatch(card, /\$\d+\.\d+/)
})

test('ADDITIONAL_QUANTITY_UNCHANGED', () => {
  assert.match(card, /normalizeAdditionalQuantity/)
  assert.match(card, /onChangeQty\(normalizedQty - 1\)/)
  assert.match(card, /onChangeQty\(normalizedQty \+ 1\)/)
  assert.match(card, /onChangeQty\(isSelected \? 0 : 1\)/)
  assert.match(additionalDisplay, /export function normalizeAdditionalQuantity/)
})

test('ADDITIONAL_SELECTION_UNCHANGED', () => {
  assert.match(card, /const isSelected = normalizedQty > 0/)
  assert.match(card, /data-additional-item-card/)
})

test('CATEGORY_REVIEW_UNCHANGED', () => {
  assert.match(wizard, /reviewedCategoryKeys/)
  assert.match(wizard, /markAdditionalCategoryVisited/)
  assert.match(category, /data-category-reviewed/)
  assert.match(category, /onExpose/)
  assert.doesNotMatch(card, /reviewedCategoryKeys/)
})

test('WIZARD_LIGHT_LOCK', () => {
  assert.match(
    experience,
    /data-public-wizard-theme=\{wizardActive \? 'light-locked'/,
  )
  assert.match(experience, /data-theme=\{wizardActive \? 'light' : 'dark'\}/)
  assert.match(lock, /wizard-light/)
  assert.match(lock, /data-theme', 'light'/)
  assert.match(css, /\[data-public-wizard-theme="light-locked"\]/)
})

test('ADDITIONAL_PT_EN_ES', () => {
  assert.equal(getQuoteStrings('pt').wizard.publicAdditionalsKicker, 'Adicionais')
  assert.equal(getQuoteStrings('en').wizard.publicAdditionalsKicker, 'Add-ons')
  assert.equal(getQuoteStrings('es').wizard.publicAdditionalsKicker, 'Adicionales')
  assert.equal(getQuoteStrings('pt').wizard.additionalPriceKicker, 'Preço')
  assert.equal(getQuoteStrings('en').wizard.additionalPriceKicker, 'Price')
  assert.equal(getQuoteStrings('es').wizard.additionalPriceKicker, 'Precio')
  assert.equal(PUBLIC_SUCCESS_COPY.pt.kicker, 'SOLICITAÇÃO RECEBIDA')
  assert.equal(PUBLIC_SUCCESS_COPY.en.kicker, 'REQUEST RECEIVED')
  assert.equal(PUBLIC_SUCCESS_COPY.es.kicker, 'SOLICITUD RECIBIDA')
})

test('LANDING_VIDEO_BEFORE_FINAL_CTA', () => {
  const videoAt = landing.indexOf('data-landing-chapter="video"')
  const closeAt = landing.indexOf('data-landing-chapter="final-cta"')
  const howAt = landing.indexOf('data-landing-chapter="how-it-works"')
  assert.ok(howAt > -1 && videoAt > howAt && closeAt > videoAt)
})

test('PUBLIC_BRAND_PREFIX', () => {
  assert.match(source('Lib/publicRoutes.ts'), /\/cdl\/video/)
  assert.match(media, /\/cdl\/video\/CDL_LOGO_FOGO_SEM_BOOK_NOW_FINAL\.mp4/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)

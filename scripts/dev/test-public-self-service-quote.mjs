/**
 * Public Self-Service Quote V1 — non-mutating source-contract QA.
 *
 * This script reads repository files only. It does not start a server, call
 * Supabase/Vercel, or write fixtures. Runtime, RLS and browser E2E checks are
 * intentionally separate gates documented in:
 *   docs/architecture/public-self-service-quote.md
 *
 * Usage:
 *   node scripts/dev/test-public-self-service-quote.mjs
 */
import assert from 'node:assert/strict'
import { basename } from 'node:path'
import {
  ROOT,
  assertContains,
  assertNoTrackedSecretExposure,
  assertNotContains,
  assertTokensInOrder,
  findPublicQuoteMigrationFiles,
  findReachableByContent,
  listSourceFiles,
  normalizeRepoPath,
  reachableLocalModules,
  readCorpus,
  readSource,
  requireFile,
  sourcesContaining,
} from './qa/public-quote/source-contracts.mjs'

const PUBLIC_ENTRY = 'app/quote/[companySlug]/[locale]/page.tsx'
const INTERNAL_ENTRY = 'app/quotes/new/page.tsx'
const DOC = 'docs/architecture/public-self-service-quote.md'
const PUBLIC_API = {
  session: 'app/api/public/quote-intake/session/route.ts',
  preview: 'app/api/public/quote-intake/preview/route.ts',
  upload: 'app/api/public/quote-intake/upload/route.ts',
  submit: 'app/api/public/quote-intake/submit/route.ts',
}

const allProductSources = listSourceFiles().filter((path) => {
  const relative = normalizeRepoPath(path)
  return !relative.startsWith('scripts/dev/')
})

const publicFeaturePattern =
  /public_quote_enabled|public_self_service|self[_ -]?service[_ -]?quote|quote[_ -]?intake|PublicQuote|publicQuote/i
const publicFeatureFiles = sourcesContaining(
  publicFeaturePattern,
  allProductSources,
)
const publicMigrationFiles = findPublicQuoteMigrationFiles()

let passed = 0
let failed = 0

function pass(name) {
  passed += 1
  console.log(`PASS  ${name}`)
}

function fail(name, error) {
  failed += 1
  console.error(`FAIL  ${name}`)
  console.error(`      ${error instanceof Error ? error.message : error}`)
}

async function test(name, callback) {
  try {
    await callback()
    pass(name)
  } catch (error) {
    fail(name, error)
  }
}

function normalizedSet(paths) {
  return new Set([...paths].map(normalizeRepoPath))
}

function productFeatureCorpus() {
  assert.ok(
    publicFeatureFiles.length > 0,
    'no Public Self-Service Quote implementation source was discovered',
  )
  return readCorpus(publicFeatureFiles)
}

function migrationCorpus() {
  assert.ok(
    publicMigrationFiles.length > 0,
    'no additive Public Self-Service Quote migration was discovered',
  )
  return readCorpus(publicMigrationFiles)
}

await test('T01 canonical public company/locale route exists', () => {
  const source = readSource(PUBLIC_ENTRY)
  assertContains(source, /companySlug/, 'route must resolve a public company slug')
  assertContains(source, /locale/, 'route must resolve a locale segment')

  const publicRoutes = readSource('Lib/publicRoutes.ts')
  assertContains(publicRoutes, /isPathSegmentMatch/, 'public route matching must be segment-aware')
  assertContains(publicRoutes, /['"]\/quote['"]/, 'shared public-route policy must include /quote')
  assertContains(
    publicRoutes,
    /isBackofficeQuotesPathname/,
    '/quotes backoffice must be excluded from the /quote public prefix',
  )
  assertContains(
    publicRoutes,
    /startsWith\(\s*`\$\{prefix\}\/`\s*\)/,
    'public prefixes must not match lookalike paths such as /quote-admin',
  )
})

await test('T02 route accepts only PT, EN and ES', () => {
  const source = readSource(PUBLIC_ENTRY)
  const reachable = readCorpus([...reachableLocalModules(PUBLIC_ENTRY)])
  const corpus = `${source}\n${reachable}`

  for (const locale of ['pt', 'en', 'es']) {
    assertContains(
      corpus,
      new RegExp(`[\\'\"]${locale}[\\'\"]`),
      `missing supported locale ${locale}`,
    )
  }
  assertContains(
    corpus,
    /notFound|invalidLocale|isPublicQuoteLocale|parsePublicQuoteLocale|SUPPORTED_PUBLIC_QUOTE_LOCALES/,
    'invalid locales must be rejected instead of silently accepted',
  )
})

await test('T03 public and internal entry reach one shared wizard core', () => {
  const publicExperience = readSource(
    'app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx',
  )
  assertContains(
    publicExperience,
    /import\s+QuoteWizardCore[\s\S]*?from\s+['"]@\/app\/quotes\/new\/QuoteWizard['"]/,
    'public experience must import the existing wizard as QuoteWizardCore',
  )
  const publicModules = normalizedSet(reachableLocalModules(PUBLIC_ENTRY))
  const internalModules = normalizedSet(reachableLocalModules(INTERNAL_ENTRY))
  const shared = [...publicModules].filter((path) => internalModules.has(path))
  const sharedWizard = shared.filter((path) => {
    const source = readSource(path)
    return /QuoteWizardCore|QuoteWizard\s*\(|function\s+QuoteWizard|data-quote-wizard-core/.test(
      source,
    )
  })

  assert.ok(
    sharedWizard.length > 0,
    `entries do not share a wizard core; shared modules: ${shared.join(', ')}`,
  )

  const duplicateWizardFiles = allProductSources.filter((path) =>
    /(?:Public|Internal|Authenticated)QuoteWizard\.(?:ts|tsx|js|jsx)$/.test(
      basename(path),
    ),
  )
  assert.deepEqual(
    duplicateWizardFiles.map(normalizeRepoPath),
    [],
    'public/internal business-flow wizard duplicates are forbidden',
  )
})

await test('T04 public shell does not render administrative chrome', () => {
  const entrySource = readSource(PUBLIC_ENTRY)
  const experienceSource = readSource(
    'app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx',
  )
  assertContains(
    entrySource,
    /PublicQuoteExperience/,
    'public page must render the dedicated public experience',
  )
  const shellCorpus = `${entrySource}\n${experienceSource}`

  assertNotContains(
    shellCorpus,
    /AdminCompactMenu|CateringSidebar|Platform Admin|Empresa não identificada|LogoutButton/,
    'public shell contains administrative chrome',
  )
  assertContains(
    shellCorpus,
    /Powered by|poweredBy|Catering AI/,
    'public shell must include discreet platform attribution',
  )
})

await test('T05 public catalog/DTO source excludes internal commercial data', () => {
  const publicApiFiles = Object.values(PUBLIC_API).map(requireFile)
  const apiAndBackendFiles = new Set(publicApiFiles)
  for (const route of Object.values(PUBLIC_API)) {
    for (const path of reachableLocalModules(route)) apiAndBackendFiles.add(path)
  }
  assert.ok(
    [...apiAndBackendFiles].some((path) =>
      normalizeRepoPath(path).startsWith('Lib/publicQuote/'),
    ),
    'quote-intake routes must delegate to the shared Lib/publicQuote backend',
  )
  const apiCorpus = readCorpus([...apiAndBackendFiles])
  const publicBoundaryCorpus = readCorpus(
    [...apiAndBackendFiles].filter((path) => {
      const relative = normalizeRepoPath(path)
      return (
        relative.startsWith('app/api/public/quote-intake/') ||
        relative.startsWith('Lib/publicQuote/')
      )
    }),
  )

  assertNotContains(apiCorpus, /\.select\(\s*['"]\*['"]\s*\)/, 'public API uses SELECT *')
  assertNotContains(
    publicBoundaryCorpus,
    /['"](?:cost_price|margin|markup|supplier_id|internal_notes|inventory_quantity|admin_metadata)['"]/i,
    'public API selects or serializes an internal-only field',
  )
  assertNoTrackedSecretExposure(apiCorpus, 'public quote API')
})

await test('T06 intake session uses opaque cookie plus hash, expiry and revocation', () => {
  const featureCorpus = readCorpus([
    ...reachableLocalModules(PUBLIC_API.session),
  ])
  const sql = migrationCorpus()

  assertContains(featureCorpus, /httpOnly\s*:\s*true/i, 'session cookie must be HttpOnly')
  assertContains(featureCorpus, /secure\s*:/i, 'session cookie must define Secure behavior')
  assertContains(
    featureCorpus,
    /sameSite\s*:\s*['"](?:lax|strict)['"]/i,
    'session cookie must define SameSite',
  )
  assertContains(sql, /token_hash/i, 'raw intake tokens must not be stored')
  assertContains(sql, /digest\s*\(|sha-?256/i, 'token hash must use a cryptographic digest')
  assertContains(sql, /expires_at/i, 'intake session must expire')
  assertContains(sql, /revoked_at|status/i, 'intake session must be revocable/finalizable')
  assertNotContains(
    `${featureCorpus}\n${sql}`,
    /proposal_token/i,
    'proposal_token must not be reused for quote intake',
  )
})

await test('T07 abuse controls cover rate, honeypot, payload and idempotency', () => {
  const apiFiles = new Set()
  for (const route of Object.values(PUBLIC_API)) {
    for (const path of reachableLocalModules(route)) apiFiles.add(path)
  }
  const corpus = `${readCorpus([...apiFiles])}\n${migrationCorpus()}`
  assertContains(corpus, /rate[_ -]?limit|too[_ -]?many|429/i, 'rate limiting is missing')
  assertContains(corpus, /honeypot/i, 'honeypot protection is missing')
  assertContains(corpus, /idempoten/i, 'idempotency protection is missing')
  assertContains(
    corpus,
    /payload[_ -]?(?:limit|size)|content-length|MAX_[A-Z_]*(?:BYTES|PAYLOAD)/i,
    'request payload limit is missing',
  )
})

await test('T08 tenant is resolved from slug and not trusted from request body', () => {
  const tenantFiles = new Set([
    ...reachableLocalModules(PUBLIC_ENTRY),
    ...reachableLocalModules(PUBLIC_API.session),
  ])
  const corpus = `${readCorpus([...tenantFiles])}\n${migrationCorpus()}`
  const requestBoundaryCorpus = readCorpus(
    [...tenantFiles].filter((path) => {
      const relative = normalizeRepoPath(path)
      return (
        relative.startsWith('app/api/public/quote-intake/') ||
        relative.startsWith('Lib/publicQuote/') ||
        relative === PUBLIC_ENTRY
      )
    }),
  )
  assertContains(corpus, /companySlug|company_slug|public_slug/i, 'tenant slug resolution is missing')
  assertContains(
    requestBoundaryCorpus,
    /resolve[A-Za-z]*Company[A-Za-z]*Slug|resolve[A-Za-z]*Public[A-Za-z]*Company|\.eq\(\s*['"]slug['"]/,
    'company_id must be resolved server-side from the public slug',
  )
  assertNotContains(
    requestBoundaryCorpus,
    /(?:body|payload|input)\??\.company_?id/i,
    'public request must not select its tenant with company_id',
  )
})

await test('T09 public submit preserves the server Pricing SSOT', () => {
  const submitFiles = new Set([
    ...reachableLocalModules(PUBLIC_API.preview),
    ...reachableLocalModules(PUBLIC_API.submit),
  ])
  const corpus = readCorpus([...submitFiles])

  assertContains(
    corpus,
    /computeQuotePricing|applyServerPricingToQuoteSave|resolveQuotePricingInput|buildPricingBreakdown/,
    'public submit does not call the canonical server pricing pipeline',
  )
  assertNotContains(
    corpus,
    /(?:quoteTotal|quote_total|total)\s*:\s*(?:body|payload|input)\??\./,
    'public submit trusts a browser-supplied total',
  )
})

await test('T10 event address is address-first and retains canonical/manual state', () => {
  const eventFiles = findReachableByContent(
    PUBLIC_ENTRY,
    /AddressAutocompleteFields|PublicQuoteEvent|address-first|fullAddress/i,
  )
  assert.ok(eventFiles.length > 0, 'public event/address UI was not discovered')
  const corpus = readCorpus(eventFiles)
  const addressUi = readSource('app/quotes/new/AddressAutocompleteFields.tsx')

  assertTokensInOrder(
    addressUi,
    /<FieldLabel>\{copy\.search\}<\/FieldLabel>/,
    /<FieldLabel>\{tCommon\(loc,\s*['"]postalCode['"]\)\}<\/FieldLabel>/,
    'full address must render before ZIP/postal code',
  )
  assertContains(corpus, /placeId|place_id/i, 'canonical Google Place id is missing')
  assertContains(
    corpus,
    /formattedAddress|formatted_address/i,
    'canonical formatted address is missing',
  )
  assertContains(corpus, /latitude|lat\b/i, 'canonical latitude is missing')
  assertContains(corpus, /longitude|lng\b/i, 'canonical longitude is missing')
  assertContains(
    corpus,
    /manualFallback|manual_fallback|manualAddress|googleUnavailable/i,
    'controlled manual fallback is missing',
  )
  assertContains(
    corpus,
    /invalidate[A-Za-z]*Place|clear[A-Za-z]*Place|canonical[A-Za-z]*Address/i,
    'manual text edits must invalidate the canonical Place selection',
  )
})

await test('T11 public grill flow is customer-first and validates photo/rental', () => {
  const grillFiles = findReachableByContent(
    PUBLIC_ENTRY,
    /PublicQuoteGrill|hasGrill|grillRentalQty|grillPhoto/i,
  )
  assert.ok(grillFiles.length > 0, 'public grill step was not discovered')
  const uploadFiles = reachableLocalModules(PUBLIC_API.upload)
  const corpus = `${readCorpus(grillFiles)}\n${readCorpus([...uploadFiles])}`

  assertContains(corpus, /hasGrill|possui churrasqueira|Is there a grill|tiene parrilla/i)
  assertContains(corpus, /grillPhoto|foto da churrasqueira|photo of the grill|foto de la parrilla/i)
  assertContains(corpus, /grillRentalQty|rental.*qty|quantidade/i)
  assertContains(corpus, /image\/(?:jpeg|png|webp)|MAX_[A-Z_]*IMAGE|file\.size/i)
  const coreSource = readSource('app/quotes/new/QuoteWizard.tsx')
  assertContains(
    coreSource,
    /\{isEditMode\s*\?\s*\([\s\S]{0,1200}<GrillPhotoStatusField/,
    'operational grill-photo status must stay inside the edit-only branch',
  )
  const publicOnlyCorpus = `${readSource(
    'app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx',
  )}\n${readSource('components/quote-review/PublicQuoteConfirmationStep.tsx')}`
  assertNotContains(
    publicOnlyCorpus,
    /Foto da churrasqueira recebida\?|Grill photo received\?|Pendências de confirmação/i,
    'public grill flow contains operational copy',
  )
})

await test('T12 consent is required and submission reaches a separate success view', () => {
  const files = new Set([
    ...reachableLocalModules(PUBLIC_ENTRY),
    ...reachableLocalModules(PUBLIC_API.submit),
  ])
  const corpus = `${readCorpus([...files])}\n${migrationCorpus()}`
  assertContains(corpus, /contactConsent|consent_at|consentAt/i, 'contact consent is missing')
  assertContains(corpus, /privacyPolicy|privacy_policy/i, 'privacy-policy consent is missing')
  assertContains(corpus, /consentVersion|consent_version/i, 'consent version is not recorded')
  assertContains(corpus, /PublicQuoteSuccess|quote-success|success/i, 'success view is missing')
  assertContains(
    corpus,
    /ready_for_review|review_pending/i,
    'submitted quote review status is missing',
  )
  assertContains(corpus, /public_self_service/i, 'public quote source marker is missing')
})

await test('T13 package theme is a fixed semantic whitelist', () => {
  const corpus = `${productFeatureCorpus()}\n${migrationCorpus()}`
  for (const theme of ['gold', 'bronze', 'navy', 'emerald', 'burgundy', 'slate']) {
    assertContains(corpus, new RegExp(`[\\'\"]${theme}[\\'\"]`), `missing theme ${theme}`)
  }
  assertContains(corpus, /card_theme_key/i, 'generic package theme key is missing')
  assertNotContains(
    corpus,
    /dangerouslySetInnerHTML|style\s*=\s*\{\s*package/i,
    'database package data must not inject CSS/HTML',
  )
})

await test('T14 existing public bearer-token routes remain present', () => {
  for (const path of [
    'app/proposta/[token]/page.tsx',
    'app/designacao-equipe/[token]/page.tsx',
    'app/confirmacao-equipe/[token]/page.tsx',
    'app/confirmacao-guarnicao/[token]/page.tsx',
    'app/conferencia-saida/[token]/page.tsx',
  ]) {
    requireFile(path)
  }
})

await test('T15 architecture/runbook documents DEV-only QA and rollback', () => {
  const source = readSource(DOC)
  for (const pattern of [
    /yasprgtlqclwsjcshtls/,
    /NEVER PROD|NUNCA PROD|PROD.*(?:proibid|never)/i,
    /RLS/,
    /rollback/i,
    /idempoten/i,
    /Playwright|E2E/,
    /catering-ai-agenda-dev\.vercel\.app/,
  ]) {
    assertContains(source, pattern, `documentation is missing ${pattern}`)
  }
})

console.log('')
console.log(`Public Self-Service Quote source QA: ${passed} PASS / ${failed} FAIL`)
console.log(`Repository: ${ROOT}`)

if (failed > 0) process.exitCode = 1

#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
let passed = 0
let failed = 0

function read(rel) {
  const path = join(ROOT, rel)
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

function report(name, ok, detail = '') {
  if (ok) {
    passed += 1
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const migration = read('supabase/migrations/20260822140000_company_media_content_manager.sql')
const experience = read('app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx')
const how = read('components/quotes/PublicQuoteHowItWorks.tsx')
const hero = read('Lib/publicQuote/heroMedia.ts')
const bootstrap = read('Lib/publicQuote/bootstrap.ts')
const perms = read('Lib/auth/permissions.ts')
const session = read('Lib/auth/session.ts')
const nav = read('components/layout/navConfig.ts')
const page = read('app/media/page.tsx')
const assetsApi = read('app/api/media/assets/route.ts')
const fileApi = read('app/api/media/assets/[id]/file/route.ts')
const catalogApi = read('app/api/media/catalog/[kind]/[id]/image/route.ts')
const publicRoutes = read('Lib/publicRoutes.ts')
const wizard = read('app/quotes/new/QuoteWizard.tsx')
const compat = read('Lib/media/compat.ts')
const repo = read('Lib/media/repository.ts')
const seed = read('scripts/dev/seed-cdl-public-media.mjs')
const isolation = read('scripts/dev/test-media-isolation.mjs')

report('TEST 01: Migration targets DEV only and forbids PROD comment', migration.includes('yasprgtlqclwsjcshtls') && migration.includes('NÃO aplicar em Production'))
report('TEST 02: Reuses media_assets (no cdl_hero_images table)', migration.includes('ALTER TABLE public.media_assets') && !migration.includes('cdl_hero_images'))
report('TEST 03: media.view and media.manage permissions', migration.includes('media.view') && migration.includes('media.manage') && perms.includes("'media.manage'"))
report('TEST 04: company-public-media bucket is generic', migration.includes('company-public-media') && !migration.includes('hero-mobile'))
report('TEST 05: anon still revoked from media_assets', migration.includes('REVOKE ALL ON TABLE public.media_assets FROM anon'))
report('TEST 06: Admin page exists and checks media.view', page.includes('media.view') && page.includes('MediaContentManager'))
report('TEST 07: Nav has Media & Content', nav.includes("href: '/media'"))
report('TEST 08: Media write APIs require media.manage', assetsApi.includes("requireApiPermission('media.manage')") && fileApi.includes("requireApiPermission('media.manage')"))
report('TEST 09: Catalog image API does not update price fields', !catalogApi.includes('sale_price') && !catalogApi.includes('charge_type'))
report('TEST 10: Public landing keeps hardcoded fallback', hero.includes('getCompanyPublicHeroMedia') && hero.includes('managed'))
report('TEST 11: Bootstrap loads managed hero/video', bootstrap.includes('loadManagedPublicHero') && bootstrap.includes('fallbackHowItWorksVideo'))
report('TEST 12: How-it-works button still exists', experience.includes('PublicQuoteHowItWorks') && how.includes('data-landing-how-it-works'))
report('TEST 13: Video is not in hero carousel', hero.includes('PUBLIC_QUOTE_HERO_VIDEO_SRCS') && /PUBLIC_QUOTE_HERO_VIDEO_SRCS[^=]*=\s*\[\s*\]/.test(hero))
report('TEST 14: Public /quote remains public and /quotes private', publicRoutes.includes("'/quote'") && publicRoutes.includes('isBackofficeQuotesPathname'))
report('TEST 15: Quote wizard file was not rewritten for dark theme', wizard.includes('entryMode') && !wizard.includes('data-media-content-manager'))
report('TEST 16: Grill photos stay on event entity_type', !migration.includes("entity_type = 'event'"))
report('TEST 17: Seed script preserves CDL public URLs', seed.includes('media_url: photo.src'))
report('TEST 18: Phase B how-it-works is not rendered on public landing', !experience.includes('data-public-how-it-works-section'))
report('TEST 19: Compat layer encodes placement in entity_key', compat.includes('encodePublicEntityKey') && compat.includes('MEDIA_ASSET_SELECT_COMPAT'))
report('TEST 20: Admin APIs use media repository', assetsApi.includes('listCompanyPublicMedia') && fileApi.includes('getCompanyPublicMedia') && repo.includes('PUBLIC_MEDIA_ENTITY_TYPE'))
report('TEST 21: Session keeps media.* fallback until DB is seeded', session.includes("key.startsWith('media.')"))
report('TEST 22: Isolation test covers CDL vs ISO and anon', isolation.includes('iso-isolation-probe') && isolation.includes('anon cannot read'))
report('TEST 23: Seed refuses PROD and does not migrate grill photos', seed.includes('eapwtirhevxrqinytans') && seed.includes("entity_type: ENTITY"))

console.log('')
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
process.exit(failed === 0 ? 0 : 1)

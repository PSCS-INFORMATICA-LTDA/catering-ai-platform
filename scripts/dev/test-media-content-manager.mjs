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
const assetIdApi = read('app/api/media/assets/[id]/route.ts')
const fileApi = read('app/api/media/assets/[id]/file/route.ts')
const editorMigration = read('supabase/migrations/20260822190000_media_editor_meta.sql')
const deleteMigration = read('supabase/migrations/20260822180000_media_delete_permission.sql')
const catalogApi = read('app/api/media/catalog/[kind]/[id]/image/route.ts')
const publicRoutes = read('Lib/publicRoutes.ts')
const wizard = read('app/quotes/new/QuoteWizard.tsx')
const compat = read('Lib/media/compat.ts')
const repo = read('Lib/media/repository.ts')
const manager = read('components/media/MediaContentManager.tsx')
const seed = read('scripts/dev/seed-cdl-public-media.mjs')
const isolation = read('scripts/dev/test-media-isolation.mjs')

report('TEST 01: Migration targets DEV only and forbids PROD comment', migration.includes('yasprgtlqclwsjcshtls') && migration.includes('NÃO aplicar em Production'))
report('TEST 02: Reuses media_assets (no cdl_hero_images table)', migration.includes('ALTER TABLE public.media_assets') && !migration.includes('cdl_hero_images'))
report('TEST 03: media.view and media.manage permissions', migration.includes('media.view') && migration.includes('media.manage') && perms.includes("'media.manage'"))
report('TEST 04: company-public-media bucket is generic', migration.includes('company-public-media') && !migration.includes('hero-mobile'))
report('TEST 05: anon still revoked from media_assets', migration.includes('REVOKE ALL ON TABLE public.media_assets FROM anon'))
report('TEST 06: Admin page exists and checks media.view', page.includes('media.view') && page.includes('MediaContentManager'))
report('TEST 07: Nav has Media & Content', nav.includes("href: '/media'"))
report(
  'TEST 08: Media write APIs require media.manage; DELETE requires media.delete',
  assetsApi.includes("requireApiPermission('media.manage')") &&
    fileApi.includes("requireApiPermission('media.manage')") &&
    assetIdApi.includes("requireApiPermission('media.manage')") &&
    assetIdApi.includes("requireApiPermission('media.delete')") &&
    assetIdApi.includes('hard_delete_required') &&
    deleteMigration.includes('ON CONFLICT (role_key, permission_key)') &&
    editorMigration.includes("has_permission(company_id, 'media.delete')"),
)
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
report(
  'TEST 24: editor_meta is canonical technical config only',
  editorMigration.includes("editor_meta jsonb NOT NULL DEFAULT '{}'") &&
    editorMigration.includes('focus, overlay flags/position') &&
    editorMigration.includes('Not titles') &&
    !editorMigration.includes('__m1') &&
    compat.includes('row.editor_meta = editor') &&
    !compat.includes('serializeEditorEnvelope') &&
    !compat.includes('focal_x') &&
    !compat.includes('overlay_enabled'),
)
report(
  'TEST 25: 1400 keeps active canonical; no status/focal/overlay columns',
  migration.includes('(company_id, placement, active, display_order)') &&
    !migration.includes('ADD COLUMN IF NOT EXISTS status') &&
    !migration.includes('focal_x') &&
    !migration.includes('focal_y') &&
    !migration.includes('overlay_enabled') &&
    !migration.includes('overlay_position') &&
    !migration.includes('media_assets_status_check') &&
    !migration.includes('media_assets_focal_check') &&
    !migration.includes('__m1'),
)
report(
  'TEST 26: 1800 stays idempotent; 1900 keeps permission split',
  deleteMigration.includes('ON CONFLICT (permission_key) DO NOTHING') &&
    deleteMigration.includes('ON CONFLICT (role_key, permission_key) DO NOTHING') &&
    editorMigration.includes("has_permission(company_id, 'media.manage')") &&
    editorMigration.includes("has_permission(company_id, 'media.delete')") &&
    editorMigration.includes("has_permission((storage.foldername(name))[1]::uuid, 'media.manage')") &&
    editorMigration.includes("has_permission((storage.foldername(name))[1]::uuid, 'media.delete')"),
)
report(
  'TEST 27: list falls back to entity_key when placement column is null',
  repo.includes('matchesPublicPlacement') &&
    !repo.includes("query.eq('placement'"),
)
const editAllow = compat.slice(
  compat.indexOf('MEDIA_EDIT_PATCH_ALLOWLIST'),
  compat.indexOf('MEDIA_REPLACE_PATCH_ALLOWLIST'),
)
const patchStart = manager.indexOf("method: 'PATCH'")
const patchPayload = manager.slice(
  patchStart,
  manager.indexOf('const json = (await response.json())', patchStart),
)
report(
  'TEST 28: SAVE MUST NOT MUTATE ENTITY IDENTITY',
  compat.includes('MEDIA_EDIT_PATCH_ALLOWLIST') &&
    !editAllow.includes('entity_key') &&
    !editAllow.includes('media_url') &&
    !editAllow.includes('storage_path') &&
    !editAllow.includes('company_id') &&
    !patchPayload.includes('entity_key') &&
    !patchPayload.includes('display_order') &&
    !patchPayload.includes('media_url') &&
    !patchPayload.includes('storage_path') &&
    !patchPayload.includes('company_id') &&
    manager.includes('/api/media/assets/reorder'),
)

console.log('')
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
process.exit(failed === 0 ? 0 : 1)

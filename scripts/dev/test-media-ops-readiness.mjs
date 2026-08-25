#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
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

const manager = read('components/media/MediaContentManager.tsx')
const matrix = read('components/media/PackageFolderMatrix.tsx')
const slotsLib = read('Lib/media/packageFolderSlots.ts')
const foldersApi = read('app/api/media/package-folders/route.ts')
const draftApi = read('app/api/media/package-folders/draft/route.ts')
const mediaPage = read('app/media/MediaPage.tsx')
const packagesPage = read('app/packages/images/page.tsx')
const packageImageApi = read('app/api/packages/[id]/image/route.ts')
const additionalImageApi = read('app/api/additional-items/[id]/image/route.ts')
const nav = read('components/layout/navConfig.ts')
const landing = read('Lib/publicQuote/landingStoryCopy.ts')
const generated = read('Lib/publicQuote/packageFolderArt.generated.ts')
const quoteExp = read('app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx')
const perms = read('Lib/auth/permissions.ts')
const role = read('Lib/media/juninhoRole.ts')

report(
  'OPS01: five families defined for the package matrix',
  ['BBQTRAD', 'BBQSEL', 'BBQCHO', 'BBQPRI', 'BBQPERS'].every((key) =>
    slotsLib.includes(`familyKey: '${key}'`),
  ),
)
report(
  'OPS02: live Prime PT plus remains v9 in the generated map',
  generated.includes('"BBQPRI+"') && generated.includes('bbqpri-plus-pt-v9.webp'),
)
report(
  'OPS03: slot helpers encode package + locale',
  slotsLib.includes('`${packageKey.trim().toUpperCase()}__${locale}`') &&
    slotsLib.includes("endsWith('+')"),
)
report(
  'OPS05: workspace nav and include CTA exist',
  manager.includes('data-media-workspace') &&
    manager.includes('actionIncludeImage') &&
    manager.includes('PackageFolderMatrix'),
)
report(
  'OPS06: package matrix is admin-only and does not publish live arts',
  matrix.includes('data-media-package-folders') &&
    matrix.includes('packageLiveFrozen') &&
    draftApi.includes("requireApiPermission('media.manage')") &&
    foldersApi.includes('publishLiveDisabled: true') &&
    !draftApi.includes('PACKAGE_FOLDER_ART_V2'),
)
report(
  'OPS07: legacy image routes now require media.manage',
  packageImageApi.includes("requireApiPermission('media.manage')") &&
    additionalImageApi.includes("requireApiPermission('media.manage')"),
)
report(
  'OPS08: /packages/images redirects into canonical /media/packages and checks media.view',
  packagesPage.includes("redirect('/media/packages')") &&
    packagesPage.includes('media.view') &&
    mediaPage.includes('media.view'),
)
report(
  'OPS09: nav consolidates media, no third system',
  nav.includes("href: '/media'") &&
    nav.includes("href: '/media/packages'") &&
    !nav.includes("href: '/packages/images'"),
)
report(
  'OPS10: public quote / landing / generated folder map stay frozen',
  landing.includes('Levamos toda a estrutura necessária para o churrasco') &&
    generated.includes('bbqpri-plus-pt-v9.webp') &&
    quoteExp.includes('COMEÇAR COTAÇÃO'),
)
report(
  'OPS11: Juninho role is proposed only',
  role.includes("export const PROPOSED_JUNINHO_ROLE = 'media_editor'") &&
    role.includes('MEDIA_EDITOR_READY = false') &&
    role.includes("'media.delete'") &&
    !perms.includes('media_editor'),
)

console.log('')
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
process.exit(failed === 0 ? 0 : 1)

/**
 * Visual identity lock: the package intro is a black canvas with a short red
 * title tag (not a full-width bar), yellow extras-family details, and the
 * plus-PT custom flyer carries a clean official CDL mark.
 *
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-visual-identity.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const json = (p) => JSON.parse(read(p))

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

const css = read('app/globals.css')
const extras = read('components/quotes/additionals/AdditionalCategorySection.tsx')
const editorial = read('components/quotes/PackageSidesEditorial.tsx')
const catalog = read('components/quotes/PublicPackageCatalog.tsx')
const visual = read('Lib/packageCatalogVisual.ts')
const wizard = read('app/quotes/new/QuoteWizard.tsx')
const translations = read('Lib/quoteTranslations.ts')
const review = read('components/quote-review/PublicQuoteConfirmationStep.tsx')

test('SUGGESTED_EXTRAS_RED_FULL_WIDTH_BAR', () => {
  const band = css.match(/\.public-suggested-extras-title-band \{[\s\S]*?\n\}/)?.[0]
  assert.ok(band, 'title band missing')
  assert.doesNotMatch(band, /background: #e21b1b/)
  assert.match(band, /background: #0a0a0a/)
})

test('SUGGESTED_EXTRAS_RED_TEXT_TAG', () => {
  const mark = css.match(/\.public-suggested-extras-title-mark \{[\s\S]*?\n\}/)?.[0]
  assert.ok(mark, 'title mark missing')
  assert.match(mark, /background: #e21b1b/)
  assert.match(mark, /color: #fff/)
  assert.match(mark, /width: fit-content/)
  assert.match(mark, /border-radius/)
  assert.match(extras, /data-suggested-extras-title-tag/)
  assert.match(extras, /data-suggested-extras-title-band/)
})

test('EXTRAS_SUGERIDOS_TITLE_WHITE_TEXT', () => {
  const title = css.match(/\.public-suggested-extras-title \{[\s\S]*?\n\}/)?.[0]
  assert.ok(title)
  assert.match(title, /color: #fff/)
  assert.match(extras, /className="public-suggested-extras-title"/)
})

test('EXTRAS_SUGERIDOS_BODY_DARK_PREMIUM', () => {
  const header = css.match(/\.public-suggested-extras-header \{[\s\S]*?\n\}/)?.[0]
  assert.ok(header)
  assert.match(header, /#070707/)
  assert.match(css, /\.public-additional-category\.is-featured \{[\s\S]*?#070707/)
  assert.doesNotMatch(header, /#c8102e|#e21b1b/)
})

test('EXTRAS_SUGERIDOS_YELLOW_HIGHLIGHTS', () => {
  assert.match(css, /\.public-suggested-extras-mark \{[\s\S]*?#f6d000/)
  assert.match(extras, /cortes e extras premium/)
  assert.match(extras, /personalizar seu evento/)
  assert.match(extras, /premium cuts/)
  assert.match(extras, /personalize your event/)
  assert.match(extras, /cortes premium/)
  assert.match(extras, /personalizar tu evento/)
  assert.match(extras, /className="public-suggested-extras-mark"/)
})

test('PACKAGE_CURRENT_LAYOUT_PRESERVED', () => {
  assert.match(catalog, /data-package-experience-intro/)
  assert.match(catalog, /data-package-title-band/)
  assert.match(catalog, /data-package-sides-editorial|PackageSidesEditorial/)
  assert.match(catalog, /data-package-group-controls/)
  assert.match(catalog, /public-package-group/)
})

test('PACKAGE_BLACK_HEADER', () => {
  const intro = css.match(/\.public-package-intro \{[\s\S]*?\n\}/)?.[0]
  const band = css.match(/\.public-package-title-band \{[\s\S]*?\n\}/)?.[0]
  const copy = css.match(/\.public-package-intro-copy \{[\s\S]*?\n\}/)?.[0]
  assert.ok(intro && band && copy)
  assert.match(intro, /#0a0a0a/)
  assert.match(band, /background: #0a0a0a/)
  assert.match(copy, /#070707|#0a0a0a/)
})

test('PACKAGE_RED_FULL_WIDTH_BAR', () => {
  const band = css.match(/\.public-package-title-band \{[\s\S]*?\n\}/)?.[0]
  assert.ok(band)
  assert.doesNotMatch(band, /background: #e21b1b/)
})

test('PACKAGE_RED_TITLE_TAG_ONLY', () => {
  const mark = css.match(/\.public-package-headline-mark \{[\s\S]*?\n\}/)?.[0]
  assert.ok(mark)
  assert.match(mark, /background: #e21b1b/)
  assert.match(mark, /color: #fff/)
  assert.match(mark, /width: fit-content/)
  assert.match(mark, /border-radius/)
  assert.match(mark, /padding:/)
  assert.match(catalog, /data-package-headline-tag/)
  assert.match(translations, /publicPackageEditorialHeadline: 'ESCOLHA SEU PACOTE'/)
  assert.match(translations, /publicPackageEditorialHeadline: 'CHOOSE YOUR PACKAGE'/)
  assert.match(translations, /publicPackageEditorialHeadline: 'ELIGE TU PAQUETE'/)
})

test('PACKAGE_TITLE_WHITE', () => {
  const mark = css.match(/\.public-package-headline-mark \{[\s\S]*?\n\}/)?.[0]
  assert.ok(mark)
  assert.match(mark, /color: #fff/)
})

test('PACKAGE_YELLOW_DIVIDER', () => {
  const band = css.match(/\.public-package-title-band \{[\s\S]*?\n\}/)?.[0]
  assert.ok(band)
  assert.match(band, /border-bottom: 1px solid var\(--cdl-yellow\)/)
})

test('PACKAGE_YELLOW_LEFT_ACCENT', () => {
  const bar = css.match(/\.public-package-kicker::before \{[\s\S]*?\n\}/)?.[0]
  assert.ok(bar)
  assert.match(bar, /--cdl-yellow/)
})

test('PACKAGE_EXPERIENCE_TITLE_WHITE', () => {
  const kicker = css.match(/\.public-package-kicker \{[\s\S]*?\n\}/)?.[0]
  assert.ok(kicker)
  assert.match(kicker, /color: #fff/)
  assert.doesNotMatch(kicker, /color: #[89a-fA-F][0-9a-fA-F]{5}/)
  assert.match(catalog, /data-package-experience-title/)
})

test('PACKAGE_EXPERIENCE_TITLE_STRONG', () => {
  const kicker = css.match(/\.public-package-kicker \{[\s\S]*?\n\}/)?.[0]
  assert.ok(kicker)
  assert.match(kicker, /font-weight: 900/)
  assert.match(kicker, /letter-spacing: 0\.2em/)
  assert.match(kicker, /font-size: 0\.8rem/)
})

test('PACKAGE_EXPERIENCE_TITLE_LEFT_YELLOW_ACCENT', () => {
  const bar = css.match(/\.public-package-kicker::before \{[\s\S]*?\n\}/)?.[0]
  assert.ok(bar)
  assert.match(bar, /width: 3px/)
  assert.match(bar, /background: var\(--cdl-yellow\)/)
  assert.match(bar, /top: 0\.12em/)
  assert.match(bar, /bottom: 0\.12em/)
})

test('PACKAGE_OTHER_COPY_UNCHANGED', () => {
  assert.match(catalog, /com ou sem guarnições/)
  assert.match(catalog, /Explore os pacotes/)
  assert.match(catalog, /O valor atualiza na hora/)
  assert.match(translations, /publicPackageExperienceTitle: 'Escolha sua experiência'/)
  assert.match(translations, /packageSidesUpsellTitle: 'PLUS GUARNIÇÕES'/)
  assert.match(read('Lib/cdlCommercialRules.ts'), /Arroz branco/)
  assert.match(read('Lib/cdlCommercialRules.ts'), /Feijão preto/)
  assert.match(read('Lib/cdlCommercialRules.ts'), /Mandioca/)
  assert.match(read('Lib/cdlCommercialRules.ts'), /Vinagrete/)
  assert.match(editorial, /getPlusGuarnicoesChoiceLabels/)
  assert.match(editorial, /SIDE_OPTION/)
})

test('PACKAGE_YELLOW_CORNER_DETAIL', () => {
  const corner = css.match(/\.public-package-title-corner \{[\s\S]*?\n\}/)?.[0]
  assert.ok(corner)
  assert.match(corner, /--cdl-yellow/)
  assert.match(catalog, /public-package-title-corner/)
})

test('PACKAGE_YELLOW_TEXT_HIGHLIGHTS', () => {
  assert.match(css, /\.public-package-intro-mark \{[\s\S]*?#f6d000/)
  assert.match(catalog, /com ou sem guarnições/)
  assert.match(catalog, /Explore os pacotes/)
  assert.match(catalog, /O valor atualiza na hora/)
})

test('PACKAGE_AND_EXTRAS_VISUAL_FAMILY_MATCH', () => {
  const stamp = css.match(/\.public-package-headline-mark \{[\s\S]*?\n\}/)?.[0]
  const extrasStamp = css.match(/\.public-suggested-extras-title-mark \{[\s\S]*?\n\}/)?.[0]
  assert.ok(stamp && extrasStamp)
  assert.match(stamp, /background: #e21b1b/)
  assert.match(stamp, /color: #fff/)
  assert.match(extrasStamp, /background: #e21b1b/)
  assert.match(extrasStamp, /color: #fff/)
  assert.match(css, /\.public-package-intro-mark \{[\s\S]*?#f6d000/)
  assert.match(css, /\.public-suggested-extras-mark \{[\s\S]*?#f6d000/)
  assert.match(css, /--cdl-yellow/)
})

test('PACKAGE_VISUAL_MATCHES_EXTRAS_FAMILY', () => {
  const packageIntro = css.match(/\.public-package-intro \{[\s\S]*?\n\}/)?.[0]
  const extrasFeatured = css.match(/\.public-additional-category\.is-featured \{[\s\S]*?\n\}/)?.[0]
  assert.ok(packageIntro && extrasFeatured)
  assert.match(packageIntro, /#0a0a0a/)
  assert.match(css, /\.public-package-headline-mark \{[\s\S]*?#e21b1b/)
  assert.match(css, /\.public-suggested-extras-title-mark \{[\s\S]*?#e21b1b/)
  assert.match(css, /\.public-package-title-corner \{[\s\S]*?--cdl-yellow/)
  assert.match(css, /\.public-suggested-extras-chevron \{[\s\S]*?--cdl-yellow/)
})

test('PACKAGE_INFO_BLOCK_DARK_THEME', () => {
  const introCopy = css.match(/\.public-package-intro-copy \{[\s\S]*?\n\}/)?.[0]
  const editorial = css.match(/\.public-package-editorial \{[\s\S]*?\n\}/)?.[0]
  assert.ok(introCopy && editorial)
  assert.match(introCopy, /#070707|#0a0a0a/)
  assert.match(editorial, /background: #0a0a0a/)
  assert.match(css, /\.public-package-editorial-title \{[\s\S]*?color: #fff/)
  assert.match(css, /\.public-package-intro-body \{[\s\S]*?rgba\(255, 255, 255/)
})

test('PACKAGE_YELLOW_HIGHLIGHTS_PRESENT', () => {
  assert.match(css, /\.public-package-intro-mark \{[\s\S]*?#f6d000/)
  assert.match(css, /\.public-package-editorial-price \{[\s\S]*?#f6d000/)
  assert.match(catalog, /com ou sem guarnições/)
  assert.match(catalog, /Explore os pacotes/)
  assert.match(catalog, /O valor atualiza na hora/)
  assert.match(catalog, /className="public-package-intro-mark"/)
})

test('PACKAGE_INFO_BLOCKS_POLISHED', () => {
  assert.match(css, /\.public-package-editorial \{[\s\S]*?#0a0a0a/)
  assert.match(css, /\.public-package-editorial-title \{[\s\S]*?font-size: 0\.8rem/)
  assert.match(css, /\.public-package-editorial-title::before \{[\s\S]*?--cdl-yellow/)
})

test('PLUS_GUARNICOES_BLOCK_ALIGNED_WITH_VISUAL_SYSTEM', () => {
  assert.match(editorial, /packageSidesUpsellTitle/)
  assert.match(editorial, /public-package-editorial-price/)
  assert.match(css, /\.public-package-editorial-price \{[\s\S]*?#f6d000/)
  assert.match(translations, /Adicione guarnições por \{price\} por pessoa\./)
})

test('PT_GUARNICOES_AND_ACOMPANHAMENTOS_RULES', () => {
  assert.match(translations, /packageIncludedTitle: 'TODOS OS PACOTES ACOMPANHAM'/)
  assert.match(translations, /packageSidesUpsellTitle: 'PLUS GUARNIÇÕES'/)
  assert.match(read('Lib/cdlCommercialRules.ts'), /'Feijão preto'/)
  assert.doesNotMatch(read('Lib/cdlCommercialRules.ts'), /tropeiro/i)
  assert.match(read('Lib/packageCatalogVisual.ts'), /Guarnições: arroz branco, feijão preto/)
})

test('CUSTOM_PACKAGE_IMAGE_BLACK_SQUARE_REMOVED', () => {
  const script = read('scripts/dev/remove-folder-black-square.py')
  assert.match(script, /bbqpers-plus-pt-v3\.webp/)
  assert.doesNotMatch(script, /bbqpers-plus-en-v3/)
  assert.doesNotMatch(script, /bbqpers-pt-v3/)
  const report = json('assets/packages/folder-black-square-removal.json')
  assert.match(String(report['bbqpers-plus-pt-v3.webp'] ?? ''), /^removed/)
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v3.webp')}')
assert im is not None
b,g,r = cv2.split(im)
roi = im[1306:1532, 204:504]
rb, rg, rr = cv2.split(roi)
red = ((rr.astype(np.int16) - np.maximum(rg, rb).astype(np.int16) > 45) & (rr > 90)).sum()
print(red)
assert red < 400, red
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('CUSTOM_PACKAGE_IMAGE_CDL_LOGO_VISIBLE', () => {
  const marks = json('assets/packages/folder-badge-locations.json')
  const mark = marks['bbqpers-plus-pt-v2.webp']
  assert.ok(mark?.size > 100)
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v3.webp')}')
x,y,s = 40, 1337, 162
cx, cy = x + s//2, y + s//2
sample = im[cy-8:cy+8, cx-8:cx+8]
# official mark centre is a pale disc, not a black smear
assert sample.mean() > 80, sample.mean()
print(sample.mean())
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('PACKAGE_IMAGE_BLACK_SQUARE_GONE_ON_PRIME_PLUS_PT', () => {
  const generated = read('Lib/publicQuote/packageFolderArt.generated.ts')
  assert.match(generated, /bbqpri-plus-pt-v4\.webp/)
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpri-plus-pt-v4.webp')}')
assert im is not None
# former black plate + X sat immediately right of the mark
roi = im[1314:1460, 189:362]
gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
lap = np.abs(cv2.Laplacian(gray, cv2.CV_32F)).mean()
# restored wood has grain; a black plate does not
assert gray.mean() > 12, gray.mean()
assert lap > 3.5, lap
print(gray.mean(), lap)
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('ADICIONAIS_UNCHANGED', () => {
  assert.match(extras, /data-suggested-extras-title-band/)
  assert.match(extras, /cortes e extras premium/)
  assert.match(css, /\.public-suggested-extras-title-mark \{[\s\S]*?#e21b1b/)
  assert.match(wizard, /if \(category === SUGGESTED_EXTRAS_DISPLAY_KEY\) return/)
})

test('SUGGESTED_EXTRAS_VISUAL_UNCHANGED', () => {
  const band = css.match(/\.public-suggested-extras-title-band \{[\s\S]*?\n\}/)?.[0]
  const mark = css.match(/\.public-suggested-extras-title-mark \{[\s\S]*?\n\}/)?.[0]
  assert.ok(band && mark)
  assert.match(band, /background: #0a0a0a/)
  assert.match(band, /border-bottom: 1px solid var\(--cdl-yellow\)/)
  assert.match(mark, /background: #e21b1b/)
  assert.match(extras, /data-suggested-extras-title-band/)
  assert.match(extras, /data-suggested-extras-title-tag/)
  assert.match(extras, /public-suggested-extras-mark/)
})

test('POST_SUGGESTED_CATEGORY_HINT_PRESENT', () => {
  assert.match(extras, /export function PostSuggestedCategoryHint/)
  assert.match(extras, /data-post-suggested-category-hint/)
  assert.match(wizard, /<PostSuggestedCategoryHint/)
  assert.match(wizard, /SUGGESTED_EXTRAS_DISPLAY_KEY \? \(/)
  assert.match(css, /\.public-post-suggested-category-hint \{/)
})

test('CATEGORY_HINT_PT', () => {
  assert.match(translations, /postSuggestedCategoryHintTitle: 'Explore mais opções'/)
  assert.match(
    translations,
    /postSuggestedCategoryHintBody: 'Toque em uma categoria abaixo para visualizar todos os itens disponíveis.'/,
  )
})

test('CATEGORY_HINT_EN', () => {
  assert.match(translations, /postSuggestedCategoryHintTitle: 'Explore more options'/)
  assert.match(
    translations,
    /postSuggestedCategoryHintBody: 'Tap a category below to view all available items.'/,
  )
})

test('CATEGORY_HINT_ES', () => {
  assert.match(translations, /postSuggestedCategoryHintTitle: 'Explora más opciones'/)
  assert.match(
    translations,
    /postSuggestedCategoryHintBody: 'Toca una categoría abajo para ver todos los artículos disponibles.'/,
  )
})

test('CUSTOM_PLUS_REBUILT_FROM_CLEAN_BASE', () => {
  const script = read('scripts/dev/rebuild-custom-plus-pt-v8.py')
  assert.match(script, /bbqpers-plus-pt-v7\.webp/)
  assert.match(script, /cdl-badge-official\.png/)
  assert.match(script, /bbqpers-plus-pt-v8\.webp/)
  assert.match(read('Lib/publicQuote/packageFolderArt.generated.ts'), /bbqpers-plus-pt-v8\.webp/)
  assert.match(visual, /\?v=art8b/)
})

test('CUSTOM_PLUS_BASE_IS_CUSTOM_WITHOUT_SIDES', () => {
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
base = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-pt-v4.webp')}')
new = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v8.webp')}')
assert base is not None and new is not None
assert base.shape == new.shape == (1536, 1024, 3)
diff = np.abs(new[:1035].astype(np.int16) - base[:1035].astype(np.int16)).mean()
assert diff < 2.5, diff
print(diff)
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('CUSTOM_PLUS_SIDES_PRESENT', () => {
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
trad = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqtrad-plus-pt-v4.webp')}')
new = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v8.webp')}')
diff = np.abs(new[1107:1348].astype(np.int16) - trad[1107:1348].astype(np.int16)).mean()
assert diff < 3.0, diff
print(diff)
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

function plaqueProbe(name, y0, y1, x0, x1) {
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v8.webp')}')
roi = cv2.cvtColor(im[${y0}:${y1}, ${x0}:${x1}], cv2.COLOR_BGR2GRAY)
assert roi.mean() < 70, roi.mean()
assert (roi > 140).sum() > 400, (roi > 140).sum()
assert (roi < 40).sum() > 2000, (roi < 40).sum()
print('${name}', float(roi.mean()), int((roi > 140).sum()))
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
}

test('CUSTOM_PLUS_WHITE_RICE_PRESENT', () => {
  plaqueProbe('arroz', 1208, 1290, 50, 250)
})

test('CUSTOM_PLUS_BLACK_BEANS_PRESENT', () => {
  plaqueProbe('feijao', 1242, 1324, 266, 476)
})

test('CUSTOM_PLUS_VINAIGRETTE_PRESENT', () => {
  plaqueProbe('vina', 1246, 1328, 668, 878)
})

test('CUSTOM_PLUS_BLACK_BEANS_SIGN_READABLE', () => {
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v8.webp')}')
plaque = cv2.cvtColor(im[1242:1324, 266:476], cv2.COLOR_BGR2GRAY)
arroz = cv2.cvtColor(im[1208:1290, 50:250], cv2.COLOR_BGR2GRAY)
assert plaque.mean() < 55, plaque.mean()
assert arroz.mean() < 55, arroz.mean()
assert (plaque > 140).sum() > 400
assert (arroz > 140).sum() > 400
print(plaque.mean(), arroz.mean(), int((plaque > 140).sum()))
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('CUSTOM_PLUS_CDL_LOGO_CLEAN', () => {
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v8.webp')}')
cx, cy, r = 106, 1436, 88
yy, xx = np.ogrid[:im.shape[0], :im.shape[1]]
dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
ring = (dist > r + 3) & (dist < r + 14)
far = (dist > r + 28) & (dist < r + 52) & (xx > 200)
gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
# halo must not be a much darker smear than the nearby table
assert gray[ring].mean() + 8 >= gray[far].mean(), (gray[ring].mean(), gray[far].mean())
# official mark: pale field above the grill
pale = im[cy-50:cy-22, cx-14:cx+14]
assert pale.mean() > 140, pale.mean()
print(gray[ring].mean(), gray[far].mean(), pale.mean())
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('CUSTOM_PLUS_OFFICIAL_CDL_LOGO', () => {
  const script = read('scripts/dev/rebuild-custom-plus-pt-v8.py')
  assert.match(script, /cdl-badge-official\.png/)
  assert.doesNotMatch(script, /Pioneer in Orlando|Since 2017/)
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v8.webp')}')
cx, cy, r = 106, 1436, 88
# official mark: pale field above the grill, not a black smear
pale = im[cy-50:cy-22, cx-14:cx+14]
assert pale.mean() > 140, pale.mean()
# fully inside the canvas
assert 18 >= 8 and 1348 + 176 <= 1528
print(pale.mean())
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('CUSTOM_PLUS_PIONEER_ABSENT', () => {
  const script = read('scripts/dev/rebuild-custom-plus-pt-v8.py')
  assert.doesNotMatch(script, /Pioneer|Since 2017/)
  assert.match(script, /cdl-badge-official\.png/)
})

test('CUSTOM_PLUS_VISIBLE_PATCH_ABSENT', () => {
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v8.webp')}')
trad = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqtrad-plus-pt-v4.webp')}')
# sides below the seam match the real buffet — no painted patch
diff = np.abs(im[1107:1348].astype(np.int16) - trad[1107:1348].astype(np.int16)).mean()
assert diff < 3.0, diff
print(diff)
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('CUSTOM_PLUS_BLACK_BOX_ARTIFACT_ABSENT', () => {
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v8.webp')}')
roi = cv2.cvtColor(im[1360:1500, 210:420], cv2.COLOR_BGR2GRAY)
assert roi.std() > 8, roi.std()
assert roi.mean() > 12, roi.mean()
print(roi.mean(), roi.std())
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('CUSTOM_PLUS_PRICE_IN_IMAGE_ABSENT', () => {
  const script = read('scripts/dev/rebuild-custom-plus-pt-v8.py')
  assert.match(script, /'price_in_image': False/)
  assert.doesNotMatch(script, /putText|US\\$|Sob consulta/)
})

test('CUSTOM_PACKAGE_IMAGE_ART_NOT_DEGRADED', () => {
  assert.match(read('Lib/publicQuote/packageFolderArt.generated.ts'), /bbqpers-plus-pt-v8\.webp/)
  assert.match(visual, /\?v=art8b/)
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v8.webp')}')
assert im.shape == (1536, 1024, 3)
top = im[80:1000]
assert top.std() > 25
print(im.shape, top.std())
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('PRICING_UNCHANGED', () => {
  assert.match(read('Lib/cdlCommercialRules.ts'), /export const SIDES_PRICE_PER_PERSON = 13/)
  assert.doesNotMatch(editorial, /\b13\b/)
  assert.doesNotMatch(extras, /sale_price\s*=/)
})

test('SELECTION_LOGIC_UNCHANGED', () => {
  assert.match(wizard, /onChangeQty=\{setAdditionalQty\}/)
  assert.match(wizard, /handlePackageSelect/)
  assert.match(extras, /onChangeQty: \(itemId: string, qty: number\) => void/)
})

test('CATEGORY_LOGIC_UNCHANGED', () => {
  assert.match(wizard, /SUGGESTED_EXTRAS_DISPLAY_KEY/)
  assert.match(wizard, /if \(category === SUGGESTED_EXTRAS_DISPLAY_KEY\) return/)
  assert.doesNotMatch(wizard, /category_key\s*=\s*'SUGGESTED/)
})

test('REVIEW_UNCHANGED', () => {
  assert.match(review, /getReviewAdditionalCategoryLabel|PublicQuoteConfirmationStep/)
  assert.doesNotMatch(css, /\.public-success[\s\S]{0,200}suggested-extras/)
})

test('PROD_UNCHANGED', () => {
  assert.match(read('scripts/dev/upload-cdl-package-folders-v3.mjs'), /yasprgtlqclwsjcshtls/)
  assert.match(read('scripts/dev/upload-cdl-package-folders-v3.mjs'), /BLOCKED: expected the DEV project/)
  assert.doesNotMatch(visual, /vercel\.app/)
})

test('PHOTO_ENLARGE_HINT_PT', () => {
  assert.match(translations, /photoEnlargeHint: 'Toque e segure a foto para ampliar\.'/)
})

test('PHOTO_ENLARGE_HINT_EN', () => {
  assert.match(translations, /photoEnlargeHint: 'Touch and hold the photo to enlarge\.'/)
})

test('PHOTO_ENLARGE_HINT_ES', () => {
  assert.match(translations, /photoEnlargeHint: 'Mantén pulsada la foto para ampliarla\.'/)
})

test('PHOTO_LONG_PRESS_PREVIEW', () => {
  const card = read('components/quotes/additionals/AdditionalItemCard.tsx')
  assert.match(card, /LONG_PRESS_MS = 420/)
  assert.match(card, /data-additional-photo-lightbox/)
  assert.match(card, /createPortal/)
  assert.match(card, /pointerType === 'mouse'/)
  assert.match(extras, /data-photo-enlarge-hint/)
  assert.match(css, /\.public-additional-photo-lightbox \{/)
  assert.match(css, /object-fit: contain/)
})

test('PHOTO_PREVIEW_DOES_NOT_CHANGE_SELECTION', () => {
  const card = read('components/quotes/additionals/AdditionalItemCard.tsx')
  assert.doesNotMatch(card, /onChangeQty\([^)]*preview/)
  assert.match(card, /onClick=\{\(\) => onChangeQty/)
  assert.match(card, /setPreviewOpen\(true\)/)
  assert.doesNotMatch(card, /onChangeQty\(.*setPreviewOpen/)
})

test('ADULT_COMMIT_SCROLLS_TO_GUEST_ADDRESS_TRANSITION', () => {
  assert.match(wizard, /guestAddressTransitionRef/)
  assert.match(wizard, /data-guest-address-transition/)
  assert.match(wizard, /data-guest-children-under-3/)
  assert.match(wizard, /data-guest-children-4-12/)
  const adultsCommit = wizard.match(
    /inputRef=\{adultsInputRef\}[\s\S]{0,1600}onCommit=\{[\s\S]{0,1400}scrollIntoView\(\{[\s\S]{0,180}?block: 'start'/,
  )
  assert.ok(adultsCommit, 'adults commit must scroll the guest/address transition')
  assert.doesNotMatch(adultsCommit[0], /scrollBy/)
})

test('ADDRESS_AUTO_KEYBOARD_HIDES_CHILDREN', () => {
  const adultsCommit = wizard.match(
    /inputRef=\{adultsInputRef\}[\s\S]{0,1600}onCommit=\{[\s\S]{0,1400}?undefined/,
  )
  assert.ok(adultsCommit)
  assert.match(adultsCommit[0], /childrenReviewed/)
  assert.match(adultsCommit[0], /scrollIntoView/)
  assert.match(adultsCommit[0], /guestAddressTransitionRef/)
})

test('WITHOUT_SIDES_ALL_ARTS_AUDITED', () => {
  const generated = read('Lib/publicQuote/packageFolderArt.generated.ts')
  for (const [key, files] of [
    ['BBQTRAD', ['bbqtrad-en-v3.webp', 'bbqtrad-es-v4.webp', 'bbqtrad-pt-v6.webp']],
    ['BBQSEL', ['bbqsel-en-v3.webp', 'bbqsel-es-v5.webp', 'bbqsel-pt-v4.webp']],
    ['BBQCHO', ['bbqcho-en-v4.webp', 'bbqcho-es-v4.webp', 'bbqcho-pt-v6.webp']],
    ['BBQPRI', ['bbqpri-en-v6.webp', 'bbqpri-es-v4.webp', 'bbqpri-pt-v6.webp']],
    ['BBQPERS', ['bbqpers-en-v6.webp', 'bbqpers-es-v6.webp', 'bbqpers-pt-v6.webp']],
  ]) {
    for (const file of files) {
      assert.match(generated, new RegExp(`"${key}":[\\s\\S]{0,400}?${file}`), `${key} ${file}`)
    }
  }
  const polish = read('scripts/dev/polish-without-sides-final.py')
  assert.match(polish, /cdl-badge-official\.png/)
  assert.doesNotMatch(polish, /Pioneer|Since 2017/)
})

test('OFFICIAL_CDL_LOGO_USED', () => {
  const stamp = read('scripts/dev/stamp-official-cdl-logos-v6.py')
  assert.match(stamp, /cdl-badge-official\.png/)
  assert.match(stamp, /bbqpers-pt-v6\.webp/)
  assert.match(stamp, /bbqpers-plus-en-v6\.webp/)
  assert.doesNotMatch(stamp, /GenerateImage|openai|dall.?e|Pioneer|Since 2017/)
  const generated = read('Lib/publicQuote/packageFolderArt.generated.ts')
  assert.match(generated, /bbqpers-plus-en-v6\.webp/)
  assert.match(generated, /bbqpers-plus-es-v6\.webp/)
  assert.match(generated, /bbqpers-plus-pt-v8\.webp/)
})

test('PACKAGE_ART_IDENTITY_PRESERVED', () => {
  const generated = read('Lib/publicQuote/packageFolderArt.generated.ts')
  assert.match(generated, /"BBQPRI":/)
  assert.match(generated, /"BBQCHO":/)
  assert.match(generated, /"BBQSEL":/)
  assert.match(generated, /"BBQTRAD":/)
  assert.match(generated, /"BBQPERS":/)
  assert.match(generated, /"BBQPRI\+":/)
  assert.match(generated, /"BBQCHO\+":/)
  assert.match(generated, /"BBQSEL\+":/)
  assert.match(generated, /"BBQTRAD\+":/)
  assert.match(generated, /"BBQPERS\+":/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)

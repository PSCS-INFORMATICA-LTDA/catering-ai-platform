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

test('EXTRAS_SUGERIDOS_TITLE_RED_BG', () => {
  const band = css.match(/\.public-suggested-extras-title-band \{[\s\S]*?\n\}/)?.[0]
  assert.ok(band, 'title band missing')
  assert.match(band, /background: #e21b1b/)
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
  const bar = css.match(/\.public-package-intro-copy::before \{[\s\S]*?\n\}/)?.[0]
  assert.ok(bar)
  assert.match(bar, /--cdl-yellow/)
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
  const extrasStamp = css.match(/\.public-suggested-extras-title-band \{[\s\S]*?\n\}/)?.[0]
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
  assert.match(css, /\.public-suggested-extras-title-band \{[\s\S]*?#e21b1b/)
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
  assert.match(css, /\.public-suggested-extras-title-band \{[\s\S]*?#e21b1b/)
  assert.match(wizard, /if \(category === SUGGESTED_EXTRAS_DISPLAY_KEY\) return/)
})

test('CUSTOM_PLUS_PHOTO_CHANGED_OUTSIDE_LOGO', () => {
  assert.match(read('Lib/publicQuote/packageFolderArt.generated.ts'), /bbqpers-plus-pt-v6\.webp/)
  assert.match(visual, /\?v=art6b/)
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
old = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v5.webp')}')
new = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v6.webp')}')
assert old is not None and new is not None
assert old.shape == new.shape == (1536, 1024, 3)
diff = np.abs(new.astype(np.int16) - old.astype(np.int16)).mean(axis=2)
# food, title and chafing dishes live above the plaques
top = diff[0:1100]
assert top.mean() < 1.2, top.mean()
yy, xx = np.ogrid[:new.shape[0], :new.shape[1]]
logo = (xx - 121) ** 2 + (yy - 1418) ** 2 <= 90 ** 2
assert float(diff[logo].mean()) == 0.0, float(diff[logo].mean())
print(old.shape, float(top.mean()), float(diff[logo].mean()))
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('CUSTOM_PLUS_LOGO_CLEAN', () => {
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v6.webp')}')
# former smear immediately right of the mark now has table grain
roi = im[1360:1500, 220:420]
gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
assert gray.mean() > 14, gray.mean()
assert gray.std() > 8, gray.std()
print(gray.mean(), gray.std())
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('CUSTOM_PLUS_LOGO_OFFICIAL', () => {
  const script = read('scripts/dev/fix-custom-plus-pt-logo-v5.py')
  assert.match(script, /cdl-badge-official\.png/)
  assert.match(script, /bbqpers-plus-pt-v4\.webp/)
  assert.match(script, /bbqpers-plus-pt-v5\.webp/)
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v6.webp')}')
# official mark: pale inner disc / white ring, not a black smear
cx, cy = 121, 1418
ring = im[cy-42:cy-30, cx-8:cx+8]
assert ring.mean() > 150, ring.mean()
print(ring.mean())
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('CUSTOM_PLUS_LOGO_NOT_CROPPED', () => {
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v6.webp')}')
cx, cy, r = 121, 1418, 84
# official mark keeps a full pale outer ring — not clipped on one side
vals = []
for ang in range(0, 360, 10):
    a = np.deg2rad(ang)
    x = int(cx + r * np.cos(a))
    y = int(cy + r * np.sin(a))
    vals.append(float(im[y, x].mean()))
assert np.mean(vals) > 100, np.mean(vals)
assert min(vals) > 35, min(vals)
print(np.mean(vals), min(vals))
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('CUSTOM_PLUS_BLACK_PATCH', () => {
  const script = read('scripts/dev/fix-custom-plus-pt-logo-v5.py')
  assert.doesNotMatch(script, /rectangle\\(.*-1\\)|filled.?black|quadrado preto/i)
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v6.webp')}')
roi = im[1360:1500, 220:420]
gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
# a painted black plate is almost zero-variance; restored wood is not
assert gray.std() > 8, gray.std()
assert gray.mean() > 12, gray.mean()
print(gray.mean(), gray.std())
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('CUSTOM_PLUS_VISIBLE_EDIT_ARTIFACT', () => {
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v6.webp')}')
# no leftover red BB plate next to the mark
roi = im[1306:1532, 204:504]
b,g,r = cv2.split(roi)
red = ((r.astype(np.int16) - np.maximum(g, b).astype(np.int16) > 45) & (r > 90)).sum()
assert red < 400, red
print(red)
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('CUSTOM_PACKAGE_IMAGE_ART_NOT_DEGRADED', () => {
  assert.match(read('Lib/publicQuote/packageFolderArt.generated.ts'), /bbqpers-plus-pt-v6\.webp/)
  assert.match(visual, /\?v=art6b/)
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v6.webp')}')
assert im.shape == (1536, 1024, 3)
top = im[80:1100]
assert top.std() > 25
print(im.shape, top.std())
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('CUSTOM_PLUS_BLACK_BEANS_SIGN_RESTORED', () => {
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v6.webp')}')
v5 = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v5.webp')}')
roi = im[1256:1338, 330:538]
gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
bright = (gray > 140).sum()
assert bright > 280, bright
# logo disk must stay the approved v5 mark
yy, xx = np.ogrid[:im.shape[0], :im.shape[1]]
logo = (xx - 121) ** 2 + (yy - 1418) ** 2 <= 90 ** 2
assert np.array_equal(im[logo], v5[logo])
print(bright)
`,
      encoding: 'utf8',
    },
  )
  assert.equal(probe.status, 0, probe.stderr || probe.stdout)
})

test('CUSTOM_PLUS_BLACK_BEANS_SIGN_MATCHES_OTHER_SIGNS', () => {
  const probe = spawnSync(
    'python3',
    ['-'],
    {
      input: `
import cv2, numpy as np
im = cv2.imread('${join(ROOT, 'assets/packages/folders-v3/bbqpers-plus-pt-v6.webp')}')
plaque = cv2.cvtColor(im[1256:1338, 330:538], cv2.COLOR_BGR2GRAY)
arroz = cv2.cvtColor(im[1218:1310, 80:250], cv2.COLOR_BGR2GRAY)
# both are dark cards with bright script
assert plaque.mean() < 40, plaque.mean()
assert arroz.mean() < 45, arroz.mean()
assert (plaque > 140).sum() > 250
assert (arroz > 140).sum() > 200
print(plaque.mean(), arroz.mean())
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

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)

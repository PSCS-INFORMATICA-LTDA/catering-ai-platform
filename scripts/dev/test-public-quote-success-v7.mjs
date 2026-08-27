/**
 * Final Confirmation V7 static gates: the CDL fire plate must be part of the
 * page, not a rectangle laid on top of it.
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-success-v7.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const css = source('app/globals.css')
const signature = source('components/quotes/CdlFireSignature.tsx')
const successScreen = source('components/quotes/PublicQuoteSuccessScreen.tsx')
const experience = source(
  'app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx',
)
const assetScript = source('scripts/dev/build-cdl-fire-safe-asset.mjs')
const media = source('Lib/publicQuote/successHeroMedia.ts')

const landingFooter = experience.slice(
  experience.indexOf('data-public-landing-footer'),
  experience.indexOf('data-success-footer'),
)
const successFooter = (() => {
  const start = experience.indexOf('data-success-footer')
  return experience.slice(start, experience.indexOf('</footer>', start) + 9)
})()

const rule = (selector) => {
  const match = css.match(
    new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]+)\\}`),
  )
  assert.ok(match, `missing rule ${selector}`)
  return match[1]
}

test('DARK_BACKGROUND_CONTINUOUS', () => {
  const success = rule('.public-success')
  // Same tone as --cdl-bg, so header, plate and confirmation share one surface.
  assert.match(success, /--success-bg: #070707/)
  assert.match(success, /background: var\(--success-bg\)/)
  // The accent may not switch on at the section edge under the fire.
  const confirm = rule('.public-success-confirm')
  assert.match(
    confirm,
    /linear-gradient\(to bottom, var\(--success-bg\) 0, rgba\(7, 7, 7, 0\)/,
  )
})

test('NO_CARD_AROUND_VIDEO', () => {
  for (const selector of [
    '.cdl-fire-signature-stage',
    '.public-success-signature-cluster',
  ]) {
    const body = rule(selector)
    assert.match(body, /background: transparent/)
    assert.doesNotMatch(body, /border(-\w+)?:\s*[^0]/)
    assert.doesNotMatch(body, /box-shadow:/)
    assert.doesNotMatch(body, /border-radius:/)
  }
})

test('VIDEO_EDGE_FEATHERING', () => {
  const video = rule('.cdl-fire-signature-video')
  assert.match(video, /-webkit-mask-image: radial-gradient\(\s*circle closest-side/)
  assert.match(video, /\n {2}mask-image: radial-gradient\(\s*circle closest-side/)
  assert.match(video, /object-fit: contain/)
  // The vignette is what actually erases the plate, because Safari drops masks
  // on the video layer.
  const vignette = rule('.cdl-fire-signature-stage::after')
  assert.match(vignette, /radial-gradient\(\s*circle closest-side/)
  assert.match(vignette, /var\(--success-bg, #070707\)/)
  assert.match(vignette, /pointer-events: none/)
})

test('SUBTLE_HALO_ONLY', () => {
  const halo = rule('.cdl-fire-signature-stage::before')
  assert.match(halo, /radial-gradient/)
  assert.match(halo, /pointer-events: none/)
  assert.doesNotMatch(halo, /border/)
  // Nothing in the halo may be strong enough to read as a disc or a badge.
  const alphas = [...halo.matchAll(/rgba\([^)]*?,\s*([\d.]+)\)/g)].map((m) =>
    Number(m[1]),
  )
  assert.ok(alphas.length > 0, 'halo has no rgba stops')
  assert.ok(Math.max(...alphas) <= 0.06, `halo too strong: ${Math.max(...alphas)}`)
})

test('MOBILE_PLATE_SIZE', () => {
  const stage = rule('.cdl-fire-signature-stage')
  assert.match(stage, /width: clamp\(14rem, 70vw, 18rem\)/)
  // Desktop picks up where the mobile clamp tops out, so the plate does not
  // jump size across the breakpoint.
  assert.match(css, /width: clamp\(18rem, 22vw, 19\.5rem\)/)
})

test('MATTE_NEUTRALISED', () => {
  // The matte is black at every radius, so a radial mask cannot remove it.
  const video = rule('.cdl-fire-signature-video')
  assert.match(video, /mix-blend-mode: screen/)
  const success = rule('.public-success')
  assert.match(success, /isolation: isolate/)
})

test('STATIC_LARGE_LOGO_REMOVED', () => {
  // The static mark exists only as a fallback and never renders next to the video.
  assert.match(signature, /const showVideo = !reduceMotion && !videoFailed/)
  assert.match(signature, /\{showVideo \? \(/)
  const marks = signature.match(/data-success-fire-logo-mark/g) || []
  assert.equal(marks.length, 1)
  assert.doesNotMatch(successScreen, /data-success-fire-logo-mark/)
})

test('IOS_VIDEO_ATTRIBUTES', () => {
  for (const attribute of [
    'autoPlay',
    'loop',
    'muted',
    'playsInline',
    'preload="metadata"',
    'controls={false}',
  ]) {
    assert.ok(signature.includes(attribute), `missing ${attribute}`)
  }
})

test('REDUCED_MOTION_PRESERVED', () => {
  assert.match(signature, /prefers-reduced-motion: reduce/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?cdl-fire-signature-video/)
})

test('CDL_LOGO_VISUALLY_LARGER', () => {
  // Bigger stage plus a bigger ring inside the canvas, not just a bigger box.
  assert.match(assetScript, /const RING_SHARE = 0\.655/)
  assert.match(media, /PUBLIC_SUCCESS_CDL_FIRE_RING_SHARE = 0\.655/)
  assert.match(media, /SAFE_V7\.mp4/)
  // V6 stays referenced so the asset swap is reversible.
  assert.match(media, /PUBLIC_SUCCESS_CDL_FIRE_PREVIOUS_MP4_SRC[\s\S]*SAFE_V6\.mp4/)
})

test('SUCCESS_FOOTER_ONLY_POWERED_BY_PSCS_ONE', () => {
  assert.ok(successFooter.includes('data-success-footer'))
  assert.match(successFooter, /\{copy\.poweredBy\}/)
  assert.match(successFooter, /PscsOneMark/)
  for (const removed of [
    'footerSincePioneer',
    'publicQuoteCopyrightLine',
    'getFullYear',
    'copy.privacy',
    'copy.support',
    'data-landing-cdl-logo',
  ]) {
    assert.ok(!successFooter.includes(removed), `success footer still has ${removed}`)
  }
})

test('SUCCESS_PSCS_ONE_BELOW_POWERED_BY', () => {
  assert.ok(
    successFooter.indexOf('copy.poweredBy') < successFooter.indexOf('PscsOneMark'),
    'label must render above the mark',
  )
  const powered = rule('.public-success-powered')
  assert.match(powered, /flex-direction: column/)
  assert.match(powered, /align-items: center/)
  assert.match(powered, /justify-content: center/)
  const footer = rule('.public-success-footer')
  assert.match(footer, /justify-content: center/)
  // Official mark is reused untouched, at the approved footer size.
  assert.match(successFooter, /size="footer"/)
  assert.match(source('components/brand/PscsOneMark.tsx'), /h-\[22px\]/)
})

test('LANDING_NOT_REGRESSED', () => {
  // The landing keeps its own signature; only success was stripped.
  assert.match(landingFooter, /footerSincePioneer/)
  assert.match(landingFooter, /publicQuoteCopyrightLine/)
  assert.match(landingFooter, /data-landing-cdl-logo/)
  assert.ok(!landingFooter.includes('PscsOneMark'))
  assert.ok(!landingFooter.includes('CdlFireSignature'))
})

test('NO_NEW_RUNTIME_DEPENDENCIES', () => {
  // The blend is CSS only: no canvas, no second video, no animation library.
  assert.doesNotMatch(signature, /canvas|requestAnimationFrame|WebGL/i)
  const videos = successScreen.match(/<video/g) || []
  assert.equal(videos.length, 0)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)

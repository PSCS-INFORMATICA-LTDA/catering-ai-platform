/**
 * Final Confirmation V7 — the CDL fire plate has to read as part of the page.
 *
 * The interesting gates here are pixel gates: the plate box is scanned edge by
 * edge looking for the straight step that betrays a rectangle, both as shipped
 * and with the video mask forced off, because Safari drops masks on the video
 * layer and the composition has to survive that.
 *
 *   node scripts/dev/capture-public-quote-success-v7.mjs \
 *     --url http://127.0.0.1:3050 --out /opt/cursor/artifacts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const arg = (name, fallback = '') => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const BASE = (arg('--url') || process.env.PUBLIC_LAYOUT_URL || '').replace(/\/$/, '')
const OUT = arg('--out', '/opt/cursor/artifacts')
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable'

if (!BASE) {
  console.error('Need --url')
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })

const results = []
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=/tmp/chrome-v7-${Date.now()}`,
  ],
})

const shot = async (page, name, clip) => {
  const dest = join(OUT, `${name}.png`)
  await page.screenshot({ path: dest, clip, fullPage: false })
  console.log(`SHOT  ${dest}`)
  return dest
}

async function openSuccess(page, width, height, locale = 'pt') {
  await page.setViewport({ width, height, deviceScaleFactor: 2 })
  await page.goto(`${BASE}/quote/cdl/${locale}`, {
    waitUntil: 'networkidle2',
    timeout: 60_000,
  })
  await page.evaluate(() => {
    sessionStorage.setItem(
      'public-quote-success:cdl',
      JSON.stringify({
        quote: {
          id: '00000000-0000-4000-8000-000000000077',
          number: 'Q-2026-000077',
          eventName: 'Philippe V7',
          eventDate: '2026-09-12',
          total: 1875,
          currency: 'USD',
        },
      }),
    )
    sessionStorage.removeItem('public-quote-active:cdl')
    window.dispatchEvent(new Event('public-quote-success-change'))
  })
  await page.reload({ waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-public-success]', { timeout: 20_000 })
  await page.waitForSelector('[data-cdl-fire-signature]', { timeout: 20_000 })
  await new Promise((r) => setTimeout(r, 900))
}

/**
 * Straight-edge detector. Reads the four sides of the plate box and reports the
 * mean signed step across each one; a rectangle shows up as a consistent step
 * along a whole side, noise does not.
 */
async function plateEdges(page, label) {
  const box = await page.evaluate(() => {
    const el = document.querySelector('.cdl-fire-signature-stage')
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  await new Promise((r) => setTimeout(r, 350))
  const pad = 30
  const clip = {
    x: Math.max(0, Math.round(box.x - pad)),
    y: Math.max(0, Math.round(box.y - pad)),
    width: Math.round(box.w + pad * 2),
    height: Math.round(box.h + pad * 2),
  }
  const b64 = await page.screenshot({ clip, encoding: 'base64' })
  const stats = await page.evaluate(
    async (data, padPx) => {
      const img = new Image()
      img.src = `data:image/png;base64,${data}`
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      const W = canvas.width
      const H = canvas.height
      const scale = window.devicePixelRatio || 1
      const p = Math.round(padPx * scale)
      const lum = (x, y) => {
        const i = (Math.round(y) * W + Math.round(x)) * 4
        return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
      }
      const rgb = (x, y) => {
        const i = (Math.round(y) * W + Math.round(x)) * 4
        return [px[i], px[i + 1], px[i + 2]]
      }
      const step = 3
      const side = (from, to, read) => {
        let sum = 0
        let max = 0
        let n = 0
        for (let t = from; t <= to; t += 1) {
          const [inside, outside] = read(t)
          const d = inside - outside
          sum += d
          if (Math.abs(d) > Math.abs(max)) max = d
          n += 1
        }
        return {
          mean: Math.round((sum / n) * 100) / 100,
          max: Math.round(max * 100) / 100,
        }
      }
      const left = p
      const right = W - p - 1
      const top = p
      const bottom = H - p - 1
      const edges = {
        top: side(left + 4, right - 4, (x) => [lum(x, top + step), lum(x, top - step)]),
        bottom: side(left + 4, right - 4, (x) => [
          lum(x, bottom - step),
          lum(x, bottom + step),
        ]),
        left: side(top + 4, bottom - 4, (y) => [lum(left + step, y), lum(left - step, y)]),
        right: side(top + 4, bottom - 4, (y) => [
          lum(right - step, y),
          lum(right + step, y),
        ]),
      }
      const corners = {
        tl: rgb(left + 4, top + 4),
        tr: rgb(right - 4, top + 4),
        bl: rgb(left + 4, bottom - 4),
        br: rgb(right - 4, bottom - 4),
      }
      const page_ = {
        tl: rgb(left - 12, top - 12),
        tr: rgb(right + 12, top - 12),
        bl: rgb(left - 12, bottom + 12),
        br: rgb(right + 12, bottom + 12),
      }
      const cornerDelta = Object.keys(corners).map((k) =>
        Math.max(...corners[k].map((v, i) => Math.abs(v - page_[k][i]))),
      )
      return { edges, corners, page: page_, cornerDelta: Math.max(...cornerDelta) }
    },
    b64,
    pad,
  )
  console.log(`  [${label}] ${JSON.stringify(stats.edges)} cornerDelta=${stats.cornerDelta}`)
  return { stats, clip }
}

/**
 * Median rendered luminance per radius ring around the plate centre. The plate's
 * matte is black at every radius, so if it is not neutralised the whole footprint
 * sits under the page level and reads as a faint dark disc — which no edge test
 * catches. Median, so flames do not mask the floor.
 */
async function radialProfile(page) {
  const box = await page.evaluate(() => {
    const el = document.querySelector('.cdl-fire-signature-stage')
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  await new Promise((r) => setTimeout(r, 250))
  const pad = 40
  const clip = {
    x: Math.max(0, Math.round(box.x - pad)),
    y: Math.max(0, Math.round(box.y - pad)),
    width: Math.round(box.w + pad * 2),
    height: Math.round(box.h + pad * 2),
  }
  const b64 = await page.screenshot({ clip, encoding: 'base64' })
  return page.evaluate(
    async (data, padPx) => {
      const img = new Image()
      img.src = `data:image/png;base64,${data}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      const px = ctx.getImageData(0, 0, c.width, c.height).data
      const scale = window.devicePixelRatio || 1
      const p = padPx * scale
      const half = (c.width - p * 2) / 2
      const cx = c.width / 2
      const cy = c.height / 2
      const rings = new Map()
      for (let y = 0; y < c.height; y += 1) {
        for (let x = 0; x < c.width; x += 1) {
          const dx = x - cx
          const dy = y - cy
          const r = Math.sqrt(dx * dx + dy * dy) / half
          if (r > 1.3) continue
          const key = Math.round(r * 20) / 20
          const i = (y * c.width + x) * 4
          const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
          if (!rings.has(key)) rings.set(key, [])
          rings.get(key).push(l)
        }
      }
      // Page level, read well outside the plate.
      const outer = []
      for (const [r, vals] of rings) if (r >= 1.2) outer.push(...vals)
      outer.sort((a, b) => a - b)
      const pageLevel = outer[Math.floor(outer.length / 2)]
      let dip = 0
      let dipAt = 0
      for (const [r, vals] of rings) {
        if (r < 0.3) continue
        const sorted = [...vals].sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)]
        if (pageLevel - median > dip) {
          dip = pageLevel - median
          dipAt = r
        }
      }
      return {
        pageLevel: Math.round(pageLevel * 10) / 10,
        dip: Math.round(dip * 100) / 100,
        dipAt: Math.round(dipAt * 100) / 100,
      }
    },
    b64,
    pad,
  )
}

/** Ring bounding box of the current frame, in percent of the plate canvas. */
const ringMargins = (page) =>
  page.evaluate(() => {
    const video = document.querySelector('.cdl-fire-signature-video')
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(video, 0, 0)
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    const w = canvas.width
    const h = canvas.height
    const mask = new Uint8Array(w * h)
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const p = y * w + x
        const i = p * 4
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        if (0.299 * r + 0.587 * g + 0.114 * b > 110 && r - b < 85) mask[p] = 1
      }
    }
    const seen = new Uint8Array(w * h)
    const stack = new Int32Array(w * h)
    let best = null
    for (let start = 0; start < mask.length; start += 1) {
      if (!mask[start] || seen[start]) continue
      let top = 0
      stack[top++] = start
      seen[start] = 1
      let size = 0
      let x0 = w
      let y0 = h
      let x1 = -1
      let y1 = -1
      while (top > 0) {
        const p = stack[--top]
        const x = p % w
        const y = (p - x) / w
        size += 1
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
            const np = ny * w + nx
            if (mask[np] && !seen[np]) {
              seen[np] = 1
              stack[top++] = np
            }
          }
        }
      }
      if (!best || size > best.size) best = { size, x0, y0, x1, y1 }
    }
    if (!best) return null
    const pct = (value, span) => Math.round((value / span) * 1000) / 10
    return {
      left: pct(best.x0, w),
      right: pct(w - 1 - best.x1, w),
      top: pct(best.y0, h),
      bottom: pct(h - 1 - best.y1, h),
    }
  })

const seekFire = (page, time) =>
  page.evaluate(
    (t) =>
      new Promise((resolve) => {
        const video = document.querySelector('.cdl-fire-signature-video')
        if (!video) return resolve(false)
        video.pause()
        const done = () => {
          video.removeEventListener('seeked', done)
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))
        }
        video.addEventListener('seeked', done)
        video.currentTime = t
      }),
    time,
  )

try {
  // ---- 393 x 852, the viewport the Product Owner reviewed ----------------
  const page = await browser.newPage()
  await openSuccess(page, 393, 852)

  const dom = await page.evaluate(() => {
    const success = document.querySelector('[data-public-success]')
    const video = success.querySelector('.cdl-fire-signature-video')
    const stage = success.querySelector('.cdl-fire-signature-stage')
    const header = document.querySelector('.public-quote-header')
    const cs = (el) => (el ? getComputedStyle(el) : null)
    const stageStyle = cs(stage)
    const videoStyle = cs(video)
    const sigStyle = cs(success.querySelector('[data-cdl-fire-signature]'))
    const clusterStyle = cs(success.querySelector('[data-success-signature-cluster]'))
    const afterStyle = stage ? getComputedStyle(stage, '::after') : null
    const beforeStyle = stage ? getComputedStyle(stage, '::before') : null
    // Any raster/vector mark inside the confirmation that is large enough to
    // read as a second logo.
    const bigMarks = [...success.querySelectorAll('img, svg')]
      .map((el) => ({
        tag: el.tagName,
        src: el.getAttribute('src') || '',
        w: Math.round(el.getBoundingClientRect().width),
        visible: getComputedStyle(el).display !== 'none' && el.offsetParent !== null,
      }))
      .filter((m) => m.visible && m.w >= 64)
    return {
      stage: stage
        ? {
            width: Math.round(stage.getBoundingClientRect().width * 100) / 100,
            background: stageStyle.backgroundImage,
            backgroundColor: stageStyle.backgroundColor,
            border: stageStyle.borderTopWidth,
            radius: stageStyle.borderTopLeftRadius,
            shadow: stageStyle.boxShadow,
            transform: stageStyle.transform,
          }
        : null,
      after: afterStyle
        ? { content: afterStyle.content, background: afterStyle.backgroundImage }
        : null,
      before: beforeStyle
        ? { content: beforeStyle.content, background: beforeStyle.backgroundImage }
        : null,
      video: video
        ? {
            src: video.getAttribute('src') || '',
            autoplay: video.autoplay,
            loop: video.loop,
            muted: video.muted,
            playsInline: video.hasAttribute('playsinline'),
            preload: video.getAttribute('preload'),
            controls: video.controls,
            objectFit: videoStyle.objectFit,
            maskImage: videoStyle.maskImage,
            webkitMaskImage: videoStyle.webkitMaskImage,
            radius: videoStyle.borderTopLeftRadius,
            shadow: videoStyle.boxShadow,
            backgroundColor: videoStyle.backgroundColor,
            mixBlendMode: videoStyle.mixBlendMode,
            intrinsic: `${video.videoWidth}x${video.videoHeight}`,
            paused: video.paused,
          }
        : null,
      signatureBg: sigStyle?.backgroundColor,
      clusterBg: clusterStyle?.backgroundColor,
      successBg: cs(success).backgroundColor,
      successIsolation: cs(success).isolation,
      bodyBg: cs(document.body).backgroundColor,
      bigMarks,
      staticFallbackPresent: !!success.querySelector('[data-success-fire-logo-mark]'),
      headerLogo: !!header?.querySelector('img, svg'),
      headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 0,
      headerLocales: header
        ? [...header.querySelectorAll('[data-locale]')].map((el) =>
            el.getAttribute('data-locale'),
          )
        : [],
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      videoCount: success.querySelectorAll('video').length,
    }
  })

  record(
    'REAL_FIRE_VIDEO_PRESERVED',
    !!dom.video &&
      /CDL_LOGO_FOGO_SEM_BOOK_NOW_SAFE_V6\.mp4$/.test(dom.video.src) &&
      dom.video.intrinsic === '610x610' &&
      dom.videoCount === 1,
    `${dom.video?.src} ${dom.video?.intrinsic} videos=${dom.videoCount}`,
  )

  record(
    'IOS_VIDEO_ATTRIBUTES',
    dom.video.autoplay &&
      dom.video.loop &&
      dom.video.muted &&
      dom.video.playsInline &&
      dom.video.preload === 'metadata' &&
      dom.video.controls === false &&
      dom.video.objectFit === 'contain',
    `autoplay/loop/muted/playsInline/preload=${dom.video.preload}/contain`,
  )

  record(
    'STATIC_LARGE_LOGO_REMOVED',
    dom.bigMarks.length === 0 && dom.staticFallbackPresent === false,
    `large marks in confirmation: ${JSON.stringify(dom.bigMarks)}`,
  )

  record(
    'NO_DUPLICATED_LARGE_LOGO',
    dom.bigMarks.length === 0 && dom.videoCount === 1 && dom.headerLogo,
    `header mark kept=${dom.headerLogo}, extra marks=${dom.bigMarks.length}`,
  )

  record(
    'VIDEO_EDGE_FEATHERING',
    /radial-gradient/.test(dom.video.maskImage) &&
      /radial-gradient/.test(dom.video.webkitMaskImage) &&
      /radial-gradient/.test(dom.after?.background || ''),
    'mask-image + -webkit-mask-image + stage vignette',
  )

  const transparent = (v) => v === 'rgba(0, 0, 0, 0)' || v === 'transparent'
  record(
    'NO_CARD_AROUND_VIDEO',
    transparent(dom.stage.backgroundColor) &&
      dom.stage.border === '0px' &&
      dom.stage.radius === '0px' &&
      dom.stage.shadow === 'none' &&
      transparent(dom.signatureBg) &&
      transparent(dom.clusterBg) &&
      transparent(dom.video.backgroundColor) &&
      dom.video.shadow === 'none',
    'no surface, border, radius or shadow on the plate chain',
  )

  record(
    'MOBILE_PLATE_SIZE',
    dom.stage.width >= 235 && dom.stage.width <= 270,
    `${dom.stage.width}px at 393 (grown from 188.6px)`,
  )

  record(
    'MATTE_NEUTRALISED',
    dom.video.mixBlendMode === 'screen' && dom.successIsolation === 'isolate',
    `mix-blend-mode: ${dom.video.mixBlendMode} over an isolated ${dom.successBg}`,
  )

  record(
    'NO_HORIZONTAL_OVERFLOW',
    dom.scrollWidth <= dom.clientWidth,
    `${dom.scrollWidth} <= ${dom.clientWidth}`,
  )

  // ---- the rectangle gates ------------------------------------------------
  const asShipped = await plateEdges(page, '393 as shipped')
  const EDGE_LIMIT = 2.5
  const shippedWorst = Math.max(
    ...Object.values(asShipped.stats.edges).map((e) => Math.abs(e.mean)),
  )
  record(
    'NO_VISIBLE_VIDEO_RECTANGLE',
    shippedWorst <= EDGE_LIMIT && asShipped.stats.cornerDelta <= 2,
    `worst edge step ${shippedWorst} <= ${EDGE_LIMIT}, corner delta ${asShipped.stats.cornerDelta}`,
  )

  await page.addStyleTag({
    content:
      '.cdl-fire-signature-video{-webkit-mask-image:none !important;mask-image:none !important;}',
  })
  await new Promise((r) => setTimeout(r, 400))
  const noMask = await plateEdges(page, '393 mask dropped')
  const noMaskWorst = Math.max(
    ...Object.values(noMask.stats.edges).map((e) => Math.abs(e.mean)),
  )
  record(
    'NO_RECTANGLE_WITHOUT_MASK_SUPPORT',
    noMaskWorst <= EDGE_LIMIT && noMask.stats.cornerDelta <= 2,
    `Safari worst case: worst edge step ${noMaskWorst}, corner delta ${noMask.stats.cornerDelta}`,
  )
  await page.reload({ waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-cdl-fire-signature]', { timeout: 20_000 })
  await new Promise((r) => setTimeout(r, 900))

  // ---- background continuity ----------------------------------------------
  const continuity = await page.evaluate(async () => {
    const success = document.querySelector('[data-public-success]')
    const r = success.getBoundingClientRect()
    return { top: Math.round(r.top), left: Math.round(r.left) }
  })
  const stripB64 = await page.screenshot({
    clip: { x: 2, y: continuity.top, width: 12, height: 420 },
    encoding: 'base64',
  })
  const strip = await page.evaluate(async (data) => {
    const img = new Image()
    img.src = `data:image/png;base64,${data}`
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const x = Math.round(canvas.width / 2)
    let maxStep = 0
    let at = 0
    let prev = null
    for (let y = 2; y < canvas.height - 2; y += 1) {
      const i = (y * canvas.width + x) * 4
      const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
      if (prev !== null && Math.abs(l - prev) > maxStep) {
        maxStep = Math.abs(l - prev)
        at = y
      }
      prev = l
    }
    return { maxStep: Math.round(maxStep * 100) / 100, at, height: canvas.height }
  }, stripB64)
  record(
    'DARK_BACKGROUND_CONTINUOUS',
    strip.maxStep <= 3,
    `largest hard step down the signature/confirmation seam: ${strip.maxStep}`,
  )

  // ---- fire integrity over a full cycle -----------------------------------
  const duration = await page.evaluate(
    () => document.querySelector('.cdl-fire-signature-video').duration,
  )
  const samples = []
  for (let i = 0; i < 12; i += 1) {
    const t = (duration / 12) * i + 0.02
    await seekFire(page, t)
    const m = await ringMargins(page)
    if (m) samples.push({ t: Math.round(t * 100) / 100, ...m })
  }
  const worstRing = Math.min(
    ...samples.flatMap((s) => [s.left, s.right, s.top, s.bottom]),
  )
  record(
    'FIRE_NOT_CROPPED',
    samples.length === 12 && worstRing >= 15,
    `tightest ring margin over ${samples.length} frames: ${worstRing}% of canvas`,
  )

  // Same sweep, this time looking for the plate footprint sitting under the page.
  const profiles = []
  for (let i = 0; i < 12; i += 1) {
    await seekFire(page, (duration / 12) * i + 0.02)
    profiles.push(await radialProfile(page))
  }
  const worstDip = Math.max(...profiles.map((p) => p.dip))
  const dipFrame = profiles.find((p) => p.dip === worstDip)
  record(
    'NO_DARK_HALO',
    worstDip <= 0.6,
    `deepest dip below page level over ${profiles.length} frames: ${worstDip} of 255 at r=${dipFrame.dipAt} (page ${dipFrame.pageLevel})`,
  )
  await page.evaluate(() => document.querySelector('.cdl-fire-signature-video').play())

  const fireClip = await page.evaluate(() => {
    const el = document.querySelector('.cdl-fire-signature-stage')
    const r = el.getBoundingClientRect()
    return {
      x: Math.max(0, Math.round(r.x - 46)),
      y: Math.max(0, Math.round(r.y - 46)),
      width: Math.round(r.width + 92),
      height: Math.round(r.height + 92),
    }
  })
  await shot(page, 'v7_fire_plate_393_closeup', fireClip)
  await page.evaluate(() => window.scrollTo(0, 0))
  await new Promise((r) => setTimeout(r, 300))
  await shot(page, 'v7_success_393_top')
  await page.close()

  // ---- 390 x 844 ----------------------------------------------------------
  const page390 = await browser.newPage()
  await openSuccess(page390, 390, 844)
  const edges390 = await plateEdges(page390, '390 as shipped')
  const worst390 = Math.max(
    ...Object.values(edges390.stats.edges).map((e) => Math.abs(e.mean)),
  )
  const ov390 = await page390.evaluate(() => ({
    s: document.documentElement.scrollWidth,
    c: document.documentElement.clientWidth,
    w: Math.round(
      document.querySelector('.cdl-fire-signature-stage').getBoundingClientRect().width,
    ),
  }))
  record(
    'FINAL_MOBILE_VISUAL',
    worst390 <= EDGE_LIMIT && edges390.stats.cornerDelta <= 2 && ov390.s <= ov390.c,
    `390x844: worst edge ${worst390}, corner delta ${edges390.stats.cornerDelta}, plate ${ov390.w}px`,
  )
  await shot(page390, 'v7_success_390_top')
  await page390.close()

  // ---- PT / EN / ES header smoke -----------------------------------------
  const localePlates = []
  for (const locale of ['pt', 'en', 'es']) {
    const p = await browser.newPage()
    await openSuccess(p, 393, 852, locale)
    const info = await p.evaluate(() => {
      const header = document.querySelector('.public-quote-header')
      const success = document.querySelector('[data-public-success]')
      return {
        headerHeight: Math.round(header.getBoundingClientRect().height),
        headerText: header.innerText.replace(/\s+/g, ' ').trim(),
        plate: Math.round(
          success.querySelector('.cdl-fire-signature-stage').getBoundingClientRect()
            .width,
        ),
        overflow:
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        kicker: success.querySelector('.public-success-kicker')?.innerText.trim() || '',
      }
    })
    localePlates.push(info.plate)
    record(
      `${locale.toUpperCase()}_SMOKE`,
      info.headerHeight >= 48 &&
        info.headerHeight <= 96 &&
        info.overflow &&
        info.plate === localePlates[0] &&
        info.kicker.length > 0,
      `header ${info.headerHeight}px, plate ${info.plate}px, kicker "${info.kicker}"`,
    )
    if (locale !== 'pt') await shot(p, `v7_success_393_${locale}`)
    await p.close()
  }

  // ---- desktop regression -------------------------------------------------
  const desk = await browser.newPage()
  await openSuccess(desk, 1440, 900)
  const deskEdges = await plateEdges(desk, '1440 as shipped')
  const deskWorst = Math.max(
    ...Object.values(deskEdges.stats.edges).map((e) => Math.abs(e.mean)),
  )
  const deskOv = await desk.evaluate(() => ({
    s: document.documentElement.scrollWidth,
    c: document.documentElement.clientWidth,
    w: Math.round(
      document.querySelector('.cdl-fire-signature-stage').getBoundingClientRect().width,
    ),
  }))
  record(
    'DESKTOP_REGRESSION',
    deskWorst <= EDGE_LIMIT && deskEdges.stats.cornerDelta <= 2 && deskOv.s <= deskOv.c,
    `1440x900: worst edge ${deskWorst}, corner delta ${deskEdges.stats.cornerDelta}, plate ${deskOv.w}px`,
  )
  await shot(desk, 'v7_success_desktop_top')
  await desk.close()

  // ---- header untouched ---------------------------------------------------
  record(
    'HEADER_UNCHANGED',
    dom.headerLogo &&
      dom.headerHeight >= 48 &&
      dom.headerHeight <= 96 &&
      dom.headerLocales.length === 3,
    `mark kept, ${dom.headerHeight}px, locales ${dom.headerLocales.join('/')}`,
  )
} finally {
  await browser.close()
}

writeFileSync(join(OUT, 'v7-gates.json'), JSON.stringify(results, null, 2))
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} gates passed`)
if (failed.length) {
  console.error(`FAILED: ${failed.map((r) => r.name).join(', ')}`)
  process.exit(1)
}

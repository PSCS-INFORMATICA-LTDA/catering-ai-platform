/**
 * Final Confirmation V6 runtime QA — fire safe area over a full cycle, logo
 * first, no payment block, premium contact signature.
 *
 *   node scripts/dev/capture-public-quote-success-v6.mjs \
 *     --url http://127.0.0.1:3040 --out /opt/cursor/artifacts
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
    `--user-data-dir=/tmp/chrome-v6-shots-${Date.now()}`,
  ],
})

const shot = async (page, name) => {
  const dest = join(OUT, `${name}.png`)
  await page.screenshot({ path: dest, fullPage: false })
  console.log(`SHOT  ${dest}`)
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
          id: '00000000-0000-4000-8000-000000000076',
          number: 'Q-2026-000076',
          eventName: 'Philippe V6',
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
  await new Promise((r) => setTimeout(r, 600))
}

const overflow = async (page, label) => {
  const m = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  record(
    `OVERFLOW_${label}`,
    m.scrollWidth <= m.innerWidth + 2,
    `${m.scrollWidth}<=${m.innerWidth}+2`,
  )
}

/** Seek the plate to an exact timestamp and wait for the frame to land. */
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

/**
 * Ring bounding box of the current frame, in percent of the plate canvas.
 * The ring is bright and near-neutral; flames are strongly orange (r - b large).
 */
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
    let anyX0 = w
    let anyY0 = h
    let anyX1 = -1
    let anyY1 = -1
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const p = y * w + x
        const i = p * 4
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const lum = 0.299 * r + 0.587 * g + 0.114 * b
        if (lum > 110 && r - b < 85) mask[p] = 1
        if (lum > 24) {
          if (x < anyX0) anyX0 = x
          if (x > anyX1) anyX1 = x
          if (y < anyY0) anyY0 = y
          if (y > anyY1) anyY1 = y
        }
      }
    }
    // Flames and sparks are also bright and neutral when white hot, so keep only
    // the largest connected blob: the ring.
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
      width: pct(best.x1 - best.x0 + 1, w),
      contentLeft: pct(anyX0, w),
      contentRight: pct(w - 1 - anyX1, w),
      contentTop: pct(anyY0, h),
      contentBottom: pct(h - 1 - anyY1, h),
    }
  })

const fireBox = (page) =>
  page.evaluate(() => {
    const stage = document.querySelector('.cdl-fire-signature-stage')
    const video = document.querySelector('.cdl-fire-signature-video')
    const s = stage.getBoundingClientRect()
    const styles = getComputedStyle(stage)
    const videoStyles = getComputedStyle(video)
    return {
      width: Math.round(s.width * 100) / 100,
      height: Math.round(s.height * 100) / 100,
      transform: styles.transform,
      animation: styles.animationName,
      videoTransform: videoStyles.transform,
      objectFit: videoStyles.objectFit,
      intrinsic: `${video.videoWidth}x${video.videoHeight}`,
      currentTime: Math.round(video.currentTime * 100) / 100,
      duration: Math.round(video.duration * 100) / 100,
    }
  })

try {
  // ---- 390 gate viewport -------------------------------------------------
  const page = await browser.newPage()
  await openSuccess(page, 390, 844)

  const dom = await page.evaluate(() => {
    const success = document.querySelector('[data-public-success]')
    const order = [...success.querySelectorAll('*')]
    const indexOf = (selector) => order.indexOf(success.querySelector(selector))
    const rect = (selector) => {
      const el = success.querySelector(selector)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
        height: Math.round(r.height),
      }
    }
    const css = (selector, prop) => {
      const el = success.querySelector(selector)
      return el ? getComputedStyle(el)[prop] : null
    }
    const wa = success.querySelector('[data-success-whatsapp]')
    const ig = success.querySelector('[data-success-instagram]')
    return {
      fireIndex: indexOf('[data-cdl-fire-signature]'),
      kickerIndex: indexOf('.public-success-kicker'),
      summaryIndex: indexOf('[data-success-summary]'),
      restartIndex: indexOf('[data-success-restart]'),
      headingIndex: indexOf('[data-success-contact-heading]'),
      text: success.innerText,
      hasZelleNode: !!success.querySelector('[data-success-zelle]'),
      hasTalkNode: !!success.querySelector('[data-success-talk]'),
      fire: rect('[data-cdl-fire-signature]'),
      stage: rect('.cdl-fire-signature-stage'),
      restart: rect('[data-success-restart]'),
      heading: rect('[data-success-contact-heading]'),
      whatsapp: rect('[data-success-whatsapp]'),
      instagram: rect('[data-success-instagram]'),
      headingStyle: {
        fontSize: css('[data-success-contact-heading]', 'fontSize'),
        fontWeight: css('[data-success-contact-heading]', 'fontWeight'),
        textAlign: css('[data-success-contact-heading]', 'textAlign'),
        color: css('[data-success-contact-heading]', 'color'),
        textTransform: css('[data-success-contact-heading]', 'textTransform'),
      },
      valueStyle: {
        fontSize: css('[data-success-whatsapp]', 'fontSize'),
        fontWeight: css('[data-success-whatsapp]', 'fontWeight'),
        display: css('[data-success-whatsapp]', 'display'),
      },
      iconSize: (() => {
        const icon = success.querySelector(
          '[data-success-whatsapp] .public-success-contact-icon',
        )
        return icon ? Math.round(icon.getBoundingClientRect().width * 10) / 10 : null
      })(),
      whatsappHref: wa?.getAttribute('href') || '',
      whatsappLabel: wa?.getAttribute('aria-label') || '',
      whatsappText: wa?.innerText.trim() || '',
      instagramHref: ig?.getAttribute('href') || '',
      instagramLabel: ig?.getAttribute('aria-label') || '',
      instagramText: ig?.innerText.trim() || '',
      videoSrc:
        success.querySelector('.cdl-fire-signature-video')?.getAttribute('src') || '',
      footerText: document.querySelector('[data-success-footer]')?.innerText || '',
      poweredByLabel:
        document.querySelector('[data-success-footer] [data-powered-by]')
          ?.getAttribute('aria-label') || '',
    }
  })

  record(
    'SUCCESS_LOGO_IS_FIRST_VISUAL',
    dom.fireIndex > -1 &&
      dom.fireIndex < dom.kickerIndex &&
      dom.fireIndex < dom.summaryIndex,
    `fire@${dom.fireIndex} kicker@${dom.kickerIndex} summary@${dom.summaryIndex}`,
  )
  record(
    'SUCCESS_LOGO_ABOVE_THE_FOLD',
    dom.fire.top >= 0 && dom.fire.bottom <= 844,
    `fire top ${dom.fire.top} bottom ${dom.fire.bottom}`,
  )
  record(
    'SUCCESS_FIRE_STAGE_SIZE_390',
    dom.stage.width >= 160 && dom.stage.width <= 210,
    `${dom.stage.width}x${dom.stage.height}px`,
  )
  record(
    'SUCCESS_HAS_NO_PAYMENT_BLOCK',
    !dom.hasZelleNode && !/pagamento|payment|pago/i.test(dom.text),
    dom.hasZelleNode ? 'zelle node present' : 'no payment node/copy',
  )
  record('SUCCESS_HAS_NO_ZELLE_COPY', !/zelle/i.test(dom.text))
  record(
    'SUCCESS_NO_REDUNDANT_TALK_TO_TEAM',
    !dom.hasTalkNode && !/falar com a equipe|fale com a equipe/i.test(dom.text),
  )
  record(
    'SUCCESS_CONTACT_BLOCK_PREMIUM',
    parseFloat(dom.headingStyle.fontSize) >= 17 &&
      parseFloat(dom.headingStyle.fontSize) <= 19 &&
      Number(dom.headingStyle.fontWeight) >= 650 &&
      Number(dom.headingStyle.fontWeight) <= 750 &&
      parseFloat(dom.valueStyle.fontSize) >= 16 &&
      parseFloat(dom.valueStyle.fontSize) <= 18 &&
      Number(dom.valueStyle.fontWeight) >= 600 &&
      Number(dom.valueStyle.fontWeight) <= 700 &&
      dom.iconSize >= 21 &&
      dom.iconSize <= 24,
    `heading ${dom.headingStyle.fontSize}/${dom.headingStyle.fontWeight} ` +
      `value ${dom.valueStyle.fontSize}/${dom.valueStyle.fontWeight} icon ${dom.iconSize}px`,
  )
  const ctaGap = dom.heading.top - dom.restart.bottom
  const headingGap = dom.whatsapp.top - dom.heading.bottom
  const rowGap = dom.instagram.top - dom.whatsapp.bottom
  record(
    'SUCCESS_CONTACT_BLOCK_SPACING',
    ctaGap >= 32 && ctaGap <= 40 && headingGap >= 14 && headingGap <= 18 &&
      rowGap >= 10 && rowGap <= 14,
    `cta->heading ${ctaGap}px heading->wa ${headingGap}px wa->ig ${rowGap}px`,
  )
  const centre = 390 / 2
  const centred = (r) => Math.abs((r.left + r.right) / 2 - centre) <= 2
  record(
    'SUCCESS_CONTACTS_CENTERED',
    centred(dom.heading) && centred(dom.whatsapp) && centred(dom.instagram),
    `heading ${(dom.heading.left + dom.heading.right) / 2} ` +
      `wa ${(dom.whatsapp.left + dom.whatsapp.right) / 2} ` +
      `ig ${(dom.instagram.left + dom.instagram.right) / 2}`,
  )
  record(
    'SUCCESS_WHATSAPP_LINK',
    dom.whatsappHref === 'https://wa.me/14079152242' &&
      dom.whatsappText.includes('+1 (407) 915-2242') &&
      !!dom.whatsappLabel,
    `${dom.whatsappHref} | ${dom.whatsappText} | aria=${dom.whatsappLabel}`,
  )
  record(
    'SUCCESS_INSTAGRAM_LINK',
    dom.instagramHref.includes('instagram.com/cdl.bbq') &&
      dom.instagramText.includes('@cdl.bbq') &&
      !!dom.instagramLabel,
    `${dom.instagramHref} | ${dom.instagramText} | aria=${dom.instagramLabel}`,
  )
  record(
    'SUCCESS_NO_CONTACT_LABELS',
    !/^whatsapp$/im.test(dom.whatsappText) && !/^instagram$/im.test(dom.instagramText),
  )
  record(
    'SUCCESS_FOOTER_PRESERVED',
    /Desde 2017/i.test(dom.footerText) &&
      /©\s*20\d\d/.test(dom.footerText) &&
      /PSCS/i.test(`${dom.footerText} ${dom.poweredByLabel}`),
    `${dom.footerText.replace(/\n+/g, ' | ')} (${dom.poweredByLabel})`,
  )
  record(
    'SUCCESS_USES_TREATED_PLATE',
    dom.videoSrc.includes('CDL_LOGO_FOGO_SEM_BOOK_NOW_SAFE_V6.mp4'),
    dom.videoSrc,
  )
  await overflow(page, '390')

  await shot(page, '01_success_logo_first_390')

  // ---- full cycle: fixed viewport + no layout shift ----------------------
  const meta = await fireBox(page)
  record(
    'SUCCESS_FIRE_CANVAS_SQUARE',
    meta.intrinsic === '610x610' && meta.objectFit === 'contain',
    `${meta.intrinsic} object-fit:${meta.objectFit}`,
  )

  const cycle = []
  const duration = meta.duration || 5.03
  const samples = 24
  for (let i = 0; i < samples; i += 1) {
    // two full cycles worth of phases
    const t = ((i / samples) * 2 * duration) % duration
    await seekFire(page, t)
    cycle.push(await fireBox(page))
  }
  const widths = cycle.map((c) => c.width)
  const heights = cycle.map((c) => c.height)
  record(
    'SUCCESS_FIRE_FIXED_VIEWPORT',
    Math.max(...widths) - Math.min(...widths) < 0.5 &&
      Math.max(...heights) - Math.min(...heights) < 0.5 &&
      cycle.every((c) => c.transform === 'none' && c.videoTransform === 'none') &&
      cycle.every((c) => c.animation === 'none'),
    `w ${Math.min(...widths)}..${Math.max(...widths)} ` +
      `h ${Math.min(...heights)}..${Math.max(...heights)} transform none`,
  )
  record(
    'SUCCESS_FIRE_NO_LAYOUT_SHIFT',
    Math.max(...widths) === Math.min(...widths),
    `${samples} samples over 2 cycles, stage ${widths[0]}px constant`,
  )

  const margins = []
  for (let i = 0; i < 20; i += 1) {
    await seekFire(page, ((i / 20) * 2 * duration) % duration)
    const m = await ringMargins(page)
    if (m) margins.push(m)
  }
  const worst = {
    left: Math.min(...margins.map((m) => m.left)),
    right: Math.min(...margins.map((m) => m.right)),
    top: Math.min(...margins.map((m) => m.top)),
    bottom: Math.min(...margins.map((m) => m.bottom)),
  }
  const widest = Math.max(...margins.map((m) => m.width))
  record(
    'SUCCESS_FIRE_ZERO_CLIPPING',
    margins.length >= 18 &&
      Math.min(worst.left, worst.right, worst.top, worst.bottom) >= 15,
    `${margins.length} frames over 2 cycles, min ring safe area ` +
      `L${worst.left}% R${worst.right}% T${worst.top}% B${worst.bottom}%, ` +
      `widest ring ${widest}% of canvas`,
  )
  const contentWorst = Math.min(
    ...margins.map((m) =>
      Math.min(m.contentLeft, m.contentRight, m.contentTop, m.contentBottom),
    ),
  )
  record(
    'SUCCESS_FIRE_NOTHING_TOUCHES_EDGE',
    contentWorst > 0,
    `closest lit pixel to the canvas edge: ${contentWorst}%`,
  )

  // Frames A/B/C/D across the cycle.
  const frames = [
    ['02_success_fire_frame_a_390', 0.0],
    ['03_success_fire_max_frame_390', 0.2],
    ['04_success_fire_frame_c_390', 2.4],
    ['11_success_fire_frame_d_390', 3.6],
  ]
  for (const [name, t] of frames) {
    await seekFire(page, t)
    await page.evaluate(() =>
      document.querySelector('[data-cdl-fire-signature]')?.scrollIntoView({
        block: 'center',
      }),
    )
    await new Promise((r) => setTimeout(r, 200))
    await shot(page, name)
  }
  await page.evaluate(() => {
    const video = document.querySelector('.cdl-fire-signature-video')
    video?.play?.()
  })

  await page.evaluate(() =>
    document.querySelector('[data-success-summary]')?.scrollIntoView({ block: 'center' }),
  )
  await new Promise((r) => setTimeout(r, 300))
  await shot(page, '05_success_confirmation_summary_390')

  await page.evaluate(() =>
    document
      .querySelector('[data-success-contacts]')
      ?.scrollIntoView({ block: 'center' }),
  )
  await new Promise((r) => setTimeout(r, 300))
  await shot(page, '06_success_contact_block_390')

  await page.evaluate(() =>
    document.querySelector('[data-success-footer]')?.scrollIntoView({ block: 'center' }),
  )
  await new Promise((r) => setTimeout(r, 300))
  await shot(page, '07_success_footer_390')
  await page.close()

  // ---- remaining viewports ----------------------------------------------
  const viewports = [
    ['320x568', 320, 568, '08_success_320'],
    ['360x800', 360, 800, null],
    ['375x812', 375, 812, null],
    ['393x852', 393, 852, null],
    ['414x896', 414, 896, null],
    ['430x932', 430, 932, '09_success_430'],
    ['1440x900', 1440, 900, '10_success_desktop'],
  ]
  for (const [label, width, height, name] of viewports) {
    const vp = await browser.newPage()
    await openSuccess(vp, width, height)
    await overflow(vp, label)
    const check = await vp.evaluate(() => {
      const success = document.querySelector('[data-public-success]')
      const stage = success.querySelector('.cdl-fire-signature-stage')
      const heading = success.querySelector('[data-success-contact-heading]')
      const list = success.querySelector('[data-success-contacts] ul')
      return {
        stageWidth: Math.round(stage.getBoundingClientRect().width),
        text: success.innerText,
        listDirection: getComputedStyle(list).flexDirection,
        headingCentre: Math.round(
          heading.getBoundingClientRect().left + heading.getBoundingClientRect().width / 2,
        ),
      }
    })
    record(
      `SUCCESS_CLEAN_${label}`,
      !/zelle|pagamento|payment|pago/i.test(check.text) &&
        check.listDirection === 'column' &&
        Math.abs(check.headingCentre - width / 2) <= 2,
      `stage ${check.stageWidth}px list ${check.listDirection}`,
    )
    if (name) await shot(vp, name)
    await vp.close()
  }

  // ---- landing regression -------------------------------------------------
  const landing = await browser.newPage()
  await landing.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  await landing.goto(`${BASE}/quote/cdl/pt`, { waitUntil: 'networkidle2' })
  await landing.waitForSelector('[data-public-landing-story]', { timeout: 30_000 })
  const landingState = await landing.evaluate(() => ({
    fire: !!document.querySelector('[data-cdl-fire-signature]'),
    pscs: /PSCS/i.test(document.body.innerText),
    zelle: /zelle/i.test(document.body.innerText),
    brazil: !!document.querySelector('[data-landing-brazil-accent]'),
  }))
  record(
    'LANDING_UNCHANGED',
    !landingState.fire && !landingState.pscs && !landingState.zelle && landingState.brazil,
    JSON.stringify(landingState),
  )
  await overflow(landing, 'LANDING_390')
  await landing.close()
} finally {
  await browser.close()
}

writeFileSync(join(OUT, 'v6-capture.json'), JSON.stringify(results, null, 2))
const failures = results.filter((r) => !r.ok)
console.log(`\n${results.length - failures.length} passed, ${failures.length} failed`)
if (failures.length) process.exit(1)

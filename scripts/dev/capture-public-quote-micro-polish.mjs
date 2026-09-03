/**
 * Micro polish gates: package option reveal, and the review action shell that
 * carries the consent and the submit together.
 *
 *   node scripts/dev/capture-public-quote-micro-polish.mjs \
 *     --url http://127.0.0.1:3080 --out /opt/cursor/artifacts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const arg = (name, fallback = '') => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : fallback
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=/tmp/chrome-micro-${Date.now()}`,
  ],
})

const ADDR = {
  route: 'Lake Nona Boulevard', number: '13801', city: 'Orlando', region: 'FL',
  postalCode: '32827', country: 'US',
  formattedAddress: '13801 Lake Nona Boulevard, Orlando, FL 32827, US', source: 'manual',
}

async function open(page, w, h) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 })
  await page.goto(`${BASE}/quote/cdl/pt`, { waitUntil: 'networkidle2', timeout: 90_000 })
  await page.waitForSelector('[data-public-landing]', { timeout: 45_000 })
}

async function seed(page, step) {
  for (let i = 0; i < 4; i += 1) {
    try {
      await page.evaluate(async (address, currentStep) => {
        const tail = String(Math.floor(Math.random() * 9000) + 1000)
        await fetch('/api/public/quote-intake/session', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ companySlug: 'cdl', locale: 'pt', website: '' }),
        })
        await fetch('/api/public/quote-intake/session', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            website: '', currentStep,
            draft: {
              locale: 'pt',
              contact: { firstName: 'Micro', lastName: 'Polish', phone: `+1407555${tail}` },
              event: {
                eventName: 'Micro Polish', eventDate: '2026-11-14',
                startTime: '18:00', endTime: '22:00', adultCount: 25, address,
              },
            },
          }),
        })
        sessionStorage.setItem('public-quote-active:cdl', '1')
      }, ADDR, step)
      await page.reload({ waitUntil: 'networkidle2' })
      await page.waitForSelector('[data-public-wizard-theme="light-locked"]', { timeout: 30_000 })
      return true
    } catch {
      await wait(2500)
      await page.goto(`${BASE}/quote/cdl/pt`, { waitUntil: 'networkidle2' })
    }
  }
  return false
}

/** The intake session occasionally needs a second attempt to bootstrap. */
async function reachPackages(page, w, h) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await open(page, w, h)
    await seed(page, 2)
    try {
      await page.waitForSelector('[data-package-experience-intro]', { timeout: 45_000 })
      return true
    } catch {
      console.log(`  package step retry ${attempt + 1}`)
      await wait(2000)
    }
  }
  return false
}

async function openPackage(page) {
  await page.waitForSelector('[data-package-experience-intro]', { timeout: 60_000 })
  const group = await page.$('[data-package-group="with_sides"]')
  if (group) {
    const isOpen = await page.$eval('[data-package-group="with_sides"]',
      (n) => n.getAttribute('data-package-group-open') === 'true')
    if (!isOpen) await group.click()
  }
  await page.waitForSelector('[data-package-sides-group="with_sides"]', { timeout: 25_000 })
  await page.click('[data-package-sides-group="with_sides"]')
  await page.waitForFunction(() => document.querySelector('[data-package-selected="true"]'), { timeout: 20_000 })
  await page.waitForSelector('[data-package-option-group]', { timeout: 20_000 })
  await wait(700)
}

/** Usable strip between the sticky header and the sticky step nav. */
const strip = (page) =>
  page.evaluate(() => {
    const h = (s) => {
      const el = document.querySelector(s)
      if (!(el instanceof HTMLElement)) return 0
      if (getComputedStyle(el).position === 'static') return 0
      return el.getBoundingClientRect().height
    }
    const vh = window.visualViewport?.height ?? window.innerHeight
    return { top: h('.public-quote-header'), bottom: h('[data-wizard-step-nav]'), vh }
  })

try {
  for (const [w, h, label] of [[390, 844, '390'], [430, 932, '430']]) {
    // ---------- package option reveal ----------
    const page = await browser.newPage()
    const ready = await reachPackages(page, w, h)
    record(`PACKAGE_STEP_REACHED_${label}`, ready, ready ? 'package step rendered' : 'never reached')
    if (!ready) { await page.close(); continue }
    await openPackage(page)

    const groupCount = await page.evaluate(
      () => document.querySelectorAll('[data-package-option-group]').length,
    )
    const geometry = await page.evaluate(() =>
      [...document.querySelectorAll('[data-package-option-group]')].map((g) => ({
        id: g.getAttribute('data-package-option-group'),
        options: g.querySelectorAll('button[aria-pressed]').length,
      })),
    )
    record(
      `PACKAGE_GROUPS_PRESENT_${label}`,
      groupCount >= 2,
      `${groupCount} option groups: ${geometry.map((g) => `${g.options} opts`).join(', ')}`,
    )

    const s = await strip(page)
    const steps = []
    for (let i = 0; i < groupCount; i += 1) {
      const step = await page.evaluate(
        async (index, insets) => {
          const groups = [...document.querySelectorAll('[data-package-option-group]')]
          const g = groups[index]
          const next = groups[index + 1] ?? null
          const chip = g.querySelector('button[aria-pressed]')
          const usableTop = insets.top + 12
          const usableBottom = insets.vh - insets.bottom - 12
          const visibleOf = (el) => {
            if (!el) return null
            const r = el.getBoundingClientRect()
            return Math.round(
              Math.max(0, Math.min(r.bottom, usableBottom) - Math.max(r.top, usableTop)),
            )
          }
          // Reproduce the reported situation: the chip is visible near the
          // bottom of the usable strip, so whatever follows is below the fold.
          const chipRectBefore = chip.getBoundingClientRect()
          window.scrollBy({
            top: chipRectBefore.bottom - usableBottom + 8,
            behavior: 'auto',
          })
          await new Promise((r) => setTimeout(r, 500))
          const before = {
            scrollY: Math.round(window.scrollY),
            nextVisible: visibleOf(next),
          }
          chip.click()
          await new Promise((r) => setTimeout(r, 1500))
          const chipRect = chip.getBoundingClientRect()
          return {
            index,
            hasNext: Boolean(next),
            before,
            after: {
              scrollY: Math.round(window.scrollY),
              nextVisible: visibleOf(next),
              nextHeight: next ? Math.round(next.getBoundingClientRect().height) : null,
            },
            shifted: Math.round(window.scrollY - before.scrollY),
            chipStillVisible:
              chipRect.top >= usableTop - 1 && chipRect.bottom <= usableBottom + 1,
            chipPressed: chip.getAttribute('aria-pressed') === 'true',
            selections: [...document.querySelectorAll('[data-package-option-group]')]
              .map((gg) => gg.querySelector('button[aria-pressed="true"]') ? 1 : 0)
              .reduce((a, b) => a + b, 0),
            packageStillOpen: Boolean(document.querySelector('[data-public-package-options]')),
          }
        },
        i,
        s,
      )
      steps.push(step)
    }

    const withNext = steps.filter((x) => x.hasNext)
    const last = steps[steps.length - 1]

    record(
      `PACKAGE_OPTION_SCROLL_REVEALS_NEXT_${label}`,
      withNext.every((x) => x.after.nextVisible >= Math.min(72, x.after.nextHeight)),
      withNext
        .map((x) => `g${x.index}: next visible ${x.before.nextVisible}->${x.after.nextVisible}px (shift ${x.shifted})`)
        .join(' | ') || 'no group had a follower',
    )
    record(
      `PACKAGE_LAST_OPTION_NO_EXTRA_SCROLL_${label}`,
      !last.hasNext && last.shifted === 0,
      `last group shifted ${last.shifted}px`,
    )
    record(
      `NO_AGGRESSIVE_SCROLL_${label}`,
      steps.every((x) => Math.abs(x.shifted) <= 260) &&
        steps.every((x) => x.chipStillVisible),
      `largest shift ${Math.max(...steps.map((x) => Math.abs(x.shifted)))}px, chosen chip stayed on screen every time`,
    )
    record(
      `PACKAGE_SELECTION_PRESERVED_${label}`,
      steps.every((x) => x.chipPressed) &&
        last.selections === groupCount &&
        steps.every((x) => x.packageStillOpen),
      `${last.selections}/${groupCount} groups hold a selection, package stayed open throughout`,
    )

    if (label === '390') {
      await page.evaluate(() => {
        document.querySelector('[data-package-option-group]')?.scrollIntoView({ block: 'center' })
      })
      await wait(600)
      await page.screenshot({ path: join(OUT, 'mp_package_options_390.png') })
      console.log(`SHOT ${join(OUT, 'mp_package_options_390.png')}`)
    }
    await page.close()
  }

  // ---------- review action shell ----------
  for (const [w, h, label] of [[390, 844, '390'], [430, 932, '430'], [1440, 900, 'desktop']]) {
    const page = await browser.newPage()
    const ready = await reachPackages(page, w, h)
    if (!ready) { record(`REVIEW_REACHED_${label}`, false, 'package step never rendered'); await page.close(); continue }
    await openPackage(page)
    await page.evaluate(() => {
      document.querySelectorAll('[data-public-package-options] [role="group"]')
        .forEach((g) => g.querySelector('button')?.click())
    })
    await wait(800)
    for (let i = 0; i < 5; i += 1) {
      if (await page.$('[data-testid="public-quote-submit"]')) break
      await page.evaluate(() => {
        const n = [...document.querySelectorAll('button[aria-pressed]')].find((b) =>
          /não há churrasqueira/i.test(b.textContent || ''))
        if (n && n.getAttribute('aria-pressed') !== 'true') n.click()
      })
      await wait(500)
      await page.evaluate(() => document.querySelector('[data-testid="wizard-global-next"]')?.click())
      await wait(1800)
    }
    await page.waitForSelector('[data-testid="public-quote-submit"]', { timeout: 90_000 })
    await wait(2500)

    const shell = await page.evaluate(() => {
      const bar = document.querySelector('[data-public-review-actions]')
      const consent = document.querySelector('[data-public-consent]')
      const submit = document.querySelector('[data-testid="public-quote-submit"]')
      const cs = getComputedStyle(bar)
      const r = bar.getBoundingClientRect()
      return {
        consentInsideBar: Boolean(bar && consent && bar.contains(consent)),
        consentCount: document.querySelectorAll('input[type="checkbox"]').length,
        submitCount: document.querySelectorAll('[data-testid="public-quote-submit"]').length,
        position: cs.position,
        bottom: cs.bottom,
        paddingBottom: cs.paddingBottom,
        barHeight: Math.round(r.height),
        share: Math.round((r.height / window.innerHeight) * 100),
        submitDisabled: submit.hasAttribute('disabled'),
        radius: cs.borderTopLeftRadius,
        borderTop: `${cs.borderTopWidth} ${cs.borderTopColor}`,
        barWidth: Math.round(r.width),
        viewportWidth: window.innerWidth,
        // The column the review content itself occupies.
        contentWidth: (() => {
          const content = bar.parentElement
          return content ? Math.round(content.getBoundingClientRect().width) : null
        })(),
      }
    })

    record(
      `CHECKBOX_AND_BUTTON_TOGETHER_${label}`,
      shell.consentInsideBar,
      `consent lives inside the action shell with the submit`,
    )
    record(
      `NO_DUPLICATE_ACTIONS_${label}`,
      shell.consentCount === 1 && shell.submitCount === 1,
      `${shell.consentCount} consent control, ${shell.submitCount} submit control`,
    )
    record(
      `REVIEW_ACTION_SHELL_STICKY_${label}`,
      shell.position === 'sticky' &&
        shell.bottom === '0px' &&
        parseFloat(shell.paddingBottom) >= 12,
      `${shell.position} bottom:${shell.bottom}, safe-area padding ${shell.paddingBottom}, ${shell.barHeight}px (${shell.share}% of viewport)`,
    )
    if (label === 'desktop') {
      record(
        'REVIEW_SHELL_NOT_FULL_BLEED_desktop',
        // It tracks the content column instead of spanning the window.
        shell.contentWidth != null &&
          Math.abs(shell.barWidth - shell.contentWidth) <= 2 &&
          shell.barWidth < shell.viewportWidth - 40,
        `bar ${shell.barWidth}px = content column ${shell.contentWidth}px, inside a ${shell.viewportWidth}px window`,
      )
    }

    // Travel together, and stay reachable, at every scroll position.
    const travel = []
    for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
      travel.push(
        await page.evaluate(async (f) => {
          const max = document.documentElement.scrollHeight - document.documentElement.clientHeight
          window.scrollTo(0, Math.round(max * f))
          await new Promise((r) => setTimeout(r, 420))
          const bar = document.querySelector('[data-public-review-actions]')
          const consent = document.querySelector('[data-public-consent] input')
          const submit = document.querySelector('[data-testid="public-quote-submit"]')
          const br = bar.getBoundingClientRect()
          const cr = consent.getBoundingClientRect()
          const sr = submit.getBoundingClientRect()
          const vh = window.innerHeight
          return {
            f,
            bothOnScreen:
              cr.top >= 0 && cr.bottom <= vh + 1 && sr.top >= 0 && sr.bottom <= vh + 1,
            sameShell: br.top <= cr.top + 1 && br.bottom >= sr.bottom - 1,
          }
        }, frac),
      )
    }
    record(
      `REVIEW_ACCEPT_AND_NEXT_MOVE_TOGETHER_${label}`,
      travel.every((t) => t.bothOnScreen && t.sameShell),
      `both on screen and in one shell at ${travel.filter((t) => t.bothOnScreen).length}/${travel.length} scroll positions`,
    )

    // Nothing is permanently hidden behind the shell.
    const covered = await page.evaluate(async () => {
      window.scrollTo(0, document.documentElement.scrollHeight)
      await new Promise((r) => setTimeout(r, 600))
      const bar = document.querySelector('[data-public-review-actions]')
      const br = bar.getBoundingClientRect()
      // The last content block before the shell.
      const prev = bar.previousElementSibling
      const pr = prev?.getBoundingClientRect()
      return {
        lastBlockBottom: pr ? Math.round(pr.bottom) : null,
        barTop: Math.round(br.top),
        overlap: pr ? Math.round(Math.max(0, pr.bottom - br.top)) : 0,
        atDocumentEnd:
          Math.round(window.scrollY) >=
          Math.round(document.documentElement.scrollHeight - document.documentElement.clientHeight) - 2,
      }
    })
    record(
      `REVIEW_LAST_CONTENT_NOT_COVERED_${label}`,
      covered.overlap === 0 && covered.atDocumentEnd,
      `at the document end the shell sits below the last block (overlap ${covered.overlap}px)`,
    )

    // Validation is still the gate.
    const validation = await page.evaluate(async () => {
      const submit = document.querySelector('[data-testid="public-quote-submit"]')
      const box = document.querySelector('[data-public-consent] input')
      const before = submit.hasAttribute('disabled')
      submit.removeAttribute('disabled')
      submit.click()
      await new Promise((r) => setTimeout(r, 1200))
      const bypassed = Boolean(document.querySelector('[data-public-success]'))
      box.click()
      await new Promise((r) => setTimeout(r, 1000))
      const after = document
        .querySelector('[data-testid="public-quote-submit"]')
        .hasAttribute('disabled')
      return { before, bypassed, after }
    })
    record(
      `REVIEW_VALIDATION_UNCHANGED_${label}`,
      validation.before === true && validation.bypassed === false && validation.after === false,
      `disabled without consent, DOM tampering did not submit, enabled once accepted`,
    )

    if (label === '390') {
      await page.evaluate(async () => {
        const max = document.documentElement.scrollHeight - document.documentElement.clientHeight
        window.scrollTo(0, Math.round(max * 0.35))
        await new Promise((r) => setTimeout(r, 500))
      })
      await page.screenshot({ path: join(OUT, 'mp_review_action_shell_390.png') })
      console.log(`SHOT ${join(OUT, 'mp_review_action_shell_390.png')}`)
    }
    await page.close()
  }
} finally {
  await browser.close()
}

writeFileSync(join(OUT, 'micro-polish-gates.json'), JSON.stringify(results, null, 2))
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} gates passed`)
if (failed.length) {
  console.error(`FAILED: ${failed.map((r) => r.name).join(', ')}`)
  process.exit(1)
}

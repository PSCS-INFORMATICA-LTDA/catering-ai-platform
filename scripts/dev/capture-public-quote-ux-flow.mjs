/**
 * UX flow polish gates for the public quote.
 *
 * Landing continuity cues, date/time popovers that land inside the viewport,
 * the end-time picker staying shut, the event-address divider, the de-duplicated
 * deposit copy, the mileage destination, and the sticky review action shell.
 *
 *   node scripts/dev/capture-public-quote-ux-flow.mjs \
 *     --url http://127.0.0.1:3060 --out /opt/cursor/artifacts
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
const CDL_YELLOW = 'rgb(246, 208, 0)'

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
    `--user-data-dir=/tmp/chrome-uxflow-${Date.now()}`,
  ],
})

const shot = async (page, name, clip) => {
  const dest = join(OUT, `${name}.png`)
  await page.screenshot({ path: dest, clip, fullPage: false })
  console.log(`SHOT  ${dest}`)
}

const EVENT_ADDRESS = {
  route: 'South Orange Avenue',
  number: '400',
  city: 'Orlando',
  region: 'FL',
  postalCode: '32801',
  country: 'US',
  formattedAddress: '400 South Orange Avenue, Orlando, FL 32801, US',
  source: 'manual',
}

async function openLanding(page, width, height, locale = 'pt') {
  await page.setViewport({ width, height, deviceScaleFactor: 2 })
  await page.goto(`${BASE}/quote/cdl/${locale}`, {
    waitUntil: 'networkidle2',
    timeout: 60_000,
  })
  await page.waitForSelector('[data-public-landing]', { timeout: 30_000 })
}

/** Seeds the intake session so the wizard opens directly on `step`. */
async function jumpToStep(page, locale, step) {
  const patched = await page.evaluate(
    async (draftLocale, currentStep, address) => {
      const tail = String(Math.floor(Math.random() * 9000) + 1000)
      // The landing only opens a session once the customer starts, so create one.
      await fetch('/api/public/quote-intake/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companySlug: 'cdl',
          locale: draftLocale,
          website: '',
        }),
      })
      const response = await fetch('/api/public/quote-intake/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          website: '',
          currentStep,
          draft: {
            locale: draftLocale,
            contact: {
              firstName: 'Philippe',
              lastName: 'Flow',
              phone: `+1407555${tail}`,
            },
            event: {
              eventName: 'Philippe Flow',
              eventDate: '2026-10-24',
              startTime: '18:00',
              endTime: '22:00',
              adultCount: 25,
              address,
            },
          },
        }),
      })
      return { ok: response.ok, status: response.status }
    },
    locale,
    step,
    EVENT_ADDRESS,
  )
  if (!patched.ok) throw new Error(`session patch ${patched.status}`)
  // Auto-resume is gated on this flag, otherwise the landing renders instead.
  await page.evaluate(() => sessionStorage.setItem('public-quote-active:cdl', '1'))
  await page.reload({ waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-public-wizard-theme="light-locked"]', {
    timeout: 45_000,
  })
}

/** Usable strip once the sticky header and the sticky action bar are removed. */
const usableViewport = (page) =>
  page.evaluate(() => {
    const height = (selector) => {
      const el = document.querySelector(selector)
      if (!(el instanceof HTMLElement)) return 0
      if (getComputedStyle(el).position === 'static') return 0
      return el.getBoundingClientRect().height
    }
    return {
      top: height('.public-quote-header'),
      bottom: height('[data-wizard-step-nav]'),
      viewport: window.visualViewport?.height ?? window.innerHeight,
    }
  })

try {
  // ---------------- Landing continuity cues ----------------
  const landing = await browser.newPage()
  await openLanding(landing, 390, 844)

  const cues = await landing.evaluate(() => {
    const chapters = [...document.querySelectorAll('[data-landing-chapter]')]
    return {
      chapters: chapters.map((el) => el.getAttribute('data-landing-chapter')),
      cueByChapter: chapters.map((el) => {
        const cue = el.querySelector('[data-landing-chapter-cue]')
        return cue ? cue.getAttribute('data-landing-chapter-cue') : null
      }),
      leadLabel:
        document
          .querySelector('[data-landing-chapter-cue="lead"] .public-landing-cue-label')
          ?.textContent?.trim() ?? '',
      leadColor: (() => {
        const el = document.querySelector('[data-landing-chapter-cue="lead"]')
        return el ? getComputedStyle(el).color : ''
      })(),
      arrowColor: (() => {
        const el = document.querySelector('[data-landing-chapter-cue="arrow"]')
        return el ? getComputedStyle(el).color : ''
      })(),
      dotColor: (() => {
        const el = document.querySelector('.public-landing-cue-dot')
        return el ? getComputedStyle(el).backgroundColor : ''
      })(),
      // A cue must never sit on top of the chapter copy.
      overlaps: chapters.some((el) => {
        const cue = el.querySelector('[data-landing-chapter-cue]')
        const copy = el.querySelector('.public-cinematic-copy')
        if (!cue || !copy) return false
        const a = cue.getBoundingClientRect()
        const b = copy.getBoundingClientRect()
        return a.top < b.bottom - 1 && a.bottom > b.top + 1
      }),
      // Only the interactive cues need a touch target; the end dot is a span.
      tapSizes: [...document.querySelectorAll('button[data-landing-chapter-cue]')].map(
        (el) => {
          const r = el.getBoundingClientRect()
          return Math.round(Math.min(r.width, r.height))
        },
      ),
    }
  })

  const lastIndex = cues.chapters.length - 1
  record(
    'FIRST_SECTION_SCROLL_HINT',
    cues.cueByChapter[0] === 'lead' && cues.leadLabel === 'Conheça nosso churrasco',
    `first chapter "${cues.chapters[0]}" carries "${cues.leadLabel}"`,
  )
  record(
    'SECTION_DOWN_ARROWS',
    cues.cueByChapter
      .slice(1, lastIndex)
      .every((variant) => variant === 'arrow') && lastIndex >= 2,
    `${lastIndex - 1} middle chapters, all with an arrow`,
  )
  record(
    'LAST_SECTION_DOT',
    cues.cueByChapter[lastIndex] === 'end' &&
      !cues.cueByChapter.slice(0, lastIndex).includes('end'),
    `last chapter "${cues.chapters[lastIndex]}" closes with a dot, no arrow`,
  )
  record(
    'ARROW_USES_EXISTING_CDL_YELLOW',
    cues.leadColor === CDL_YELLOW &&
      cues.arrowColor === CDL_YELLOW &&
      cues.dotColor === CDL_YELLOW,
    `lead/arrow/dot all ${CDL_YELLOW}`,
  )
  record(
    'CUES_DO_NOT_COVER_CONTENT',
    !cues.overlaps && cues.tapSizes.every((size) => size >= 44),
    `no overlap with chapter copy, smallest touch target ${Math.min(...cues.tapSizes)}px`,
  )

  // Clicking the lead cue must move the page down to the next chapter.
  const scrolled = await landing.evaluate(async () => {
    window.scrollTo(0, 0)
    await new Promise((r) => setTimeout(r, 150))
    const before = window.scrollY
    document.querySelector('[data-landing-chapter-cue="lead"]')?.click()
    await new Promise((r) => setTimeout(r, 1400))
    const chapters = [...document.querySelectorAll('[data-landing-chapter]')]
    const second = chapters[1].getBoundingClientRect()
    const header =
      document.querySelector('.public-quote-header')?.getBoundingClientRect()
        .height ?? 0
    return { before, after: window.scrollY, secondTop: second.top, header }
  })
  record(
    'LANDING_CUE_SCROLLS_TO_NEXT',
    scrolled.after > scrolled.before + 40 &&
      scrolled.secondTop >= scrolled.header - 4,
    `scrollY ${Math.round(scrolled.before)} -> ${Math.round(scrolled.after)}, next chapter clears the header`,
  )

  await landing.evaluate(() => window.scrollTo(0, 0))
  await new Promise((r) => setTimeout(r, 400))
  await shot(landing, 'ux_landing_first_cue_390')
  await landing.close()

  // PT / EN / ES copy
  for (const [locale, expected] of [
    ['pt', 'Conheça nosso churrasco'],
    ['en', 'Discover our BBQ experience'],
    ['es', 'Conoce nuestra experiencia BBQ'],
  ]) {
    const page = await browser.newPage()
    await openLanding(page, 390, 844, locale)
    const label = await page.evaluate(
      () =>
        document
          .querySelector('[data-landing-chapter-cue="lead"] .public-landing-cue-label')
          ?.textContent?.trim() ?? '',
    )
    record(`${locale.toUpperCase()}_SCROLL_HINT_COPY`, label === expected, `"${label}"`)
    await page.close()
  }

  // ---------------- Event step: pickers, end time, address label ----------
  const event = await browser.newPage()
  await openLanding(event, 390, 844)
  await jumpToStep(event, 'pt', 1)
  await event.waitForSelector('[data-event-address-section]', { timeout: 30_000 })

  const addressLabel = await event.evaluate(() => {
    const label = document.querySelector('[data-event-address-section]')
    const before = label.previousElementSibling
    const after = label.nextElementSibling
    const style = getComputedStyle(label)
    return {
      text: label.textContent.trim(),
      // Sits between the guest counts and the address grid.
      guestsBefore: (before?.querySelectorAll('input') ?? []).length === 3,
      addressAfter: (after?.querySelectorAll('input') ?? []).length >= 3,
      color: style.color,
      fontSize: style.fontSize,
      transform: style.textTransform,
      hasCard:
        style.borderTopWidth !== '0px' ||
        style.backgroundColor !== 'rgba(0, 0, 0, 0)',
    }
  })
  record(
    'EVENT_ADDRESS_SECTION_LABEL',
    addressLabel.text === 'ENDEREÇO DO EVENTO' ||
      addressLabel.text === 'Endereço do evento',
    `"${addressLabel.text}"`,
  )
  record(
    'EVENT_ADDRESS_SECTION_DISCREET',
    addressLabel.guestsBefore &&
      addressLabel.addressAfter &&
      !addressLabel.hasCard &&
      parseFloat(addressLabel.fontSize) <= 13,
    `between guests and address, ${addressLabel.fontSize}, no card, ${addressLabel.color}`,
  )

  /** Real outside click: the pickers close on mousedown, not on click. */
  const dismissPanels = async () => {
    await event.evaluate(() =>
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })),
    )
    await new Promise((r) => setTimeout(r, 250))
  }
  const tapTrigger = async (index) => {
    await dismissPanels()
    await event.evaluate((i) => {
      const buttons = [...document.querySelectorAll('button[aria-haspopup="dialog"]')]
      buttons[i]?.click()
    }, index)
    await new Promise((r) => setTimeout(r, 500))
  }
  /** Is the picker at `index` showing its own panel? Scoped to its own field. */
  const panelOpenAt = (index) =>
    event.evaluate((i) => {
      const buttons = [...document.querySelectorAll('button[aria-haspopup="dialog"]')]
      const field = buttons[i]?.closest('.relative')?.parentElement
      return Boolean(
        field?.querySelector(
          '[data-wizard-timepicker-panel], [data-wizard-datepicker-panel]',
        ),
      )
    }, index)

  const END = 2
  const onEntry = await panelOpenAt(END)

  // Change the date.
  await tapTrigger(0)
  await event.evaluate(() => {
    const day = [...document.querySelectorAll('[data-wizard-datepicker-panel] button')]
      .reverse()
      .find((b) => /^\d{1,2}$/.test(b.textContent.trim()))
    day?.click()
  })
  await new Promise((r) => setTimeout(r, 500))
  const afterDate = await panelOpenAt(END)

  // Change the start time: pick an hour, then a minute from the minutes row.
  await tapTrigger(1)
  const startOpen = await panelOpenAt(1)
  await event.evaluate(() => {
    const panel = document.querySelector('[data-wizard-timepicker-panel]')
    // Minutes are the last button group in the panel.
    const groups = [...(panel?.querySelectorAll('div') ?? [])].filter(
      (d) => d.querySelectorAll('button').length >= 4,
    )
    const minutes = groups[groups.length - 1]
    minutes?.querySelector('button')?.click()
  })
  await new Promise((r) => setTimeout(r, 600))
  const afterStart = await panelOpenAt(END)

  const endState = await event.evaluate(() => {
    const triggers = [...document.querySelectorAll('button[aria-haspopup="dialog"]')]
    const end = triggers[2]
    return {
      expanded: end?.getAttribute('aria-expanded'),
      readonly: end?.getAttribute('aria-readonly'),
      disabled: end?.disabled ?? null,
    }
  })
  record(
    'END_TIME_DEFAULT_CLOSED',
    onEntry === false && afterDate === false && afterStart === false,
    `end-time panel open — on entry ${onEntry}, after date change ${afterDate}, after start change ${afterStart}`,
  )
  record(
    'END_TIME_NOT_AUTO_OPENED',
    endState.expanded !== 'true',
    `end trigger aria-expanded=${endState.expanded}, readonly=${endState.readonly}`,
  )
  record('START_TIME_PICKER_OPENS_ON_TAP', startOpen === true, `panel open ${startOpen}`)
  await dismissPanels()

  // Date picker must land fully inside the viewport even from the page bottom.
  const probePicker = async (triggerIndex, panelSelector) => {
    await dismissPanels()
    await event.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    )
    await new Promise((r) => setTimeout(r, 500))
    const scrollBefore = await event.evaluate(() => window.scrollY)
    await event.evaluate((index) => {
      const buttons = [...document.querySelectorAll('button[aria-haspopup="dialog"]')]
      buttons[index]?.click()
    }, triggerIndex)
    // Give the smooth scroll time to settle.
    await new Promise((r) => setTimeout(r, 1600))
    const scrollAfter = await event.evaluate(() => window.scrollY)
    const info = await event.evaluate((selector) => {
      const panel = document.querySelector(selector)
      if (!panel) return null
      const rect = panel.getBoundingClientRect()
      const height = (sel) => {
        const el = document.querySelector(sel)
        if (!(el instanceof HTMLElement)) return 0
        if (getComputedStyle(el).position === 'static') return 0
        return el.getBoundingClientRect().height
      }
      return {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height),
        headerH: Math.round(height('.public-quote-header')),
        navH: Math.round(height('[data-wizard-step-nav]')),
        viewport: Math.round(window.visualViewport?.height ?? window.innerHeight),
      }
    }, panelSelector)
    await dismissPanels()
    return info ? { ...info, shifted: Math.round(scrollAfter - scrollBefore) } : null
  }

  const datePanel = await probePicker(0, '[data-wizard-datepicker-panel]')
  record(
    'DATE_PICKER_AUTO_SCROLL',
    datePanel &&
      datePanel.top >= datePanel.headerH - 2 &&
      datePanel.bottom <= datePanel.viewport - datePanel.navH + 2,
    datePanel
      ? `panel ${datePanel.top}..${datePanel.bottom} inside ${datePanel.headerH}..${datePanel.viewport - datePanel.navH}, auto-scrolled ${datePanel.shifted}px`
      : 'panel missing',
  )

  const timePanel = await probePicker(1, '[data-wizard-timepicker-panel]')
  record(
    'TIME_PICKER_AUTO_SCROLL',
    timePanel &&
      timePanel.top >= timePanel.headerH - 2 &&
      timePanel.bottom <= timePanel.viewport - timePanel.navH + 2,
    timePanel
      ? `panel ${timePanel.top}..${timePanel.bottom} inside ${timePanel.headerH}..${timePanel.viewport - timePanel.navH}, auto-scrolled ${timePanel.shifted}px`
      : 'panel missing',
  )

  // Screenshot with the calendar open, from the bottom of the page.
  await event.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await new Promise((r) => setTimeout(r, 300))
  await event.evaluate(() => {
    const buttons = [...document.querySelectorAll('button[aria-haspopup="dialog"]')]
    buttons[0]?.click()
  })
  await new Promise((r) => setTimeout(r, 1500))
  await shot(event, 'ux_date_picker_open_390')
  await event.evaluate(() => document.body.click())
  await new Promise((r) => setTimeout(r, 300))
  await event.evaluate(() => {
    document
      .querySelector('[data-event-address-section]')
      ?.scrollIntoView({ block: 'center' })
  })
  await new Promise((r) => setTimeout(r, 400))
  await shot(event, 'ux_event_address_label_390')
  await event.close()

  // ---------------- Review step: deposit copy, mileage, sticky CTA --------
  const review = await browser.newPage()
  await openLanding(review, 390, 844)
  await jumpToStep(review, 'pt', 2)

  // Pick the first package and satisfy its required option groups.
  await review.waitForSelector('[data-package-experience-intro]', { timeout: 45_000 })
  const group = await review.$('[data-package-group="with_sides"]')
  if (group) {
    const open = await review.$eval(
      '[data-package-group="with_sides"]',
      (node) => node.getAttribute('data-package-group-open') === 'true',
    )
    if (!open) await group.click()
  }
  await review.waitForSelector('[data-package-sides-group="with_sides"]', {
    timeout: 20_000,
  })
  await review.click('[data-package-sides-group="with_sides"]')
  await review.waitForFunction(
    () => document.querySelector('[data-package-selected="true"]'),
    { timeout: 15_000 },
  )
  await review.evaluate(() => {
    document
      .querySelectorAll('[data-public-package-options] [role="group"]')
      .forEach((g) => g.querySelector('button')?.click())
  })
  await new Promise((r) => setTimeout(r, 600))

  // Walk the remaining steps with the global Next control.
  const advance = async () => {
    await review.evaluate(() => {
      const next = document.querySelector('[data-testid="wizard-global-next"]')
      next?.scrollIntoView({ block: 'center' })
    })
    await new Promise((r) => setTimeout(r, 250))
    await review.evaluate(() => {
      document.querySelector('[data-testid="wizard-global-next"]')?.click()
    })
    await new Promise((r) => setTimeout(r, 1400))
  }
  for (let i = 0; i < 4; i += 1) {
    const done = await review.$('[data-testid="public-quote-submit"]')
    if (done) break
    // The grill step stays blocked until the setup question is answered.
    await review.evaluate(() => {
      const noGrill = [...document.querySelectorAll('button[aria-pressed]')].find(
        (b) => /não há churrasqueira|no grill on site|no hay parrilla/i.test(
          b.textContent || '',
        ),
      )
      if (noGrill instanceof HTMLElement && noGrill.getAttribute('aria-pressed') !== 'true') {
        noGrill.click()
      }
    })
    await new Promise((r) => setTimeout(r, 600))
    await advance()
  }
  await review.waitForSelector('[data-testid="public-quote-submit"]', {
    timeout: 45_000,
  })

  const reviewDom = await review.evaluate(() => {
    const bar = document.querySelector('[data-public-review-actions]')
    const submit = document.querySelector('[data-testid="public-quote-submit"]')
    const barStyle = bar ? getComputedStyle(bar) : null
    const destination = document.querySelector('[data-mileage-destination]')
    const text = document.body.innerText
    return {
      splitLines: document.querySelectorAll('.quote-proposal-reservation-split').length,
      pctMarks: document.querySelectorAll('.quote-proposal-pct-mark').length,
      depositCells: document.querySelectorAll(
        '.quote-proposal-reservation-amounts .quote-proposal-info-cell',
      ).length,
      reservationCard: Boolean(
        document.querySelector('.quote-proposal-reservation-card'),
      ),
      destinationText: destination?.textContent?.trim() ?? '',
      destinationSource: destination?.getAttribute('data-mileage-destination-source'),
      barPosition: barStyle?.position ?? '',
      barBottom: barStyle?.bottom ?? '',
      barPaddingBottom: barStyle?.paddingBottom ?? '',
      submitCount: document.querySelectorAll('[data-testid="public-quote-submit"]')
        .length,
      submitDisabled: submit?.hasAttribute('disabled') ?? null,
      blockedReason:
        document.querySelector('[data-submit-blocked-reason]')?.textContent?.trim() ??
        '',
      hasDepositAmounts: /\$\s?\d/.test(text),
    }
  })

  record(
    'DUPLICATE_DEPOSIT_COPY_REMOVED',
    reviewDom.splitLines === 0 &&
      reviewDom.pctMarks === 0 &&
      reviewDom.reservationCard &&
      reviewDom.depositCells === 2,
    `no red split line, reservation card kept with ${reviewDom.depositCells} amount cells`,
  )

  // The mileage grid only renders when pricing actually returns a mileage line,
  // which needs a resolved distance. Report honestly when it is not priced here.
  if (reviewDom.destinationSource) {
    const street = EVENT_ADDRESS.route.toLowerCase()
    record(
      'MILEAGE_DESTINATION_EQUALS_EVENT_ADDRESS',
      reviewDom.destinationText.toLowerCase().includes(street) &&
        reviewDom.destinationText.includes(EVENT_ADDRESS.number) &&
        reviewDom.destinationText.includes(EVENT_ADDRESS.city) &&
        reviewDom.destinationText.includes(EVENT_ADDRESS.postalCode) &&
        reviewDom.destinationSource === 'event-address',
      `"${reviewDom.destinationText}"`,
    )
  } else {
    record(
      'MILEAGE_DESTINATION_NOT_PRICED_HERE',
      reviewDom.destinationText === '',
      'no mileage line in this environment (distance unresolved) — display proven by the unit gate',
    )
  }

  record(
    'REVIEW_CTA_STICKY',
    reviewDom.barPosition === 'sticky' &&
      reviewDom.barBottom === '0px' &&
      parseFloat(reviewDom.barPaddingBottom) >= 12 &&
      reviewDom.submitCount === 1,
    `${reviewDom.barPosition} bottom:${reviewDom.barBottom}, safe-area padding ${reviewDom.barPaddingBottom}, ${reviewDom.submitCount} submit control`,
  )

  // Reachable from the middle of the review, not only at the very end.
  const stickyVisible = await review.evaluate(async () => {
    window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.35))
    await new Promise((r) => setTimeout(r, 400))
    const bar = document.querySelector('[data-public-review-actions]')
    const rect = bar.getBoundingClientRect()
    const viewport = window.innerHeight
    return {
      visible: rect.bottom <= viewport + 1 && rect.top < viewport,
      scrollY: Math.round(window.scrollY),
      max: Math.round(
        document.documentElement.scrollHeight - document.documentElement.clientHeight,
      ),
    }
  })
  record(
    'REVIEW_CTA_REACHABLE_MID_SCROLL',
    stickyVisible.visible,
    `visible at scrollY ${stickyVisible.scrollY} of ${stickyVisible.max}`,
  )

  record(
    'REVIEW_CTA_STILL_VALIDATED',
    reviewDom.submitDisabled === true && reviewDom.blockedReason.length > 0,
    `consent not accepted -> disabled, reason "${reviewDom.blockedReason}"`,
  )

  // Accepting consent must still be what unlocks it.
  const afterConsent = await review.evaluate(async () => {
    const box = document.querySelector('input[type="checkbox"]')
    if (box instanceof HTMLInputElement) box.click()
    await new Promise((r) => setTimeout(r, 900))
    const submit = document.querySelector('[data-testid="public-quote-submit"]')
    return { disabled: submit?.hasAttribute('disabled') ?? null }
  })
  record(
    'REVIEW_CTA_VALIDATION_UNCHANGED',
    reviewDom.submitDisabled === true && afterConsent.disabled === false,
    `disabled before consent, enabled after — gate still owned by canSubmit`,
  )

  await review.evaluate(() =>
    window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.45)),
  )
  await new Promise((r) => setTimeout(r, 500))
  await shot(review, 'ux_review_sticky_cta_390')
  await review.evaluate(() => {
    document
      .querySelector('[data-mileage-destination]')
      ?.scrollIntoView({ block: 'center' })
  })
  await new Promise((r) => setTimeout(r, 500))
  await shot(review, 'ux_review_mileage_390')
  await review.close()

  writeFileSync(join(OUT, 'ux-flow-gates.json'), JSON.stringify(results, null, 2))
} catch (error) {
  record('SUITE_COMPLETED', false, String(error?.message || error))
} finally {
  await browser.close()
}

writeFileSync(join(OUT, 'ux-flow-gates.json'), JSON.stringify(results, null, 2))
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} gates passed`)
if (failed.length) {
  console.error(`FAILED: ${failed.map((r) => r.name).join(', ')}`)
  process.exit(1)
}

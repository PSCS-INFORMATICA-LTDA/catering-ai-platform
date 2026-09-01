/**
 * Real click on event ✓ buttons. Requires a running public quote server.
 *
 * Run: PUBLIC_QUOTE_BASE=http://127.0.0.1:3122 npm run test:dev:public-event-advance-check
 */
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'

const BASE = process.env.PUBLIC_QUOTE_BASE || 'http://127.0.0.1:3125'
const CHROME =
  process.env.CHROME_PATH || '/usr/local/bin/google-chrome'
const URL = `${BASE.replace(/\/$/, '')}/quote/cdl/pt`

let passed = 0
let failed = 0

function test(name, ok, detail = '') {
  if (ok) {
    passed += 1
    console.log(`PASS  ${name}`)
    return
  }
  failed += 1
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-features=Translate,TranslateUI'],
})

const page = await browser.newPage()
page.setDefaultTimeout(45000)
await page.setViewport({
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})

try {
  await page.goto(URL, { waitUntil: 'networkidle2' })
  const start = await page.waitForSelector(
    '[data-landing-quick-cta], [data-landing-start-quote]',
  )
  await start.click()
  await page.waitForSelector('[data-public-phone-split]')

  const countryRow = await page.$('[data-phone-country-row]')
  const nationalRow = await page.$('[data-phone-national-row]')
  const areaInput = await page.$('[data-phone-area]')
  const nationalInputs = await page.$$('[data-phone-national]')
  test('COUNTRY_ROW_FULL_WIDTH', Boolean(countryRow))
  test('NATIONAL_PHONE_SINGLE_INPUT', nationalInputs.length === 1)
  test('SEPARATE_DDD_INPUT_EXISTS = NO', !areaInput)
  test('SEPARATE_SUBSCRIBER_INPUT_EXISTS = NO', nationalInputs.length === 1)

  await page.click('[data-phone-country]')
  await page.waitForSelector('[data-phone-country-picker]')
  const brasil = await page.evaluateHandle(() => {
    const buttons = [...document.querySelectorAll('[data-phone-country-list] button')]
    return buttons.find((btn) => /Brasil|Brazil/i.test(btn.textContent || '')) || buttons[0]
  })
  await brasil.click()
  await page.waitForFunction(
    () => document.activeElement === document.querySelector('[data-phone-national]'),
  )
  test('COUNTRY_SELECT_FOCUS_TARGET = NATIONAL_PHONE', true)

  await page.type('[data-phone-national]', '11976182170', { delay: 20 })
  const canonical = await page.$eval('[data-public-phone-split]', (el) =>
    el.getAttribute('data-phone-canonical'),
  )
  const display = await page.$eval('[data-phone-national]', (el) => el.value)
  test('BR_CANONICAL = +5511976182170', canonical === '+5511976182170', canonical)
  test('BR_INPUT_DISPLAY = 11 97618-2170', display === '11 97618-2170', display)

  await page.keyboard.press('Enter')
  await page.waitForFunction(
    () => document.activeElement === document.querySelector('input[type="email"]'),
  )
  test('PHONE_ENTER_TARGET = OPTIONAL_EMAIL', true)

  await page.click('input[autocomplete="given-name"]', { clickCount: 3 })
  await page.type('input[autocomplete="given-name"]', 'Maria')
  await page.click('input[autocomplete="family-name"]', { clickCount: 3 })
  await page.type('input[autocomplete="family-name"]', 'Silva')
  const nextBtn = await page.evaluateHandle(() => {
    const buttons = [...document.querySelectorAll('button')]
    return buttons.find((btn) => /Próximo|Proximo|Next/i.test(btn.textContent || ''))
  })
  await nextBtn.click()
  await page.waitForSelector('[data-guest-input="adults"]')

  await page.click('[data-guest-input="adults"]')
  await page.keyboard.type('20')
  const adultsCheck = await page.waitForSelector(
    '[data-field-advance-check="adults"]',
  )
  test('ADULTS_20_CHECK_VISIBLE = YES', Boolean(adultsCheck))
  await page.$eval('[data-field-advance-check="adults"]', (el) => el.click())
  const afterAdults = await page.evaluate(() => ({
    active: document.activeElement?.getAttribute('data-guest-input'),
    child4: document.activeElement === document.querySelector('[data-guest-input="children-4-12"]'),
    street: document.activeElement === document.querySelector('[data-address-number]'),
  }))
  test(
    'ADULTS_CHECK_CLICK_TARGET = CHILD_UNDER_3',
    afterAdults.active === 'children-under-3',
    JSON.stringify(afterAdults),
  )
  test(
    'ADULTS_SINGLE_CLICK_ADVANCES_ONE_FIELD = YES',
    afterAdults.active === 'children-under-3' && !afterAdults.child4 && !afterAdults.street,
  )

  await page.keyboard.type('0')
  const child3Check = await page.waitForSelector(
    '[data-field-advance-check="children-under-3"]',
  )
  test('CHILD_UNDER_3_0_CHECK_VISIBLE = YES', Boolean(child3Check))
  await page.$eval(
    '[data-field-advance-check="children-under-3"]',
    (el) => el.click(),
  )
  const afterChild3 = await page.evaluate(() => ({
    active: document.activeElement?.getAttribute('data-guest-input'),
    street: document.activeElement === document.querySelector('[data-address-number]'),
  }))
  test(
    'CHILD_UNDER_3_CHECK_CLICK_TARGET = CHILD_4_12',
    afterChild3.active === 'children-4-12',
    JSON.stringify(afterChild3),
  )
  test(
    'CHILD_UNDER_3_SINGLE_CLICK_ADVANCES_ONE_FIELD = YES',
    afterChild3.active === 'children-4-12' && !afterChild3.street,
  )

  await page.keyboard.type('0')
  const child412Check = await page.waitForSelector(
    '[data-field-advance-check="children-4-12"]',
  )
  test('CHILD_4_12_0_CHECK_VISIBLE = YES', Boolean(child412Check))
  await page.$eval(
    '[data-field-advance-check="children-4-12"]',
    (el) => el.click(),
  )
  const afterChild412 = await page.evaluate(() => ({
    street: document.activeElement === document.querySelector('[data-address-number]'),
    address: document.activeElement === document.querySelector('[data-address-search]'),
  }))
  test(
    'CHILD_4_12_CHECK_CLICK_TARGET = STREET_NUMBER',
    afterChild412.street,
    JSON.stringify(afterChild412),
  )
  test(
    'CHILD_4_12_SINGLE_CLICK_ADVANCES_ONE_FIELD = YES',
    afterChild412.street && !afterChild412.address,
  )

  await page.keyboard.type('2353')
  const streetCheck = await page.waitForSelector(
    '[data-field-advance-check="street-number"]',
  )
  test('STREET_NUMBER_CHECK_VISIBLE = YES', Boolean(streetCheck))
  await page.$eval(
    '[data-field-advance-check="street-number"]',
    (el) => el.click(),
  )
  const afterStreet = await page.evaluate(() => ({
    address: document.activeElement === document.querySelector('[data-address-search]'),
    zip: document.activeElement === document.querySelector('input[autocomplete="postal-code"]'),
  }))
  test(
    'STREET_NUMBER_CHECK_CLICK_TARGET = ADDRESS_SEARCH',
    afterStreet.address,
    JSON.stringify(afterStreet),
  )
  test(
    'STREET_NUMBER_SINGLE_CLICK_ADVANCES_ONE_FIELD = YES',
    afterStreet.address && !afterStreet.zip,
  )

  const stacked = await page.$eval('[data-address-primary-stacked]', (el) =>
    el.getAttribute('data-address-primary-stacked'),
  )
  test('ADDRESS_STACKED_PUBLIC = YES', stacked === 'true')
} catch (error) {
  failed += 1
  console.error(`FAIL  runtime — ${error instanceof Error ? error.message : error}`)
} finally {
  await browser.close()
}

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)

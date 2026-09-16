import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPaymentShareMessage, buildPaymentWhatsAppHref } from './paymentShareMessage.ts'
import {
  WHATSAPP_BUSINESS_FALLBACK_MS,
  buildPaymentWhatsAppBusinessAndroidIntent,
  buildPaymentWhatsAppBusinessHref,
  isLikelyAndroidWhatsAppHost,
  isLikelyMobileWhatsAppHost,
  openPaymentWhatsAppShare,
  resolvePaymentWhatsAppOpenPlan,
} from './whatsappBusinessOpen.ts'

const company = 'CDL Services BBQ At Home DEV'
const longUrl =
  'https://catering-ai-agenda-dev.vercel.app/pay/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function shareText(locale, extra = {}) {
  return buildPaymentShareMessage({
    locale,
    companyDisplayName: company,
    customerFirstName: extra.customerFirstName || 'João',
    quoteNumber: extra.quoteNumber || 'Q-2026-000187',
    purpose: extra.purpose || 'deposit',
    amount: extra.amount || 846,
    currency: 'USD',
    paymentUrl: extra.paymentUrl || longUrl,
  }).text
}

test('mobile +1 prefers Business scheme and keeps wa.me fallback', () => {
  const text = shareText('pt')
  const plan = resolvePaymentWhatsAppOpenPlan({
    phone: '+1 (407) 555-1234',
    text,
    isMobile: true,
  })
  assert.equal(plan.ok, true)
  assert.equal(plan.mode, 'business')
  assert.equal(plan.phoneDigits, '14075551234')
  assert.equal(
    plan.businessHref,
    `whatsapp-business://send?phone=14075551234&text=${encodeURIComponent(text)}`,
  )
  assert.equal(plan.fallbackHref, buildPaymentWhatsAppHref('+1 (407) 555-1234', text))
  assert.ok(plan.fallbackHref?.startsWith('https://wa.me/14075551234?text='))
})

test('mobile +55 uses E.164 digits and encodes PT/EN/ES text', () => {
  for (const locale of ['pt', 'en', 'es']) {
    const text = shareText(locale, { customerFirstName: 'João' })
    const plan = resolvePaymentWhatsAppOpenPlan({
      phone: '+55 (11) 98348-1803',
      text,
      isMobile: true,
    })
    assert.equal(plan.phoneDigits, '5511983481803')
    assert.match(plan.businessHref || '', /whatsapp-business:\/\/send\?phone=5511983481803/)
    assert.equal(
      decodeURIComponent((plan.businessHref || '').split('text=')[1] || ''),
      text,
    )
    assert.equal(
      decodeURIComponent((plan.fallbackHref || '').split('text=')[1] || ''),
      text,
    )
    assert.match(text, /João|Hi, João|¡Hola, João/)
  }
})

test('desktop stays on wa.me and does not use the Business scheme', () => {
  const text = shareText('en', { purpose: 'full', paymentUrl: longUrl })
  const plan = resolvePaymentWhatsAppOpenPlan({
    phone: '+14075551234',
    text,
    isMobile: false,
  })
  assert.equal(plan.mode, 'web')
  assert.equal(plan.businessHref, null)
  assert.equal(plan.androidIntentHref, null)
  assert.ok(plan.fallbackHref?.startsWith('https://wa.me/14075551234?text='))
  assert.match(plan.fallbackHref || '', /pay%2Fabcdefghijklmnopqrstuvwxyz/)
})

test('invalid or missing phone has no href and no auto-send path', () => {
  const text = shareText('pt')
  for (const phone of [null, '', '123', '4075551234']) {
    const plan = resolvePaymentWhatsAppOpenPlan({ phone, text, isMobile: true })
    assert.equal(plan.ok, false)
    assert.equal(plan.mode, 'invalid-phone')
    assert.equal(plan.businessHref, null)
    assert.equal(plan.fallbackHref, null)
  }
})

test('Android intent keeps Business package and wa.me fallback URL', () => {
  const text = shareText('es')
  const href = buildPaymentWhatsAppBusinessAndroidIntent('+1-407-555-1415', text)
  assert.ok(href?.startsWith('intent://send?phone=14075551415'))
  assert.match(href || '', /package=com\.whatsapp\.w4b/)
  assert.match(href || '', /scheme=whatsapp-business/)
  assert.match(href || '', /S\.browser_fallback_url=/)
  assert.match(decodeURIComponent(href || ''), /https:\/\/wa\.me\/14075551415/)
})

test('UA helpers distinguish mobile, Android, and desktop', () => {
  assert.equal(isLikelyMobileWhatsAppHost('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), true)
  assert.equal(isLikelyMobileWhatsAppHost('Mozilla/5.0 (Linux; Android 14)'), true)
  assert.equal(isLikelyAndroidWhatsAppHost('Mozilla/5.0 (Linux; Android 14)'), true)
  assert.equal(isLikelyAndroidWhatsAppHost('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), false)
  assert.equal(isLikelyMobileWhatsAppHost('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), false)
})

test('mobile opener tries Business first and falls back to wa.me if still visible', () => {
  const text = shareText('pt')
  const assigned = []
  const opened = []
  let fallback = null
  const plan = openPaymentWhatsAppShare(
    { phone: '+14075551234', text },
    {
      isMobile: true,
      isAndroid: false,
      assign: (href) => assigned.push(href),
      openBlank: (href) => {
        opened.push(href)
        return true
      },
      scheduleFallback: (fn) => {
        fallback = fn
      },
      pageStillVisible: () => true,
    },
  )
  assert.equal(plan.mode, 'business')
  assert.equal(assigned[0], buildPaymentWhatsAppBusinessHref('+14075551234', text))
  assert.equal(opened.length, 0)
  fallback?.()
  assert.equal(opened[0], buildPaymentWhatsAppHref('+14075551234', text))
  assert.equal(WHATSAPP_BUSINESS_FALLBACK_MS, 1400)
})

test('desktop opener uses wa.me immediately', () => {
  const text = shareText('en')
  const opened = []
  const plan = openPaymentWhatsAppShare(
    { phone: '+5511983481803', text },
    {
      isMobile: false,
      assign: () => {
        throw new Error('desktop must not assign custom schemes')
      },
      openBlank: (href) => {
        opened.push(href)
        return true
      },
      scheduleFallback: () => {
        throw new Error('desktop must not schedule business fallback')
      },
      pageStillVisible: () => true,
    },
  )
  assert.equal(plan.mode, 'web')
  assert.equal(opened[0], buildPaymentWhatsAppHref('+5511983481803', text))
})

test('Business href never uses the 500-char logistics truncator', () => {
  const hugeUrl = `${longUrl}${'A'.repeat(400)}`
  const text = shareText('pt', { paymentUrl: hugeUrl })
  const href = buildPaymentWhatsAppBusinessHref('+14075551234', text)
  assert.ok((href?.split('text=')[1] || '').length > 500)
  assert.equal(decodeURIComponent(href.split('text=')[1]), text)
  assert.doesNotMatch(href, /…/)
})

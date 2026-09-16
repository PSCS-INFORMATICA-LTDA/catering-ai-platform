import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { buildPaymentShareMessage, buildPaymentWhatsAppHref } from './paymentShareMessage.ts'
import {
  openPaymentWhatsAppShare,
  resolvePaymentWhatsAppOpenPlan,
} from './whatsappBusinessOpen.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const company = 'CDL Services BBQ At Home DEV'
const longUrl =
  'https://catering-ai-agenda-dev.vercel.app/pay/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const FORBIDDEN_SCHEME = 'whatsapp-business://'
const EXECUTABLE_SHARE_SURFACE = [
  'Lib/payments/whatsappBusinessOpen.ts',
  'Lib/payments/paymentShareMessage.ts',
  'components/payments/QuoteInvoicePanel.tsx',
  'Lib/i18n/payments.ts',
]

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

test('executable payment-share surface has no custom WhatsApp scheme', () => {
  for (const rel of EXECUTABLE_SHARE_SURFACE) {
    const source = readFileSync(join(ROOT, rel), 'utf8')
    assert.doesNotMatch(
      source,
      /whatsapp-business:\/\//,
      `${rel} must not contain ${FORBIDDEN_SCHEME}`,
    )
    assert.doesNotMatch(source, /intent:\/\/send/)
    assert.doesNotMatch(source, /com\.whatsapp\.w4b/)
    assert.doesNotMatch(source, /scheduleFallback|WHATSAPP_BUSINESS_FALLBACK_MS/)
  }
})

test('mobile and desktop both resolve to canonical wa.me', () => {
  const text = shareText('pt')
  const plan = resolvePaymentWhatsAppOpenPlan({
    phone: '+1 (407) 555-1234',
    text,
  })
  const expected = buildPaymentWhatsAppHref('+1 (407) 555-1234', text)
  assert.equal(plan.ok, true)
  assert.equal(plan.mode, 'wa.me')
  assert.equal(plan.phoneDigits, '14075551234')
  assert.equal(plan.href, expected)
  assert.ok(plan.href?.startsWith('https://wa.me/14075551234?text='))
  assert.doesNotMatch(plan.href || '', /whatsapp-business:\/\//)
})

test('+55 uses E.164 digits and encodes PT/EN/ES text on wa.me', () => {
  for (const locale of ['pt', 'en', 'es']) {
    const text = shareText(locale, { customerFirstName: 'João' })
    const plan = resolvePaymentWhatsAppOpenPlan({
      phone: '+55 (11) 98348-1803',
      text,
    })
    assert.equal(plan.phoneDigits, '5511983481803')
    assert.equal(plan.href, buildPaymentWhatsAppHref('+55 (11) 98348-1803', text))
    assert.ok(plan.href?.startsWith('https://wa.me/5511983481803?text='))
    assert.equal(decodeURIComponent((plan.href || '').split('text=')[1] || ''), text)
    assert.match(text, /João|Hi, João|¡Hola, João/)
    assert.doesNotMatch(plan.href || '', /whatsapp-business:\/\//)
  }
})

test('invalid or missing phone has no href and no auto-send path', () => {
  const text = shareText('pt')
  for (const phone of [null, '', '123', '4075551234']) {
    const plan = resolvePaymentWhatsAppOpenPlan({ phone, text })
    assert.equal(plan.ok, false)
    assert.equal(plan.mode, 'invalid-phone')
    assert.equal(plan.href, null)
  }
})

test('opener uses wa.me immediately on mobile and desktop and never auto-sends', () => {
  const text = shareText('en', { purpose: 'full', paymentUrl: longUrl })
  for (const label of ['mobile', 'desktop']) {
    const opened = []
    const assigned = []
    const plan = openPaymentWhatsAppShare(
      { phone: '+14075551234', text },
      {
        assign: (href) => assigned.push(href),
        openBlank: (href) => {
          opened.push(href)
          return true
        },
      },
    )
    assert.equal(plan.mode, 'wa.me', label)
    assert.equal(opened[0], buildPaymentWhatsAppHref('+14075551234', text), label)
    assert.equal(assigned.length, 0, label)
    assert.match(opened[0] || '', /pay%2Fabcdefghijklmnopqrstuvwxyz/)
    assert.doesNotMatch(opened[0] || '', /whatsapp-business:\/\//)
  }
})

test('popup-blocked opener falls back to same-window wa.me assign', () => {
  const text = shareText('pt')
  const assigned = []
  openPaymentWhatsAppShare(
    { phone: '+5511983481803', text },
    {
      assign: (href) => assigned.push(href),
      openBlank: () => false,
    },
  )
  assert.equal(assigned[0], buildPaymentWhatsAppHref('+5511983481803', text))
  assert.ok(assigned[0]?.startsWith('https://wa.me/5511983481803?text='))
})

test('wa.me href never uses the 500-char logistics truncator', () => {
  const hugeUrl = `${longUrl}${'A'.repeat(400)}`
  const text = shareText('pt', { paymentUrl: hugeUrl })
  const href = buildPaymentWhatsAppHref('+14075551234', text)
  assert.ok((href?.split('text=')[1] || '').length > 500)
  assert.equal(decodeURIComponent(href.split('text=')[1]), text)
  assert.doesNotMatch(href, /…/)
  assert.doesNotMatch(href, /whatsapp-business:\/\//)
})

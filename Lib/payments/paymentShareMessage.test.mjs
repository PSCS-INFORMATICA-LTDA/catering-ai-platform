import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPaymentShareMessage,
  buildPaymentWhatsAppHref,
  customerFirstNameFromDisplayName,
  formatPaymentShareAmount,
  paymentSharePhoneDigits,
} from './paymentShareMessage.ts'
import { ignoreClientAmount } from './amountDue.ts'
import { tPayments } from '../i18n/payments.ts'
import {
  companyLogoStoragePath,
  isAppPublicLogoPath,
  isCompanyOgId,
  paymentOgDescription,
  paymentOgMetadataIsSafe,
  resolveOgLogoSrc,
  resolvePaymentOgOrigin,
} from './paymentOgCopy.ts'

const company = 'CDL Services BBQ At Home DEV'

test('A: +1 valid phone becomes wa.me digits', () => {
  assert.equal(paymentSharePhoneDigits('+1 (407) 555-1234'), '14075551234')
  assert.equal(paymentSharePhoneDigits('+14075551234'), '14075551234')
})

test('B: +55 valid phone becomes wa.me digits', () => {
  assert.equal(paymentSharePhoneDigits('+55 (11) 98348-1803'), '5511983481803')
  assert.equal(paymentSharePhoneDigits('+5511983481803'), '5511983481803')
})

test('C: masked number still normalizes when DDI is present', () => {
  assert.equal(paymentSharePhoneDigits('+1-407-555-1415'), '14075551415')
})

test('D: invalid number is rejected', () => {
  assert.equal(paymentSharePhoneDigits('123'), null)
  assert.equal(paymentSharePhoneDigits('4075551234'), null)
})

test('E: missing number is rejected', () => {
  assert.equal(paymentSharePhoneDigits(null), null)
  assert.equal(paymentSharePhoneDigits(''), null)
})

test('F: PT deposit message', () => {
  const { text } = buildPaymentShareMessage({
    locale: 'pt',
    companyDisplayName: company,
    customerFirstName: 'Philippe',
    quoteNumber: 'Q-2026-000187',
    purpose: 'deposit',
    amount: 846,
    currency: 'USD',
    paymentUrl: 'https://catering-ai-agenda-dev.vercel.app/pay/abc',
  })
  assert.match(text, /Olá, Philippe!/)
  assert.match(text, /sinal da sua cotação/)
  assert.match(text, /Q-2026-000187/)
  assert.match(text, /846/)
  assert.match(text, /https:\/\/catering-ai-agenda-dev\.vercel\.app\/pay\/abc/)
  assert.doesNotMatch(text, /saldo da sua cotação/)
})

test('G: PT balance message', () => {
  const { text } = buildPaymentShareMessage({
    locale: 'pt',
    companyDisplayName: company,
    customerFirstName: 'Philippe',
    quoteNumber: 'Q-2026-000187',
    purpose: 'balance',
    amount: 1874,
    currency: 'USD',
    paymentUrl: 'https://example.test/pay/xyz',
  })
  assert.match(text, /saldo da sua cotação/)
  assert.match(text, /1\.874|1874/)
  assert.doesNotMatch(text, /sinal da sua cotação/)
})

test('H: EN deposit and balance', () => {
  const deposit = buildPaymentShareMessage({
    locale: 'en',
    companyDisplayName: company,
    customerFirstName: 'Anna',
    quoteNumber: 'Q-1',
    purpose: 'deposit',
    amount: 100,
    currency: 'USD',
    paymentUrl: 'https://pay.example/d',
  }).text
  const balance = buildPaymentShareMessage({
    locale: 'en',
    companyDisplayName: company,
    customerFirstName: 'Anna',
    quoteNumber: 'Q-1',
    purpose: 'balance',
    amount: 200,
    currency: 'USD',
    paymentUrl: 'https://pay.example/b',
  }).text
  assert.match(deposit, /Hi, Anna!/)
  assert.match(deposit, /Deposit amount/)
  assert.match(balance, /Balance due/)
  assert.match(balance, /remaining balance/)
})

test('I: ES deposit and balance', () => {
  const deposit = buildPaymentShareMessage({
    locale: 'es',
    companyDisplayName: company,
    customerFirstName: 'Luis',
    quoteNumber: 'Q-2',
    purpose: 'deposit',
    amount: 50,
    currency: 'USD',
    paymentUrl: 'https://pay.example/d',
  }).text
  const balance = buildPaymentShareMessage({
    locale: 'es',
    companyDisplayName: company,
    customerFirstName: 'Luis',
    quoteNumber: 'Q-2',
    purpose: 'balance',
    amount: 80,
    currency: 'USD',
    paymentUrl: 'https://pay.example/b',
  }).text
  assert.match(deposit, /¡Hola, Luis!/)
  assert.match(deposit, /Valor del depósito/)
  assert.match(balance, /Saldo pendiente/)
})

test('J: wa.me URL encoding', () => {
  const text = buildPaymentShareMessage({
    locale: 'pt',
    companyDisplayName: company,
    customerFirstName: 'João',
    quoteNumber: 'Q-3',
    purpose: 'deposit',
    amount: 10,
    currency: 'USD',
    paymentUrl: 'https://pay.example/t',
  }).text
  const href = buildPaymentWhatsAppHref('+1 (407) 555-1234', text)
  assert.ok(href?.startsWith('https://wa.me/14075551234?text='))
  assert.ok(href && !href.includes('+1 (407)'))
  assert.ok(href && decodeURIComponent(href.split('text=')[1] || '').includes('João'))
})

test('K: amount format uses currency', () => {
  const formatted = formatPaymentShareAmount(846, 'USD', 'en')
  assert.match(formatted, /846/)
  assert.match(formatted, /\$|USD/)
})

test('first name ignores email and empty labels', () => {
  assert.equal(customerFirstNameFromDisplayName('Philippe Santana'), 'Philippe')
  assert.equal(customerFirstNameFromDisplayName('qa@example.com'), '')
  assert.equal(customerFirstNameFromDisplayName('Cliente sem nome'), '')
})

test('full payment share is distinct from deposit and balance', () => {
  const pt = buildPaymentShareMessage({
    locale: 'pt',
    companyDisplayName: company,
    customerFirstName: 'Philippe',
    quoteNumber: 'Q-2026-000187',
    purpose: 'full',
    amount: 2820,
    currency: 'USD',
    paymentUrl: 'https://catering-ai-agenda-dev.vercel.app/pay/full',
  }).text
  const en = buildPaymentShareMessage({
    locale: 'en',
    companyDisplayName: company,
    purpose: 'full',
    amount: 2820,
    currency: 'USD',
    paymentUrl: 'https://example.test/pay/full',
  }).text
  const es = buildPaymentShareMessage({
    locale: 'es',
    companyDisplayName: company,
    purpose: 'full',
    amount: 2820,
    currency: 'USD',
    paymentUrl: 'https://example.test/pay/full',
  }).text
  assert.match(pt, /pagamento total/)
  assert.match(en, /full amount/)
  assert.match(es, /importe total/)
  assert.doesNotMatch(pt, /sinal da sua cotação/)
  assert.doesNotMatch(en, /Deposit amount/)
})

test('L: client amount is ignored by the payment charge path', () => {
  assert.equal(ignoreClientAmount(9999), null)
  assert.equal(ignoreClientAmount('846'), null)
})

test('N/O: company A and B keep distinct logo storage paths', () => {
  const companyA = companyLogoStoragePath(
    'https://example.supabase.co/storage/v1/object/public/company-logos/65fd576f-8d97-49ba-bf38-61bc1e94e94a/logo.png',
  )
  const companyB = companyLogoStoragePath(
    'https://example.supabase.co/storage/v1/object/public/company-logos/a1111111-1111-4111-8111-111111111111/logo.png',
  )
  assert.equal(companyA, '65fd576f-8d97-49ba-bf38-61bc1e94e94a/logo.png')
  assert.equal(companyB, 'a1111111-1111-4111-8111-111111111111/logo.png')
  assert.notEqual(companyA, companyB)
})

test('P: missing logo has no storage path', () => {
  assert.equal(companyLogoStoragePath(null), null)
  assert.equal(companyLogoStoragePath('https://example.test/cdn/logo.png'), null)
})

test('registered public logo paths stay readable without a second company table', () => {
  assert.equal(isAppPublicLogoPath('/cdl/logo.png'), true)
  assert.equal(isAppPublicLogoPath('/brand/catering-logo-dark.png'), true)
  assert.equal(isAppPublicLogoPath('/api/public/company-brand/x/og'), false)
  assert.equal(isAppPublicLogoPath('../secret.png'), false)
  assert.equal(
    resolveOgLogoSrc('/cdl/logo.png', 'https://preview.example'),
    'https://preview.example/cdl/logo.png',
  )
  assert.equal(resolveOgLogoSrc(null, 'https://preview.example'), null)
})

test('i18n payment share keys exist in PT/EN/ES', () => {
  assert.equal(
    tPayments('pt', 'missingCustomerWhatsApp'),
    'Cliente sem WhatsApp válido cadastrado.',
  )
  assert.equal(tPayments('en', 'sendDepositWhatsApp'), 'Send deposit on WhatsApp Business')
  assert.match(tPayments('pt', 'whatsappBusinessIosHint'), /WhatsApp Business/)
  assert.match(tPayments('pt', 'paypalSandboxBuyerNotice'), /conta de comprador Sandbox/)
  assert.equal(tPayments('es', 'copyPaymentMessage'), 'Copiar mensaje')
})

test('OG origin prefers the shared host and company ids stay UUIDs', () => {
  assert.equal(
    resolvePaymentOgOrigin({
      forwardedHost: 'catering-ai-platform-preview.vercel.app',
      host: 'localhost:3000',
      forwardedProto: 'https',
    }),
    'https://catering-ai-platform-preview.vercel.app',
  )
  assert.equal(isCompanyOgId('65fd576f-8d97-49ba-bf38-61bc1e94e94a'), true)
  assert.equal(isCompanyOgId('fallback'), false)
})

test('OG copy is generic and safe', () => {
  assert.equal(paymentOgDescription('pt'), 'Pagamento seguro da sua cotação.')
  assert.equal(paymentOgDescription('en'), 'Secure payment for your catering quote.')
  assert.equal(paymentOgDescription('es'), 'Pago seguro de tu cotización.')
  assert.equal(
    paymentOgMetadataIsSafe({
      title: company,
      description: paymentOgDescription('pt'),
      imagePath: '/api/public/company-brand/65fd576f-8d97-49ba-bf38-61bc1e94e94a/og',
    }),
    true,
  )
  assert.equal(
    paymentOgMetadataIsSafe({
      title: 'Philippe +1 407 555 1234',
      description: 'call me',
      imagePath: '/api/public/company-brand/x/og',
    }),
    false,
  )
  assert.equal(
    paymentOgMetadataIsSafe({
      title: company,
      description: paymentOgDescription('en'),
      imagePath: '/pay/super-secret-token-value/opengraph-image',
    }),
    false,
  )
})

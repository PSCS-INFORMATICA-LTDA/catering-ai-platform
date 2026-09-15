import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  resolveInvoiceDocumentLocale,
  resolvePublicPaymentLocale,
} from './invoiceDocumentLocale.ts'
import { buildPaymentShareMessage } from './paymentShareMessage.ts'
import { tPayments } from '../i18n/payments.ts'
import {
  buildInvoiceFinancialPresentation,
  explainDepositFromCanonical,
} from './invoiceFinancialPresentation.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const snapshot = {
  version: 'CDL_INVOICE_SNAP_2026_V1',
  frozenAt: '2026-09-14T21:28:33.301Z',
  locale: 'pt',
  quote: { id: 'quote-fixture', number: 'Q-FIXTURE', status: 'approved' },
  customer: { id: 'cust', name: 'QA Invoice Transparency', email: null, phone: null },
  event: {
    name: 'QA Invoice Transparency',
    date: '2026-09-30',
    startTime: '11:00:00',
    endTime: '15:00:00',
    address: 'Lakewood Ranch, FL',
    city: 'Lakewood Ranch',
    region: 'FL',
    postalCode: '34211',
  },
  package: { id: null, key: 'BBQTRAD', name: 'BBQ Tradicional', unitPrice: 45, total: 2452.5 },
  guests: {
    adults: 20,
    childrenUnder3: 30,
    children4To12: 69,
    billableGuestCount: 54.5,
    physicalGuestCount: 119,
  },
  additionals: [],
  garnishes: { included: false, description: null, total: 0 },
  grill: { required: true, quantity: 1, total: 100 },
  mileage: { distance: 115.1, freeLimit: 20, rate: 2, fee: 230.2 },
  commercial: {
    discount: 148.3,
    holidaySurcharge: 0,
    minimumOrderAmount: 800,
    minimumOrderApplied: false,
    onlinePaymentFee: 0,
    coupon: {
      code: 'CDL10',
      apply_to_deposit: false,
      apply_to_balance: true,
      deposit_discount_amount: 0,
      balance_discount_amount: 148.3,
    },
  },
  reservation: { percentage: 30, depositAmount: 958.86, balanceAmount: 2089.04 },
  totals: { subtotal: 3196.2, total: 3047.9, currency: 'USD' },
  pricingBreakdown: {
    lines: [
      {
        line_key: 'mileage',
        quantity: 115.1,
        unit_price: 2,
        amount: 230.2,
        metadata: { distance: 115.1, free_limit: 20, full_trip: true },
      },
    ],
    adjustments: [],
    coupon: {
      code: 'CDL10',
      apply_to_deposit: false,
      apply_to_balance: true,
      deposit_discount_amount: 0,
      balance_discount_amount: 148.3,
    },
  },
}

describe('invoice document locale + mileage explanation', () => {
  const presentation = buildInvoiceFinancialPresentation({
    snapshot,
    invoiceKind: 'original',
    subtotal: 3196.2,
    total: 3047.9,
    depositAmount: 958.86,
    balanceAmount: 2089.04,
    paidTotal: 0,
    currency: 'USD',
  })

  it('A-C uses invoice/proposal locale for pay, PDF and WhatsApp', () => {
    assert.equal(resolveInvoiceDocumentLocale('pt'), 'pt')
    assert.equal(resolveInvoiceDocumentLocale('en'), 'en')
    assert.equal(resolveInvoiceDocumentLocale('es'), 'es')
    assert.equal(
      resolvePublicPaymentLocale({ invoiceLocale: 'pt', previewLang: null }),
      'pt',
    )
    assert.equal(
      resolvePublicPaymentLocale({ invoiceLocale: 'en', previewLang: '' }),
      'en',
    )
    assert.equal(
      resolvePublicPaymentLocale({ invoiceLocale: 'es', previewLang: undefined }),
      'es',
    )
    const pt = buildPaymentShareMessage({
      locale: 'pt',
      companyDisplayName: 'CDL',
      customerFirstName: 'Ana',
      quoteNumber: 'Q-PT',
      purpose: 'deposit',
      amount: 958.86,
      currency: 'USD',
      paymentUrl: 'https://example.test/pay/pt',
    }).text
    const en = buildPaymentShareMessage({
      locale: 'en',
      companyDisplayName: 'CDL',
      customerFirstName: 'Ann',
      quoteNumber: 'Q-EN',
      purpose: 'deposit',
      amount: 958.86,
      currency: 'USD',
      paymentUrl: 'https://example.test/pay/en',
    }).text
    const es = buildPaymentShareMessage({
      locale: 'es',
      companyDisplayName: 'CDL',
      customerFirstName: 'Ana',
      quoteNumber: 'Q-ES',
      purpose: 'deposit',
      amount: 958.86,
      currency: 'USD',
      paymentUrl: 'https://example.test/pay/es',
    }).text
    assert.match(pt, /Olá, Ana!/)
    assert.match(pt, /sinal da sua cotação/)
    assert.match(en, /Hi, Ann!/)
    assert.match(en, /Deposit amount/)
    assert.match(es, /¡Hola, Ana!/)
    assert.match(es, /Valor del depósito/)
    const payPage = readFileSync(join(ROOT, 'app/pay/[token]/page.tsx'), 'utf8')
    const pdf = readFileSync(join(ROOT, 'components/payments/InvoicePdfDocument.tsx'), 'utf8')
    const detail = readFileSync(join(ROOT, 'components/payments/InvoiceDetailView.tsx'), 'utf8')
    const breakdown = readFileSync(
      join(ROOT, 'components/payments/InvoiceFinancialBreakdown.tsx'),
      'utf8',
    )
    const workspace = readFileSync(
      join(ROOT, 'components/commercial-review/CommercialReviewWorkspace.tsx'),
      'utf8',
    )
    const panel = readFileSync(join(ROOT, 'components/payments/QuoteInvoicePanel.tsx'), 'utf8')
    assert.match(payPage, /resolvePublicPaymentLocale/)
    assert.match(payPage, /invoiceLocale: resolved\.invoice\.locale/)
    assert.match(pdf, /const lang = invoice\.locale/)
    assert.match(pdf, /mileageFullTrip/)
    assert.match(pdf, /mileageCourtesyHelp/)
    assert.match(pdf, /mileageCourtesyValue/)
    assert.match(detail, /resolveInvoiceDocumentLocale\(invoice\.locale/)
    assert.match(detail, /locale=\{documentLocale\}/)
    assert.match(breakdown, /mileageCourtesyHelp/)
    assert.match(breakdown, /invoice-mileage-courtesy-help/)
    assert.match(workspace, /language=\{quote\.language \?\? 'pt'\}/)
    assert.match(panel, /invoice\?\.locale \|\| quoteLanguage/)
  })

  it('D-F localizes mileage labels without changing amounts', () => {
    assert.equal(tPayments('pt', 'mileageDistance'), 'Distância considerada')
    assert.equal(tPayments('en', 'mileageDistance'), 'Distance considered')
    assert.equal(tPayments('es', 'mileageDistance'), 'Distancia considerada')
    assert.equal(tPayments('pt', 'mileageChargeable'), 'Distância faturável do trajeto')
    assert.equal(tPayments('en', 'mileageChargeable'), 'Billable trip distance')
    assert.equal(tPayments('es', 'mileageChargeable'), 'Distancia facturable del trayecto')
    assert.equal(tPayments('pt', 'mileageIncluded'), 'Limite de cortesia')
    assert.equal(tPayments('en', 'mileageIncluded'), 'Courtesy threshold')
    assert.equal(tPayments('es', 'mileageIncluded'), 'Límite de cortesía')
    assert.equal(tPayments('pt', 'mileageCourtesyValue', { n: 20 }), 'até 20 mi')
    assert.equal(tPayments('en', 'mileageCourtesyValue', { n: 20 }), 'up to 20 mi')
    assert.equal(tPayments('es', 'mileageCourtesyValue', { n: 20 }), 'hasta 20 mi')
    assert.match(tPayments('pt', 'mileageCourtesyHelp', { n: 20 }), /Até 20 mi, não há cobrança/)
    assert.match(tPayments('en', 'mileageCourtesyHelp', { n: 20 }), /Up to 20 mi, there is no mileage charge/)
    assert.match(tPayments('es', 'mileageCourtesyHelp', { n: 20 }), /Hasta 20 mi no se cobra kilometraje/)
    assert.match(tPayments('pt', 'mileageFullTrip'), /trajeto completo/)
    assert.match(tPayments('en', 'mileageFullTrip'), /full trip/)
    assert.match(tPayments('es', 'mileageFullTrip'), /trayecto completo/)
    assert.doesNotMatch(tPayments('pt', 'mileageIncluded'), /Franquia/)
    assert.doesNotMatch(tPayments('en', 'mileageIncluded'), /allowance/i)
    assert.doesNotMatch(tPayments('es', 'mileageIncluded'), /Franquicia/)
    assert.equal(tPayments('pt', 'mileageTotal'), 'Total de quilometragem')
    assert.equal(tPayments('en', 'mileageTotal'), 'Mileage total')
    assert.equal(tPayments('es', 'mileageTotal'), 'Total de millas')
  })

  it('G-I keeps frozen mileage, deposit and total unchanged', () => {
    assert.equal(presentation.mileage.distance, 115.1)
    assert.equal(presentation.mileage.freeLimit, 20)
    assert.equal(presentation.mileage.chargeable, 115.1)
    assert.notEqual(presentation.mileage.chargeable, 95.1)
    assert.equal(presentation.mileage.rate, 2)
    assert.equal(presentation.mileage.fee, 230.2)
    assert.equal(presentation.mileage.fullTrip, true)
    assert.equal(presentation.baseBeforeDiscount, 3196.2)
    assert.equal(presentation.coupon.discountAmount, 148.3)
    assert.equal(presentation.finalContractTotal, 3047.9)
    assert.equal(presentation.depositAmount, 958.86)
    assert.equal(presentation.balanceAmount, 2089.04)
    const why = explainDepositFromCanonical(presentation)
    assert.equal(why.applyToDeposit, false)
    assert.equal(why.expectedDepositFromBase, 958.86)
    assert.equal(why.matchesBaseTimesPercent, true)
  })

  it('J preview lang does not replace the invoice locale unless explicitly requested', () => {
    assert.equal(
      resolvePublicPaymentLocale({ invoiceLocale: 'pt', previewLang: 'en' }),
      'en',
    )
    assert.equal(
      resolvePublicPaymentLocale({ invoiceLocale: 'es', previewLang: 'pt' }),
      'pt',
    )
    assert.equal(
      resolvePublicPaymentLocale({ invoiceLocale: 'en', previewLang: 'not-a-lang' }),
      'en',
    )
  })
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tPayments } from '../i18n/payments.ts'
import { INVOICE_LOGO_PDF } from './invoiceBrand.ts'
import { buildInvoiceFinancialPresentation } from './invoiceFinancialPresentation.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

test('invoice logo grows ~15-20% without hardcoding CDL rendering', () => {
  assert.equal(INVOICE_LOGO_PDF.width, 108)
  assert.equal(INVOICE_LOGO_PDF.height, 56)
  assert.ok(108 / 92 >= 1.15 && 108 / 92 <= 1.2)
  const pdf = read('components/payments/InvoicePdfDocument.tsx')
  const pay = read('components/payments/PublicPaymentPage.tsx')
  assert.match(pdf, /INVOICE_LOGO_PDF/)
  assert.match(pdf, /objectFit: 'contain'/)
  assert.doesNotMatch(pdf, /width: 92, height: 48/)
  assert.match(pay, /INVOICE_LOGO_WEB_CLASS/)
  assert.doesNotMatch(pay, /h-10 w-auto/)
  const brand = read('Lib/payments/invoiceBrand.ts')
  assert.match(brand, /h-12 w-auto max-w-\[180px\] object-contain/)
})

test('Package, Sides and Add-ons stay distinct in PT/EN/ES', () => {
  assert.equal(tPayments('pt', 'sectionPackage'), 'Pacote')
  assert.equal(tPayments('en', 'sectionPackage'), 'Package')
  assert.equal(tPayments('es', 'sectionPackage'), 'Paquete')
  assert.equal(tPayments('pt', 'sectionSides'), 'Guarnições')
  assert.equal(tPayments('en', 'sectionSides'), 'Sides')
  assert.equal(tPayments('es', 'sectionSides'), 'Guarniciones')
  assert.equal(tPayments('pt', 'sectionAddons'), 'Adicionais')
  assert.equal(tPayments('en', 'sectionAddons'), 'Add-ons')
  assert.equal(tPayments('es', 'sectionAddons'), 'Extras')
  assert.equal(tPayments('en', 'additionals'), 'Add-ons')
  assert.notEqual(tPayments('pt', 'sectionSides'), tPayments('pt', 'sectionAddons'))
  assert.notEqual(tPayments('en', 'garnishes'), tPayments('en', 'additionals'))
  const commercial = read('Lib/i18n/commercialReview.ts')
  assert.match(commercial, /Acompanhamentos/)
})

test('invoice presentation keeps package/sides/addons kinds and totals', () => {
  const presentation = buildInvoiceFinancialPresentation({
    snapshot: {
      version: 'CDL_INVOICE_SNAP_2026_V1',
      frozenAt: '2026-09-14T21:28:33.301Z',
      locale: 'pt',
      quote: { id: 'q', number: 'Q-1', status: 'approved' },
      customer: { id: 'c', name: 'Ana', email: null, phone: null },
      event: {
        name: 'Evento',
        date: '2026-09-30',
        startTime: '11:00:00',
        endTime: '15:00:00',
        address: 'Lakewood Ranch, FL',
        city: 'Lakewood Ranch',
        region: 'FL',
        postalCode: '34211',
      },
      package: { id: null, key: 'BBQTRAD', name: 'BBQ Tradicional', unitPrice: 45, total: 100 },
      guests: {
        adults: 2,
        childrenUnder3: 0,
        children4To12: 0,
        billableGuestCount: 2,
        physicalGuestCount: 2,
      },
      additionals: [{ itemId: 'waiter', label: 'Garçom', quantity: 1, unitPrice: 250, total: 250 }],
      garnishes: { included: true, description: 'Arroz', total: 0 },
      grill: { required: false, quantity: 0, total: 0 },
      mileage: { distance: 0, freeLimit: 20, rate: 2, fee: 0 },
      commercial: {
        discount: 0,
        holidaySurcharge: 0,
        minimumOrderAmount: 0,
        minimumOrderApplied: false,
        onlinePaymentFee: 0,
      },
      reservation: { percentage: 30, depositAmount: 105, balanceAmount: 245 },
      totals: { subtotal: 350, total: 350, currency: 'USD' },
      pricingBreakdown: { lines: [], adjustments: [] },
    },
    invoiceKind: 'original',
    subtotal: 350,
    total: 350,
    depositAmount: 105,
    balanceAmount: 245,
    paidTotal: 0,
    currency: 'USD',
  })
  assert.ok(presentation.chargeRows.some((row) => row.kind === 'package'))
  assert.ok(presentation.chargeRows.some((row) => row.kind === 'garnish'))
  assert.ok(presentation.chargeRows.some((row) => row.kind === 'additional'))
  assert.equal(presentation.finalContractTotal, 350)
  assert.equal(presentation.depositAmount, 105)
  assert.equal(presentation.balanceAmount, 245)
  const breakdown = read('components/payments/InvoiceFinancialBreakdown.tsx')
  assert.match(breakdown, /data-invoice-section=\{section\}/)
  assert.match(breakdown, /sectionSides/)
  assert.match(breakdown, /sectionAddons/)
  const pdf = read('components/payments/InvoicePdfDocument.tsx')
  assert.match(pdf, /sourceQuote/)
  assert.match(pdf, /eventTime/)
  assert.match(pdf, /invoiceStatusLabel/)
})

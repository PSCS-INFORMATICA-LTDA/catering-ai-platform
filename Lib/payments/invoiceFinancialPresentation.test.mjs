import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildInvoiceFinancialPresentation,
  explainDepositFromCanonical,
  presentationHasMergedChildren,
} from './invoiceFinancialPresentation.ts'

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
  package: {
    id: null,
    key: 'BBQTRAD',
    name: 'BBQ Tradicional',
    unitPrice: 45,
    total: 2452.5,
  },
  guests: {
    adults: 20,
    childrenUnder3: 30,
    children4To12: 69,
    billableGuestCount: 54.5,
    physicalGuestCount: 119,
  },
  additionals: [
    { itemId: 'waiter', label: 'Garçom', quantity: 1, unitPrice: 250, total: 250 },
    { itemId: 'kit', label: 'Kit de Descartáveis', quantity: 1, unitPrice: 3, total: 163.5 },
  ],
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
      campaign_name: 'CDL Barbecue Comercial',
      discount_type: 'percent',
      discount_value: 5,
      apply_to_deposit: false,
      apply_to_balance: true,
      applied_discount_amount: 148.3,
      deposit_discount_amount: 0,
      balance_discount_amount: 148.3,
    },
  },
  reservation: { percentage: 30, depositAmount: 958.86, balanceAmount: 2089.04 },
  totals: { subtotal: 3196.2, total: 3047.9, currency: 'USD' },
  pricingBreakdown: {
    schema_version: 1,
    engine_version: '1.0.0',
    computed_at: '2026-09-14T09:25:42.449Z',
    subtotal: 3196.2,
    total: 3047.9,
    deposit: 958.86,
    balance: 2089.04,
    guest_counts: {
      adultCount: 20,
      childrenUnder3Count: 30,
      children4To12Count: 69,
      billable_guest_count: 54.5,
      physical_guest_count: 119,
    },
    rules_applied: { reservationPercentage: 30, mileageFreeLimit: 20, mileageRate: 2 },
    lines: [
      {
        line_key: 'package',
        source_type: 'package',
        description: 'BBQ Tradicional',
        quantity: 54.5,
        unit: 'guest',
        unit_price: 45,
        amount: 2452.5,
        formula: '45 × 54.5',
        metadata: { package_list_price: 45 },
      },
      {
        line_key: 'additional_item',
        source_type: 'catalog_item',
        source_id: 'waiter',
        description: 'Garçom',
        quantity: 1,
        unit: 'UN',
        unit_price: 250,
        amount: 250,
        formula: '250 × 1',
      },
      {
        line_key: 'additional_item',
        source_type: 'catalog_item',
        source_id: 'kit',
        description: 'Kit de Descartáveis',
        quantity: 54.5,
        unit: 'guest',
        unit_price: 3,
        amount: 163.5,
        formula: '3 × 54.5',
        metadata: { per_person: true },
      },
      {
        line_key: 'mileage',
        source_type: 'mileage',
        description: 'Milhagem (Orlando Eye)',
        quantity: 115.1,
        unit: 'mi',
        unit_price: 2,
        amount: 230.2,
        formula: '115.1 × 2',
        metadata: { distance: 115.1, free_limit: 20, full_trip: true },
      },
      {
        line_key: 'grill_rental',
        source_type: 'grill_rental',
        description: 'Aluguel de churrasqueira',
        quantity: 1,
        unit: 'unit',
        unit_price: 100,
        amount: 100,
        formula: '100 × 1',
      },
    ],
    adjustments: [
      {
        line_key: 'discount',
        source_type: 'discount',
        description: 'Cupom CDL10',
        quantity: 1,
        unit: 'adjustment',
        unit_price: -148.3,
        amount: -148.3,
        metadata: { apply_to_deposit: false, apply_to_balance: true },
      },
    ],
    coupon: {
      code: 'CDL10',
      campaign_name: 'CDL Barbecue Comercial',
      discount_type: 'percent',
      discount_value: 5,
      apply_to_deposit: false,
      apply_to_balance: true,
      applied_discount_amount: 148.3,
      deposit_discount_amount: 0,
      balance_discount_amount: 148.3,
    },
  },
}

describe('invoice financial presentation — INV-2026-000010 shape', () => {
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

  it('keeps adults, children 4-12 and children 0-3 separate', () => {
    assert.equal(presentationHasMergedChildren(presentation), false)
    assert.equal(presentation.guests.adults, 20)
    assert.equal(presentation.guests.children4To12, 69)
    assert.equal(presentation.guests.childrenUnder3, 30)
    assert.equal(presentation.guests.billableGuestCount, 54.5)
    assert.equal(presentation.guests.physicalGuestCount, 119)
    assert.equal(presentation.guests.adultAmount, 900)
    assert.equal(presentation.guests.children4To12Amount, 1552.5)
    assert.equal(presentation.guests.childrenUnder3Amount, 0)
    assert.equal(presentation.packageUnitPrice, 45)
    assert.equal(presentation.packageTotal, 2452.5)
    assert.equal(900 + 1552.5 + 0, 2452.5)
    const childRow = presentation.chargeRows.find((row) => row.id === 'children-4-12')
    assert.match(childRow.formula, /69 × 50% × 45\.00 = 1552\.50/)
    assert.doesNotMatch(childRow.formula, /69 × 45\.00 = 1552/)
  })

  it('shows additional unit prices from the frozen breakdown', () => {
    const waiter = presentation.additionals.find((line) => line.label === 'Garçom')
    const kit = presentation.additionals.find((line) => line.label.includes('Kit'))
    assert.equal(waiter.unitPrice, 250)
    assert.equal(waiter.quantity, 1)
    assert.equal(waiter.total, 250)
    assert.equal(kit.unitPrice, 3)
    assert.equal(kit.quantity, 54.5)
    assert.equal(kit.total, 163.5)
  })

  it('explains mileage from the frozen snapshot, including full-trip billing', () => {
    assert.equal(presentation.mileage.distance, 115.1)
    assert.equal(presentation.mileage.freeLimit, 20)
    assert.equal(presentation.mileage.chargeable, 115.1)
    assert.equal(presentation.mileage.rate, 2)
    assert.equal(presentation.mileage.fee, 230.2)
    assert.equal(presentation.mileage.fullTrip, true)
    assert.notEqual(presentation.mileage.chargeable, 95.1)
    assert.equal(Math.round(presentation.mileage.chargeable * presentation.mileage.rate * 100) / 100, 230.2)
  })

  it('shows grill and coupon allocation without inventing new math', () => {
    assert.equal(presentation.grill.total, 100)
    assert.equal(presentation.coupon.code, 'CDL10')
    assert.equal(presentation.coupon.applyToDeposit, false)
    assert.equal(presentation.coupon.applyToBalance, true)
    assert.equal(presentation.coupon.allocatedToDeposit, 0)
    assert.equal(presentation.coupon.allocatedToBalance, 148.3)
    assert.equal(presentation.coupon.discountAmount, 148.3)
  })

  it('proves why the deposit is 958.86 from canonical configuration', () => {
    const why = explainDepositFromCanonical(presentation)
    assert.equal(why.baseBeforeDiscount, 3196.2)
    assert.equal(why.depositPercentage, 30)
    assert.equal(why.expectedDepositFromBase, 958.86)
    assert.equal(why.actualDeposit, 958.86)
    assert.equal(why.matchesBaseTimesPercent, true)
    assert.equal(why.applyToDeposit, false)
    assert.equal(why.allocatedToDeposit, 0)
    assert.equal(why.allocatedToBalance, 148.3)
    assert.equal(presentation.finalContractTotal, 3047.9)
    assert.equal(presentation.balanceAmount, 2089.04)
    assert.equal(Math.round((3196.2 - 148.3) * 100) / 100, 3047.9)
    assert.equal(Math.round((3047.9 - 958.86) * 100) / 100, 2089.04)
  })

  it('reconciles charged lines to the cent and keeps deposit+balance = total', () => {
    assert.equal(presentation.reconcilesToCent, true)
    assert.equal(presentation.depositPlusBalanceMatchesTotal, true)
    const packagePlusExtras =
      2452.5 + 250 + 163.5 + 230.2 + 100 - 148.3
    assert.equal(Math.round(packagePlusExtras * 100) / 100, 3047.9)
  })
})

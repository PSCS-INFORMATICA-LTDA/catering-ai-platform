import type { PricingBreakdown } from '@/Lib/pricing/pricingBreakdownTypes'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

export const INVOICE_STATUSES = [
  'draft',
  'ready',
  'awaiting_deposit',
  'partially_paid',
  'paid',
  'canceled',
] as const

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const PAYMENT_PURPOSES = ['deposit', 'balance', 'full'] as const
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number]

export const PAYMENT_PROVIDERS = ['paypal', 'zelle', 'bank_transfer'] as const
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]

export const PAYMENT_ATTEMPT_STATUSES = [
  'created',
  'approved',
  'completed',
  'failed',
  'canceled',
] as const
export type PaymentAttemptStatus = (typeof PAYMENT_ATTEMPT_STATUSES)[number]

export const INVOICE_SNAPSHOT_VERSION = 'CDL_INVOICE_SNAP_2026_V1'

export type InvoiceSnapshotGuest = {
  adults: number
  childrenUnder3: number
  children4To12: number
  billableGuestCount: number
  physicalGuestCount: number
}

export type InvoiceSnapshot = {
  version: typeof INVOICE_SNAPSHOT_VERSION
  frozenAt: string
  locale: QuoteLanguage
  quote: {
    id: string
    number: string | null
    status: string | null
  }
  customer: {
    id: string | null
    name: string
    email: string | null
    phone: string | null
  }
  event: {
    name: string | null
    date: string | null
    startTime: string | null
    endTime: string | null
    address: string | null
    city: string | null
    region: string | null
    postalCode: string | null
  }
  package: {
    id: string | null
    key: string | null
    name: string | null
    unitPrice: number | null
    total: number | null
  }
  guests: InvoiceSnapshotGuest
  additionals: Array<{
    itemId: string
    label: string
    quantity: number
    unitPrice: number
    total: number
  }>
  garnishes?: {
    included: boolean
    description: string | null
    total: number
  }
  grill: {
    required: boolean
    quantity: number
    total: number
  }
  mileage: {
    distance: number | null
    freeLimit: number | null
    rate: number | null
    fee: number | null
  }
  commercial: {
    discount: number
    holidaySurcharge: number
    minimumOrderAmount: number
    minimumOrderApplied: boolean
    onlinePaymentFee: 0
  }
  reservation: {
    percentage: number
    depositAmount: number
    balanceAmount: number
  }
  totals: {
    subtotal: number
    total: number
    currency: string
  }
  pricingBreakdown: PricingBreakdown | null
}

export type InvoiceRecord = {
  id: string
  company_id: string
  quote_id: string
  invoice_number: string
  status: InvoiceStatus
  locale: QuoteLanguage
  currency_code: string
  snapshot: InvoiceSnapshot
  subtotal: number
  total: number
  deposit_amount: number
  balance_amount: number
  paid_total: number
  online_payment_fee: number
  created_at: string
  updated_at: string
}

export type InvoicePaymentLinkRecord = {
  id: string
  company_id: string
  invoice_id: string
  token_hash: string
  purpose: PaymentPurpose
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

export type InvoicePaymentRecord = {
  id: string
  company_id: string
  invoice_id: string
  provider: PaymentProvider
  purpose: PaymentPurpose
  amount: number
  currency_code: string
  status: PaymentAttemptStatus
  provider_order_id: string | null
  provider_capture_id: string | null
  idempotency_key: string
  metadata: Record<string, unknown>
  created_at: string
  captured_at: string | null
}

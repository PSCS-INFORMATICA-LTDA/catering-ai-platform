import { resolveEventStartInstant, normalizeCompanyTimezone } from './eventInstant.ts'
import type { InvoiceKind, InvoiceSnapshot, PaymentPurpose } from './types.ts'

export type PaymentPurposeAvailability = {
  depositAvailable: boolean
  balanceAvailable: boolean
  fullAvailable: boolean
  balanceAvailableAt: string | null
  reason: string | null
}

export function isPurposeAvailable(
  availability: PaymentPurposeAvailability,
  purpose: PaymentPurpose,
) {
  if (purpose === 'deposit') return availability.depositAvailable
  if (purpose === 'balance') return availability.balanceAvailable
  return availability.fullAvailable
}

export function resolvePaymentPurposeAvailability(input: {
  invoiceKind?: InvoiceKind | string | null
  invoiceStatus?: string | null
  depositDue: number
  balanceDue: number
  fullDue: number
  eventDate?: string | null
  eventStartTime?: string | null
  companyTimezone?: string | null
  now?: Date
}): PaymentPurposeAvailability {
  const depositDue = Math.max(0, Number(input.depositDue) || 0)
  const balanceDue = Math.max(0, Number(input.balanceDue) || 0)
  const fullDue = Math.max(0, Number(input.fullDue) || 0)
  const status = String(input.invoiceStatus || '')
    .trim()
    .toLowerCase()
  if (status === 'canceled' || status === 'cancelled') {
    return {
      depositAvailable: false,
      balanceAvailable: false,
      fullAvailable: false,
      balanceAvailableAt: null,
      reason: 'invoice_canceled',
    }
  }

  const depositAvailable = depositDue > 0
  const fullAvailable = fullDue > 0
  const kind = String(input.invoiceKind || 'original')
  if (kind === 'post_event_adjustment') {
    return {
      depositAvailable,
      balanceAvailable: balanceDue > 0,
      fullAvailable,
      balanceAvailableAt: null,
      reason: null,
    }
  }

  const event = resolveEventStartInstant({
    date: input.eventDate,
    startTime: input.eventStartTime,
    timeZone: normalizeCompanyTimezone(input.companyTimezone),
  })
  if (!event.ok) {
    return {
      depositAvailable,
      balanceAvailable: false,
      fullAvailable,
      balanceAvailableAt: null,
      reason: balanceDue > 0 ? 'event_start_unknown' : null,
    }
  }

  const now = input.now ?? new Date()
  const started = now.getTime() >= event.ms
  return {
    depositAvailable,
    balanceAvailable: started && balanceDue > 0,
    fullAvailable,
    balanceAvailableAt: event.iso,
    reason:
      !started && balanceDue > 0 ? 'balance_not_available_yet' : null,
  }
}

export function availabilityFromInvoiceSnapshot(input: {
  snapshot?: InvoiceSnapshot | null
  invoiceKind?: InvoiceKind | string | null
  invoiceStatus?: string | null
  depositDue: number
  balanceDue: number
  fullDue: number
  companyTimezone?: string | null
  now?: Date
}) {
  return resolvePaymentPurposeAvailability({
    invoiceKind: input.invoiceKind,
    invoiceStatus: input.invoiceStatus,
    depositDue: input.depositDue,
    balanceDue: input.balanceDue,
    fullDue: input.fullDue,
    eventDate: input.snapshot?.event?.date ?? null,
    eventStartTime: input.snapshot?.event?.startTime ?? null,
    companyTimezone: input.companyTimezone,
    now: input.now,
  })
}

export function paymentAvailabilityApiFields(availability: PaymentPurposeAvailability) {
  return {
    deposit_available: availability.depositAvailable,
    balance_available: availability.balanceAvailable,
    full_available: availability.fullAvailable,
    balance_available_at: availability.balanceAvailableAt,
    balance_lock_reason: availability.reason,
  }
}

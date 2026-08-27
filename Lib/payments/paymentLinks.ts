import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { PaymentPurpose } from './types'

export function createPaymentLinkToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashPaymentLinkToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function paymentTokensEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function isPaymentLinkUsable(input: {
  revokedAt?: string | null
  expiresAt?: string | null
  now?: Date
}): { ok: boolean; reason: 'ok' | 'revoked' | 'expired' } {
  if (input.revokedAt) return { ok: false, reason: 'revoked' }
  if (input.expiresAt) {
    const expires = new Date(input.expiresAt).getTime()
    const now = (input.now ?? new Date()).getTime()
    if (Number.isFinite(expires) && expires <= now) {
      return { ok: false, reason: 'expired' }
    }
  }
  return { ok: true, reason: 'ok' }
}

export function defaultPaymentLinkExpiry(from = new Date()): string {
  const expires = new Date(from)
  expires.setUTCDate(expires.getUTCDate() + 30)
  return expires.toISOString()
}

export function isPaymentPurpose(value: unknown): value is PaymentPurpose {
  return value === 'deposit' || value === 'balance' || value === 'full'
}

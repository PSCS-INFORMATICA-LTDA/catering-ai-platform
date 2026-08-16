/** Digits only — removes spaces, parentheses, dashes and plus signs. */
export function normalizePhone(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/[^\d]/g, '')
}

/** E.164 digits (DDI + national). Strips leading 00 international prefix. */
export function toE164Digits(value: string | null | undefined): string {
  let digits = normalizePhone(value)
  if (digits.startsWith('00')) digits = digits.slice(2)
  return digits
}

function isBrazilWithDdi(digits: string): boolean {
  return /^55[1-9]\d{9,10}$/.test(digits)
}

function isNanpWithDdi(digits: string): boolean {
  return /^1[2-9]\d{2}[2-9]\d{6}$/.test(digits)
}

/** BR mobile without country code, e.g. 11983481803. */
function isBrazilLocalMobile(digits: string): boolean {
  return /^[1-9]\d9\d{8}$/.test(digits)
}

/**
 * Requires country code (DDI).
 * Accepts +5511983481803 / 5511983481803 / +1 407 555 1234.
 * Rejects local 11983481803 and 10-digit US numbers.
 */
export function isUsablePhone(value: string | null | undefined): boolean {
  if (!value?.trim()) return false
  const digits = toE164Digits(value)
  if (isBrazilLocalMobile(digits)) return false
  if (digits.length < 11 || digits.length > 15) return false
  if (isBrazilWithDdi(digits) || isNanpWithDdi(digits)) return true
  const explicitDdi =
    value.trim().startsWith('+') || value.trim().startsWith('00')
  return explicitDdi && digits.length >= 11
}

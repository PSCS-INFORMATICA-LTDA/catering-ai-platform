import { isUsablePhone, toE164Digits } from '../normalizePhone.ts'

export const PUBLIC_PHONE_EXAMPLE = '+1 407 555 0123'
const NANP_E164 = /^1[2-9]\d{2}[2-9]\d{6}$/
const BRAZIL_E164 = /^55[1-9]\d{9,10}$/

/**
 * The public field starts empty. `+1` is only a placeholder example, never a
 * stored value, so the customer can type any country code.
 */
export function getPublicPhoneDefault(): string {
  return ''
}

/** Keeps digits and separators, and allows a single leading `+`. */
function sanitizePhoneInput(raw: string): string {
  const cleaned = raw.replace(/[^\d+\s()-]/g, '')
  const leadingPlus = cleaned.trimStart().startsWith('+')
  const withoutPlus = cleaned.replace(/\+/g, '')
  return leadingPlus ? `+${withoutPlus}` : withoutPlus
}

export function hasExplicitCountryCode(raw: string): boolean {
  const trimmed = sanitizePhoneInput(raw).trim()
  return trimmed.startsWith('+') || /^00\d/.test(trimmed)
}

function formatNanpDisplay(e164Digits: string): string {
  const national = e164Digits.slice(1, 11)
  const area = national.slice(0, 3)
  const prefix = national.slice(3, 6)
  const line = national.slice(6, 10)
  if (!area) return '+1'
  if (national.length <= 3) return `+1 (${area}`
  if (national.length <= 6) return `+1 (${area}) ${prefix}`
  return `+1 (${area}) ${prefix}-${line}`
}

function formatBrazilDisplay(e164Digits: string): string {
  const rest = e164Digits.slice(2)
  const area = rest.slice(0, 2)
  const subscriber = rest.slice(2)
  if (!area) return '+55'
  if (subscriber.length <= 4) return `+55 ${area} ${subscriber}`.trim()
  return `+55 ${area} ${subscriber.slice(0, -4)}-${subscriber.slice(-4)}`
}

/**
 * Visual mask for the public intake field. It never injects a country code:
 * an empty field stays empty and the code the customer typed is preserved.
 */
export function formatPublicPhoneInput(raw: string): string {
  const trimmed = sanitizePhoneInput(raw).trim()
  if (!trimmed) return ''
  if (trimmed === '+') return '+'
  if (/^00\d/.test(trimmed)) {
    return formatPublicPhoneInput(`+${trimmed.slice(2)}`)
  }
  if (!trimmed.startsWith('+')) return trimmed

  const digits = toE164Digits(trimmed).slice(0, 15)
  if (!digits) return '+'
  if (digits.startsWith('1')) return formatNanpDisplay(digits)
  if (digits.startsWith('55')) return formatBrazilDisplay(digits)
  return `+${digits}`
}

/**
 * E.164 for persistence. A number typed without any country code is only
 * accepted when it is a valid 10-digit US/NANP number, matching the pilot
 * operation; anything else must carry an explicit country code.
 */
export function toPublicPhoneE164(raw: string): string | null {
  const trimmed = sanitizePhoneInput(raw).trim()
  if (!trimmed) return null
  const digits = toE164Digits(trimmed)
  if (!digits) return null

  if (hasExplicitCountryCode(trimmed)) {
    if (digits.length < 8 || digits.length > 15) return null
    if (
      NANP_E164.test(digits) ||
      BRAZIL_E164.test(digits) ||
      isUsablePhone(`+${digits}`)
    ) {
      return `+${digits}`
    }
    return digits.length >= 11 ? `+${digits}` : null
  }

  const nanp = digits.length === 10 ? `1${digits}` : digits
  return NANP_E164.test(nanp) ? `+${nanp}` : null
}

export function isUsablePublicPhone(raw: string): boolean {
  return toPublicPhoneE164(raw) != null
}

export function displayPublicPhone(raw: string | null | undefined): string {
  if (!raw?.trim()) return ''
  return formatPublicPhoneInput(raw)
}

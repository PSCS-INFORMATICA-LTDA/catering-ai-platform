import {
  isUsablePhone,
  toE164Digits,
} from '../normalizePhone'

export const PUBLIC_PHONE_US_PREFIX = '+1'
const NANP_E164 = /^1[2-9]\d{2}[2-9]\d{6}$/
const BRAZIL_E164 = /^55[1-9]\d{9,10}$/

export function getPublicPhoneDefault(): string {
  return `${PUBLIC_PHONE_US_PREFIX} `
}

export function hasExplicitNonUsCountryCode(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('00')) {
    const digits = toE164Digits(trimmed)
    return digits.length >= 2 && !digits.startsWith('1')
  }
  if (!trimmed.startsWith('+')) return false
  if (trimmed === '+' || trimmed === '+1' || trimmed.startsWith('+1')) return false
  return true
}

function formatNanpDisplay(nationalDigits: string): string {
  const limited = nationalDigits.slice(0, 10)
  const area = limited.slice(0, 3)
  const prefix = limited.slice(3, 6)
  const line = limited.slice(6, 10)
  if (!area) return `${PUBLIC_PHONE_US_PREFIX} `
  if (limited.length <= 3) return `${PUBLIC_PHONE_US_PREFIX} (${area}`
  if (limited.length <= 6) return `${PUBLIC_PHONE_US_PREFIX} (${area}) ${prefix}`
  return `${PUBLIC_PHONE_US_PREFIX} (${area}) ${prefix}-${line}`
}

function formatInternationalDisplay(raw: string): string {
  const trimmed = raw.trim().replace(/^00/, '+')
  const plus = trimmed.startsWith('+') ? '+' : '+'
  const digits = toE164Digits(trimmed).slice(0, 15)
  if (!digits) return plus
  if (digits.startsWith('55') && digits.length >= 4) {
    const rest = digits.slice(2)
    const area = rest.slice(0, 2)
    const subscriber = rest.slice(2)
    if (subscriber.length <= 4) return `+55 ${area} ${subscriber}`.trim()
    return `+55 ${area} ${subscriber.slice(0, subscriber.length - 4)}-${subscriber.slice(-4)}`
  }
  return `${plus}${digits}`
}

/**
 * Visual mask for the public intake field.
 * Defaults to US / +1. If the user types another country code (+55, +34, +44…),
 * that code is preserved. Language must not change the calling code.
 */
export function formatPublicPhoneInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '+' || trimmed === PUBLIC_PHONE_US_PREFIX) {
    return getPublicPhoneDefault()
  }

  if (hasExplicitNonUsCountryCode(trimmed)) {
    return formatInternationalDisplay(trimmed)
  }

  const digits = toE164Digits(trimmed)
  const national = digits.startsWith('1') ? digits.slice(1) : digits
  return formatNanpDisplay(national)
}

export function toPublicPhoneE164(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (hasExplicitNonUsCountryCode(trimmed)) {
    const digits = toE164Digits(trimmed)
    if (digits.length < 8 || digits.length > 15) return null
    if (BRAZIL_E164.test(digits) || isUsablePhone(`+${digits}`)) {
      return `+${digits}`
    }
    return digits.length >= 11 ? `+${digits}` : null
  }

  const digits = toE164Digits(trimmed)
  const nanp = digits.startsWith('1') ? digits : `1${digits}`
  if (NANP_E164.test(nanp)) return `+${nanp}`
  return null
}

export function isUsablePublicPhone(raw: string): boolean {
  return toPublicPhoneE164(raw) != null
}

export function displayPublicPhone(raw: string | null | undefined): string {
  if (!raw?.trim()) return getPublicPhoneDefault()
  return formatPublicPhoneInput(raw)
}

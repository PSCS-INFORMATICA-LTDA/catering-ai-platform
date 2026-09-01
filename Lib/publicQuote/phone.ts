import { isUsablePhone, toE164Digits } from '../normalizePhone.ts'
import {
  countriesForCallingCode,
  getPhoneCountry,
  matchCallingCode,
  type PhoneCountry,
} from './phoneCountries.ts'

export const PUBLIC_PHONE_EXAMPLE = '+1 407 555 1234'

export type PublicPhoneParts = {
  iso2: string | null
  callingCode: string
  nationalDigits: string
}
const NANP_E164 = /^1[2-9]\d{2}[2-9]\d{6}$/
const BRAZIL_E164 = /^55[1-9]\d{9,10}$/

/**
 * The public field starts empty. `+1` is only a placeholder example, never a
 * stored value, so the customer can type any country code.
 */
export function getPublicPhoneDefault(): string {
  return ''
}

/**
 * Keeps digits and separators, and allows a single leading `+`. A `+` typed
 * after other characters means the customer is restarting with another country
 * code, so everything before it is dropped instead of being merged.
 */
function sanitizePhoneInput(raw: string): string {
  const cleaned = raw.replace(/[^\d+\s()-]/g, '')
  const lastPlus = cleaned.lastIndexOf('+')
  const fromLastPlus = lastPlus > 0 ? cleaned.slice(lastPlus) : cleaned
  const leadingPlus = fromLastPlus.trimStart().startsWith('+')
  const withoutPlus = fromLastPlus.replace(/\+/g, '')
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

/**
 * Drafts saved before the field started empty can hold a bare country code
 * such as `+1 `. Restoring that would put the customer back in the state where
 * the prefix cannot be erased naturally, so it is treated as empty.
 */
export function sanitizeStoredPublicPhone(
  value: string | null | undefined,
): string {
  const trimmed = value?.trim()
  if (!trimmed) return ''
  return toE164Digits(trimmed).length < 4 ? '' : trimmed
}

export function nationalDigitsOnly(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 15)
}

export function stripCallingCodeFromNational(
  country: PhoneCountry,
  raw: string,
): string {
  let digits = nationalDigitsOnly(raw)
  if (!digits) return ''
  const code = country.callingCode
  if (digits.startsWith(code) && digits.length > code.length + 3) {
    digits = digits.slice(code.length)
  }
  return digits
}

export function composePublicPhoneE164(
  iso2: string | null | undefined,
  nationalRaw: string | null | undefined,
): string | null {
  const country = getPhoneCountry(iso2)
  if (!country) return null
  const national = stripCallingCodeFromNational(country, String(nationalRaw ?? ''))
  if (!national) return null
  return toPublicPhoneE164(`+${country.callingCode}${national}`)
}

export function splitPublicPhone(
  raw: string | null | undefined,
  preferredIso2?: string | null,
): PublicPhoneParts {
  const preferred = getPhoneCountry(preferredIso2)
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) {
    return {
      iso2: preferred?.iso2 ?? null,
      callingCode: preferred?.callingCode ?? '',
      nationalDigits: '',
    }
  }

  const digits = toE164Digits(trimmed)
  if (!digits) {
    return {
      iso2: preferred?.iso2 ?? null,
      callingCode: preferred?.callingCode ?? '',
      nationalDigits: nationalDigitsOnly(trimmed),
    }
  }

  const explicit = hasExplicitCountryCode(trimmed)
  if (!explicit && preferred && digits.length <= 11) {
    const national = stripCallingCodeFromNational(preferred, digits)
    return {
      iso2: preferred.iso2,
      callingCode: preferred.callingCode,
      nationalDigits: national,
    }
  }

  const code = matchCallingCode(digits)
  if (!code) {
    return {
      iso2: preferred?.iso2 ?? null,
      callingCode: preferred?.callingCode ?? '',
      nationalDigits: digits,
    }
  }

  const matches = countriesForCallingCode(code)
  const chosen =
    (preferred && matches.find((row) => row.iso2 === preferred.iso2)) ||
    matches[0] ||
    null
  return {
    iso2: chosen?.iso2 ?? null,
    callingCode: code,
    nationalDigits: digits.slice(code.length),
  }
}

export function formatNationalPhoneDisplay(
  iso2: string | null | undefined,
  nationalRaw: string,
): string {
  const digits = nationalDigitsOnly(nationalRaw)
  if (!digits) return ''
  const country = getPhoneCountry(iso2)
  if (country?.iso2 === 'US' || country?.iso2 === 'CA' || country?.iso2 === 'PR') {
    const area = digits.slice(0, 3)
    const prefix = digits.slice(3, 6)
    const line = digits.slice(6, 10)
    if (digits.length <= 3) return area
    if (digits.length <= 6) return `(${area}) ${prefix}`
    return `(${area}) ${prefix}-${line}`
  }
  if (country?.iso2 === 'BR') {
    const area = digits.slice(0, 2)
    const rest = digits.slice(2)
    if (!area) return digits
    if (rest.length <= 4) return `${area} ${rest}`.trim()
    return `${area} ${rest.slice(0, -4)}-${rest.slice(-4)}`
  }
  return digits
}

const NANP_AREA_ISO2 = new Set(['US', 'CA', 'PR', 'DO'])

export function getPublicPhoneAreaHintLength(
  iso2: string | null | undefined,
): number | null {
  const country = getPhoneCountry(iso2)
  if (!country) return null
  if (country.iso2 === 'BR') return 2
  if (NANP_AREA_ISO2.has(country.iso2)) return 3
  return null
}

export function splitNationalIntoAreaAndSubscriber(
  iso2: string | null | undefined,
  nationalRaw: string | null | undefined,
): { areaCode: string; subscriberNumber: string } {
  const digits = nationalDigitsOnly(nationalRaw)
  const areaLen = getPublicPhoneAreaHintLength(iso2)
  if (areaLen && digits.length >= areaLen) {
    return {
      areaCode: digits.slice(0, areaLen),
      subscriberNumber: digits.slice(areaLen),
    }
  }
  if (areaLen) {
    return { areaCode: digits, subscriberNumber: '' }
  }
  return { areaCode: '', subscriberNumber: digits }
}

export function composeNationalFromAreaAndSubscriber(
  areaCode: string | null | undefined,
  subscriberNumber: string | null | undefined,
): string {
  return `${nationalDigitsOnly(areaCode)}${nationalDigitsOnly(subscriberNumber)}`
}

export function formatSubscriberPhoneDisplay(
  iso2: string | null | undefined,
  subscriberRaw: string | null | undefined,
): string {
  const digits = nationalDigitsOnly(subscriberRaw)
  if (!digits) return ''
  const country = getPhoneCountry(iso2)
  if (country?.iso2 === 'BR') {
    if (digits.length <= 4) return digits
    return `${digits.slice(0, -4)}-${digits.slice(-4)}`
  }
  if (country && NANP_AREA_ISO2.has(country.iso2)) {
    if (digits.length <= 3) return digits
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}`
  }
  return digits
}

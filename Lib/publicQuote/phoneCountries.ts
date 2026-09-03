import type { QuoteLanguage } from '../quoteWizardTypes.ts'

export type PhoneCountry = {
  iso2: string
  callingCode: string
  names: Record<QuoteLanguage, string>
}

/**
 * Compact calling-code catalog for the public phone selector.
 * Identity is ISO 3166-1 alpha-2 — never UI locale.
 */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { iso2: 'US', callingCode: '1', names: { pt: 'Estados Unidos', en: 'United States', es: 'Estados Unidos' } },
  { iso2: 'CA', callingCode: '1', names: { pt: 'Canadá', en: 'Canada', es: 'Canadá' } },
  { iso2: 'BR', callingCode: '55', names: { pt: 'Brasil', en: 'Brazil', es: 'Brasil' } },
  { iso2: 'MX', callingCode: '52', names: { pt: 'México', en: 'Mexico', es: 'México' } },
  { iso2: 'AR', callingCode: '54', names: { pt: 'Argentina', en: 'Argentina', es: 'Argentina' } },
  { iso2: 'CL', callingCode: '56', names: { pt: 'Chile', en: 'Chile', es: 'Chile' } },
  { iso2: 'CO', callingCode: '57', names: { pt: 'Colômbia', en: 'Colombia', es: 'Colombia' } },
  { iso2: 'PE', callingCode: '51', names: { pt: 'Peru', en: 'Peru', es: 'Perú' } },
  { iso2: 'UY', callingCode: '598', names: { pt: 'Uruguai', en: 'Uruguay', es: 'Uruguay' } },
  { iso2: 'PY', callingCode: '595', names: { pt: 'Paraguai', en: 'Paraguay', es: 'Paraguay' } },
  { iso2: 'BO', callingCode: '591', names: { pt: 'Bolívia', en: 'Bolivia', es: 'Bolivia' } },
  { iso2: 'EC', callingCode: '593', names: { pt: 'Equador', en: 'Ecuador', es: 'Ecuador' } },
  { iso2: 'VE', callingCode: '58', names: { pt: 'Venezuela', en: 'Venezuela', es: 'Venezuela' } },
  { iso2: 'PT', callingCode: '351', names: { pt: 'Portugal', en: 'Portugal', es: 'Portugal' } },
  { iso2: 'ES', callingCode: '34', names: { pt: 'Espanha', en: 'Spain', es: 'España' } },
  { iso2: 'GB', callingCode: '44', names: { pt: 'Reino Unido', en: 'United Kingdom', es: 'Reino Unido' } },
  { iso2: 'FR', callingCode: '33', names: { pt: 'França', en: 'France', es: 'Francia' } },
  { iso2: 'DE', callingCode: '49', names: { pt: 'Alemanha', en: 'Germany', es: 'Alemania' } },
  { iso2: 'IT', callingCode: '39', names: { pt: 'Itália', en: 'Italy', es: 'Italia' } },
  { iso2: 'IE', callingCode: '353', names: { pt: 'Irlanda', en: 'Ireland', es: 'Irlanda' } },
  { iso2: 'AU', callingCode: '61', names: { pt: 'Austrália', en: 'Australia', es: 'Australia' } },
  { iso2: 'NZ', callingCode: '64', names: { pt: 'Nova Zelândia', en: 'New Zealand', es: 'Nueva Zelanda' } },
  { iso2: 'JP', callingCode: '81', names: { pt: 'Japão', en: 'Japan', es: 'Japón' } },
  { iso2: 'KR', callingCode: '82', names: { pt: 'Coreia do Sul', en: 'South Korea', es: 'Corea del Sur' } },
  { iso2: 'CN', callingCode: '86', names: { pt: 'China', en: 'China', es: 'China' } },
  { iso2: 'IN', callingCode: '91', names: { pt: 'Índia', en: 'India', es: 'India' } },
  { iso2: 'ZA', callingCode: '27', names: { pt: 'África do Sul', en: 'South Africa', es: 'Sudáfrica' } },
  { iso2: 'IL', callingCode: '972', names: { pt: 'Israel', en: 'Israel', es: 'Israel' } },
  { iso2: 'AE', callingCode: '971', names: { pt: 'Emirados Árabes', en: 'United Arab Emirates', es: 'Emiratos Árabes' } },
  { iso2: 'DO', callingCode: '1', names: { pt: 'República Dominicana', en: 'Dominican Republic', es: 'República Dominicana' } },
  { iso2: 'PR', callingCode: '1', names: { pt: 'Porto Rico', en: 'Puerto Rico', es: 'Puerto Rico' } },
  { iso2: 'CR', callingCode: '506', names: { pt: 'Costa Rica', en: 'Costa Rica', es: 'Costa Rica' } },
  { iso2: 'PA', callingCode: '507', names: { pt: 'Panamá', en: 'Panama', es: 'Panamá' } },
  { iso2: 'GT', callingCode: '502', names: { pt: 'Guatemala', en: 'Guatemala', es: 'Guatemala' } },
  { iso2: 'HN', callingCode: '504', names: { pt: 'Honduras', en: 'Honduras', es: 'Honduras' } },
  { iso2: 'SV', callingCode: '503', names: { pt: 'El Salvador', en: 'El Salvador', es: 'El Salvador' } },
  { iso2: 'NI', callingCode: '505', names: { pt: 'Nicarágua', en: 'Nicaragua', es: 'Nicaragua' } },
  { iso2: 'CU', callingCode: '53', names: { pt: 'Cuba', en: 'Cuba', es: 'Cuba' } },
]

const BY_ISO2 = new Map(PHONE_COUNTRIES.map((row) => [row.iso2, row]))

const CALLING_CODES_DESC = [...new Set(PHONE_COUNTRIES.map((row) => row.callingCode))]
  .sort((a, b) => b.length - a.length)

export function normalizeCountryIso2(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim().toUpperCase()
  if (!raw) return null
  if (raw === 'USA') return 'US'
  if (raw === 'UK' || raw === 'GBR') return 'GB'
  if (raw === 'BRA') return 'BR'
  if (/^[A-Z]{2}$/.test(raw)) return raw
  return null
}

export function getPhoneCountry(iso2: string | null | undefined): PhoneCountry | null {
  const key = normalizeCountryIso2(iso2)
  return key ? BY_ISO2.get(key) ?? null : null
}

export function countryFlagEmoji(iso2: string): string {
  const key = normalizeCountryIso2(iso2)
  if (!key) return ''
  const chars = [...key].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)
  return String.fromCodePoint(...chars)
}

export function getPhoneCountryLabel(
  country: PhoneCountry,
  language: QuoteLanguage,
): string {
  return country.names[language] || country.names.en
}

export function filterPhoneCountries(
  query: string,
  language: QuoteLanguage,
): PhoneCountry[] {
  const needle = query.trim().toLocaleLowerCase(language === 'pt' ? 'pt-BR' : language)
  if (!needle) return [...PHONE_COUNTRIES]
  const digits = needle.replace(/\D/g, '')
  return PHONE_COUNTRIES.filter((country) => {
    const name = getPhoneCountryLabel(country, language).toLocaleLowerCase(
      language === 'pt' ? 'pt-BR' : language,
    )
    return (
      name.includes(needle) ||
      country.iso2.toLowerCase().includes(needle) ||
      (digits.length > 0 && country.callingCode.includes(digits)) ||
      `+${country.callingCode}`.includes(needle)
    )
  })
}

/**
 * Company/branch country wins. UI locale never selects the calling code.
 */
export function resolveDefaultPhoneCountryIso2(input: {
  allowedCountries?: ReadonlyArray<string> | null
  branchCountry?: string | null
}): string | null {
  const allowed = (input.allowedCountries ?? [])
    .map((value) => normalizeCountryIso2(value))
    .filter((value): value is string => Boolean(value && BY_ISO2.has(value)))
  if (allowed.length === 1) return allowed[0]

  const branch = normalizeCountryIso2(input.branchCountry)
  if (branch && BY_ISO2.has(branch) && (allowed.length === 0 || allowed.includes(branch))) {
    return branch
  }
  return allowed[0] ?? null
}

export function matchCallingCode(digits: string): string | null {
  for (const code of CALLING_CODES_DESC) {
    if (digits.startsWith(code)) return code
  }
  return null
}

export function countriesForCallingCode(code: string): PhoneCountry[] {
  return PHONE_COUNTRIES.filter((row) => row.callingCode === code)
}

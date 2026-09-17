import type { Company } from '@/Lib/tenant/types'

export type CompanyBrand = {
  companyId: string
  displayName: string
  logoUrl: string | null
  initials: string
}

const LOGO_FIELD_KEYS = [
  'logo_url',
  'logoUrl',
  'brand_logo_url',
  'brandLogoUrl',
  'image_url',
  'imageUrl',
  'company_logo',
  'logo',
  'avatar_url',
  'avatarUrl',
] as const

function pickStringField(
  record: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): string | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return null
}

export function resolveCompanyDisplayName(
  company: Company | null,
  companyId?: string,
): string {
  const record = company as Record<string, unknown> | null
  const name =
    pickStringField(record, ['trade_name', 'tradeName']) ||
    pickStringField(record, ['company_name', 'companyName']) ||
    pickStringField(record, ['legal_name', 'legalName'])
  if (name) return name
  void companyId
  return 'Catering Help'
}

export function resolveCompanyLogoUrl(
  company: Company | null,
  companyId?: string,
): string | null {
  const record = company as Record<string, unknown> | null
  const fromCompany = pickStringField(record, LOGO_FIELD_KEYS)
  if (fromCompany) return fromCompany

  const fromEnv =
    process.env.NEXT_PUBLIC_COMPANY_LOGO_URL?.trim() ||
    process.env.NEXT_PUBLIC_TENANT_LOGO_URL?.trim() ||
    process.env.NEXT_PUBLIC_CDL_LOGO_URL?.trim() ||
    null
  if (fromEnv) return fromEnv
  void companyId
  return null
}

export function resolveCompanyInitials(
  company: Company | null,
  displayName?: string,
  companyId?: string,
): string {
  void companyId
  const record = company as Record<string, unknown> | null
  const code =
    pickStringField(record, ['company_code', 'companyCode']) ||
    company?.company_code?.trim()
  if (code) return code.slice(0, 4).toUpperCase()

  const name = displayName ?? resolveCompanyDisplayName(company)
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0]!.slice(0, 3).toUpperCase()

  const firstWord = words[0]!
  if (firstWord.length <= 4 && /^[A-Z0-9]+$/i.test(firstWord)) {
    return firstWord.slice(0, 4).toUpperCase()
  }

  return words
    .slice(0, 3)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()
}

export function resolveCompanyBrand(
  companyId: string,
  company: Company | null,
): CompanyBrand {
  const displayName = resolveCompanyDisplayName(company, companyId)
  const logoUrl = resolveCompanyLogoUrl(company, companyId)

  if (process.env.NODE_ENV === 'development') {
    console.log('Help tenant/company logo:', {
      companyId,
      company,
      resolvedLogoUrl: logoUrl,
      displayName,
    })
  }

  return {
    companyId,
    displayName,
    logoUrl,
    initials: resolveCompanyInitials(company, displayName, companyId),
  }
}

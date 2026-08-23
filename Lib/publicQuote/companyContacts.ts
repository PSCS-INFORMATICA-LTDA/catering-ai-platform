export type PublicSupportContacts = {
  phone?: string | null
  whatsappUrl?: string | null
  instagramUrl?: string | null
  instagramHandle?: string | null
}

export type PublicCompanyContacts = {
  phone: string | null
  whatsappUrl: string | null
  instagramUrl: string | null
  instagramHandle: string | null
}

/**
 * Tenant-specific public handles used only when company settings do not
 * provide them. Keep this map empty rather than inventing a profile.
 */
const COMPANY_CONTACT_FALLBACKS: Record<string, Partial<PublicCompanyContacts>> = {
  cdl: {
    instagramUrl: 'https://www.instagram.com/cdl.bbq/',
    instagramHandle: '@cdl.bbq',
  },
}

function clean(value?: string | null) {
  const trimmed = value?.trim() ?? ''
  return trimmed || null
}

export function resolvePublicCompanyContacts(
  support: PublicSupportContacts | null | undefined,
  companySlug?: string | null,
): PublicCompanyContacts {
  const fallback = COMPANY_CONTACT_FALLBACKS[companySlug?.trim() || ''] ?? {}
  return {
    phone: clean(support?.phone) ?? clean(fallback.phone),
    whatsappUrl: clean(support?.whatsappUrl) ?? clean(fallback.whatsappUrl),
    instagramUrl: clean(support?.instagramUrl) ?? clean(fallback.instagramUrl),
    instagramHandle:
      clean(support?.instagramHandle) ?? clean(fallback.instagramHandle),
  }
}

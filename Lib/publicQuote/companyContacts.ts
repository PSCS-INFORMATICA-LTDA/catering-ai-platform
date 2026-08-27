export type PublicSupportContacts = {
  phone?: string | null
  whatsappUrl?: string | null
  instagramUrl?: string | null
  instagramHandle?: string | null
  email?: string | null
}

export type PublicCompanyContacts = {
  phone: string | null
  whatsappUrl: string | null
  instagramUrl: string | null
  instagramHandle: string | null
  email: string | null
}

/**
 * Tenant-specific public handles used only when company settings do not
 * provide them. Keep this map empty rather than inventing a profile.
 */
const COMPANY_CONTACT_FALLBACKS: Record<string, Partial<PublicCompanyContacts>> = {
  cdl: {
    phone: '+14079152242',
    email: 'cdlbbqatendimento@gmail.com',
    instagramUrl: 'https://www.instagram.com/cdl.bbq/',
    instagramHandle: '@cdl.bbq',
  },
}

function clean(value?: string | null) {
  const trimmed = value?.trim() ?? ''
  return trimmed || null
}

export function publicWhatsAppHrefFromPhone(phone?: string | null) {
  const digits = phone?.replace(/\D/g, '') ?? ''
  return digits.length >= 10 ? `https://wa.me/${digits}` : null
}

export function resolvePublicCompanyContacts(
  support: PublicSupportContacts | null | undefined,
  companySlug?: string | null,
): PublicCompanyContacts {
  const fallback = COMPANY_CONTACT_FALLBACKS[companySlug?.trim() || ''] ?? {}
  const phone = clean(support?.phone) ?? clean(fallback.phone)
  return {
    phone,
    email: clean(support?.email) ?? clean(fallback.email),
    whatsappUrl:
      clean(support?.whatsappUrl) ??
      clean(fallback.whatsappUrl) ??
      publicWhatsAppHrefFromPhone(phone),
    instagramUrl: clean(support?.instagramUrl) ?? clean(fallback.instagramUrl),
    instagramHandle:
      clean(support?.instagramHandle) ?? clean(fallback.instagramHandle),
  }
}

import {
  PACKAGE_FOLDER_ART_V2,
  PACKAGE_FOLDER_BUCKET,
  PACKAGE_FOLDER_PREFIX,
} from '@/Lib/publicQuote/packageFolderArt.generated'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

export const PACKAGE_FOLDER_DRAFT_PREFIX = 'cdl-folders-v3-drafts'

export type PackageFolderVariant = 'with_sides' | 'without_sides'
export type PackageFolderLocale = 'pt' | 'en' | 'es'

export type PackageFolderFamily = {
  familyKey: string
  namePt: string
  nameEn: string
  nameEs: string
}

export const PACKAGE_FOLDER_FAMILIES: readonly PackageFolderFamily[] = [
  {
    familyKey: 'BBQTRAD',
    namePt: 'BBQ TRADICIONAL',
    nameEn: 'BBQ TRADITIONAL',
    nameEs: 'BBQ TRADICIONAL',
  },
  {
    familyKey: 'BBQSEL',
    namePt: 'BBQ SELECT',
    nameEn: 'BBQ SELECT',
    nameEs: 'BBQ SELECT',
  },
  {
    familyKey: 'BBQCHO',
    namePt: 'BBQ CHOICE',
    nameEn: 'BBQ CHOICE',
    nameEs: 'BBQ CHOICE',
  },
  {
    familyKey: 'BBQPRI',
    namePt: 'BBQ PRIME',
    nameEn: 'BBQ PRIME',
    nameEs: 'BBQ PRIME',
  },
  {
    familyKey: 'BBQPERS',
    namePt: 'BBQ PERSONALIZADO',
    nameEn: 'BBQ CUSTOM',
    nameEs: 'BBQ PERSONALIZADO',
  },
] as const

const VARIANT_LABELS: Record<
  PackageFolderLocale,
  Record<PackageFolderVariant, string>
> = {
  pt: { with_sides: 'COM GUARNIÇÕES', without_sides: 'SEM GUARNIÇÕES' },
  en: { with_sides: 'WITH SIDES', without_sides: 'WITHOUT SIDES' },
  es: { with_sides: 'CON ACOMPAÑAMIENTOS', without_sides: 'SIN ACOMPAÑAMIENTOS' },
}

export function packageKeyForVariant(
  familyKey: string,
  variant: PackageFolderVariant,
) {
  return variant === 'with_sides' ? `${familyKey}+` : familyKey
}

export function variantFromPackageKey(packageKey: string): PackageFolderVariant {
  return packageKey.trim().toUpperCase().endsWith('+')
    ? 'with_sides'
    : 'without_sides'
}

export function familyFromPackageKey(packageKey: string) {
  return packageKey.trim().toUpperCase().replace(/\+$/, '')
}

export function slotKey(packageKey: string, locale: PackageFolderLocale) {
  return `${packageKey.trim().toUpperCase()}__${locale}`
}

export function parseSlotKey(
  value: string,
): { packageKey: string; locale: PackageFolderLocale } | null {
  const [packageKey, locale] = value.split('__')
  if (!packageKey || (locale !== 'pt' && locale !== 'en' && locale !== 'es')) {
    return null
  }
  return { packageKey: packageKey.toUpperCase(), locale }
}

export function variantLabel(
  locale: PackageFolderLocale,
  variant: PackageFolderVariant,
) {
  return VARIANT_LABELS[locale][variant]
}

export function familyName(familyKey: string, language: QuoteLanguage) {
  const family = PACKAGE_FOLDER_FAMILIES.find((item) => item.familyKey === familyKey)
  if (!family) return familyKey
  if (language === 'en') return family.nameEn
  if (language === 'es') return family.nameEs
  return family.namePt
}

export function publishedFolderUrl(fileName: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!base || !fileName) return null
  const url = `${base}/storage/v1/object/public/${PACKAGE_FOLDER_BUCKET}/${PACKAGE_FOLDER_PREFIX}/${fileName}`
  if (fileName.endsWith('-v9.webp')) return `${url}?v=art9`
  if (fileName.endsWith('-v8.webp')) return `${url}?v=art8b`
  if (fileName.endsWith('-v7.webp')) return `${url}?v=art7`
  if (fileName.endsWith('-v6.webp')) return `${url}?v=art6b`
  if (fileName.endsWith('-v5.webp')) return `${url}?v=art5`
  if (fileName.endsWith('-v4.webp')) return `${url}?v=art4`
  return url
}

export type PackageFolderSlot = {
  slotKey: string
  familyKey: string
  packageKey: string
  packageName: string
  locale: PackageFolderLocale
  variant: PackageFolderVariant
  variantLabel: string
  fileName: string | null
  publishedUrl: string | null
  usedIn: string
  status: 'published' | 'missing'
}

export function listPackageFolderSlots(language: QuoteLanguage = 'pt') {
  const locales: PackageFolderLocale[] = ['pt', 'en', 'es']
  const variants: PackageFolderVariant[] = ['with_sides', 'without_sides']
  const slots: PackageFolderSlot[] = []
  for (const family of PACKAGE_FOLDER_FAMILIES) {
    for (const variant of variants) {
      const packageKey = packageKeyForVariant(family.familyKey, variant)
      for (const locale of locales) {
        const fileName = PACKAGE_FOLDER_ART_V2[packageKey]?.[locale] ?? null
        const usedIn = `${familyName(family.familyKey, language)} / ${locale.toUpperCase()} / ${variantLabel(locale, variant)}`
        slots.push({
          slotKey: slotKey(packageKey, locale),
          familyKey: family.familyKey,
          packageKey,
          packageName: familyName(family.familyKey, language),
          locale,
          variant,
          variantLabel: variantLabel(locale, variant),
          fileName,
          publishedUrl: fileName ? publishedFolderUrl(fileName) : null,
          usedIn,
          status: fileName ? 'published' : 'missing',
        })
      }
    }
  }
  return slots
}

export function mappedFolderFileNames() {
  return new Set(
    Object.values(PACKAGE_FOLDER_ART_V2).flatMap((byLocale) =>
      Object.values(byLocale).filter((name): name is string => Boolean(name)),
    ),
  )
}

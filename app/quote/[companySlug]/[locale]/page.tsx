import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublicQuoteBootstrap } from '@/Lib/publicQuote/bootstrap'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import PublicQuoteExperience, {
  type PublicQuotePageBootstrap,
} from './PublicQuoteExperience'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function parseLocale(value: string): QuoteLanguage | null {
  const normalized = value.trim().toLowerCase()
  return normalized === 'pt' || normalized === 'en' || normalized === 'es'
    ? normalized
    : null
}

async function resolvePageBootstrap(
  companySlug: string,
  localeValue: string,
): Promise<{
  locale: QuoteLanguage
  bootstrap: PublicQuotePageBootstrap
} | null> {
  const locale = parseLocale(localeValue)
  if (!locale) return null
  const bootstrap = await getPublicQuoteBootstrap(companySlug, locale)
  if (!bootstrap || !bootstrap.settings.enabled) return null
  if (!bootstrap.settings.allowedLocales.includes(locale)) return null
  return { locale, bootstrap }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ companySlug: string; locale: string }>
}): Promise<Metadata> {
  const { companySlug, locale: localeValue } = await params
  const resolved = await resolvePageBootstrap(companySlug, localeValue)
  if (!resolved) {
    return {
      title: 'Quote unavailable',
      robots: { index: false, follow: false },
    }
  }

  const { bootstrap } = resolved
  const title = `${bootstrap.settings.landing.title} · ${bootstrap.company.name}`
  const description = bootstrap.settings.landing.subtitle
  const image =
    bootstrap.settings.heroImageUrl || bootstrap.company.logoUrl || undefined

  return {
    title,
    description,
    alternates: {
      languages: Object.fromEntries(
        bootstrap.settings.allowedLocales.map((locale) => [
          locale,
          `/quote/${bootstrap.company.slug}/${locale}`,
        ]),
      ),
    },
    openGraph: {
      title,
      description,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
    robots: { index: true, follow: true },
  }
}

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ companySlug: string; locale: string }>
}) {
  const { companySlug, locale: localeValue } = await params
  const resolved = await resolvePageBootstrap(companySlug, localeValue)
  if (!resolved) notFound()

  return (
    <PublicQuoteExperience
      bootstrap={resolved.bootstrap}
      locale={resolved.locale}
    />
  )
}

'use client'

import Link from 'next/link'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

const LOCALE_FLAGS: Record<QuoteLanguage, string> = {
  pt: '🇧🇷',
  en: '🇺🇸',
  es: '🇪🇸',
}

const LOCALE_CODES: Record<QuoteLanguage, string> = {
  pt: 'PT',
  en: 'EN',
  es: 'ES',
}

const LOCALE_NAMES: Record<QuoteLanguage, string> = {
  pt: 'Português',
  en: 'English',
  es: 'Español',
}

export default function PublicLocaleSwitcher({
  companySlug,
  locale,
  allowedLocales,
}: {
  companySlug: string
  locale: QuoteLanguage
  allowedLocales: QuoteLanguage[]
}) {
  return (
    <nav
      className="flex shrink-0 items-center gap-1"
      aria-label="Language"
      data-public-locale-switcher
    >
      {allowedLocales.map((language) => {
        const active = language === locale
        return (
          <Link
            key={language}
            href={`/quote/${companySlug}/${language}`}
            aria-current={active ? 'page' : undefined}
            aria-label={LOCALE_NAMES[language]}
            title={LOCALE_NAMES[language]}
            data-locale={language}
            className={`inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-black uppercase tracking-wide ${
              active
                ? 'bg-[var(--brand-primary)] text-white'
                : 'text-cdl-muted hover:bg-cdl-hover'
            }`}
          >
            <span aria-hidden data-locale-flag={language}>
              {LOCALE_FLAGS[language]}
            </span>
            <span>{LOCALE_CODES[language]}</span>
          </Link>
        )
      })}
    </nav>
  )
}

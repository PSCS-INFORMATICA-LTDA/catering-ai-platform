'use client'

import CdlBrandLogo from '@/components/CdlBrandLogo'

import { getQuoteStrings } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

export default function QuoteHeaderCompact({
  isEditMode = false,
  language = 'pt',
}: {
  isEditMode?: boolean
  language?: QuoteLanguage | string | null
}) {
  const t = getQuoteStrings(
    language === 'en' || language === 'es' ? language : 'pt',
  )
  return (
    <header className="mb-3 flex max-h-20 items-center gap-3 rounded-2xl border border-cdl-border bg-cdl-surface px-3 py-2.5 shadow-sm md:hidden sm:mb-4 sm:px-4 sm:py-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-cdl-border-subtle bg-white sm:h-12 sm:w-12">
        <CdlBrandLogo
          size="sm"
          className="!h-9 !w-9 !max-h-9 !max-w-9 sm:!h-10 sm:!w-10 sm:!max-h-10 sm:!max-w-10"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold leading-tight text-cdl-title">
          {isEditMode ? t.editQuoteTitle : t.newQuoteTitle}
        </p>
        <p className="truncate text-xs text-cdl-muted">
          BBQ at Home · Orlando, Florida
        </p>
      </div>
    </header>
  )
}

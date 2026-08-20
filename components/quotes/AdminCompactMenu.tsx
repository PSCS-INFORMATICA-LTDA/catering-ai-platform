'use client'

import Link from 'next/link'
import { glassBtn } from '@/Lib/liquidGlass'
import { getQuoteStrings } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

/** CTA compacto no wizard — navegação principal fica no AppShell lateral. */
export default function AdminCompactMenu({
  language = 'pt',
}: {
  language?: QuoteLanguage
}) {
  const quoteStrings = getQuoteStrings(language)

  return (
    <div className="flex items-center justify-end gap-2">
      <Link href="/quotes" className={glassBtn('secondary')}>
        {quoteStrings.nav.quotes}
      </Link>
      <Link href="/quotes/new" className={glassBtn('primary')}>
        {quoteStrings.nav.newQuote}
      </Link>
    </div>
  )
}

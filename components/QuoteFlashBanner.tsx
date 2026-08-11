'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { tw } from '@/Lib/quoteTranslations'

export default function QuoteFlashBanner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const locale = useAuthLocaleFromMe()
  const created = searchParams.get('created') === '1'
  const updated = searchParams.get('updated') === '1'

  useEffect(() => {
    if (!created && !updated) return
    const url = new URL(window.location.href)
    url.searchParams.delete('created')
    url.searchParams.delete('updated')
    url.searchParams.delete('pdf')
    router.replace(`${url.pathname}${url.search}`, { scroll: false })
  }, [created, updated, router])

  if (!created && !updated) return null

  return (
    <div className="no-print mb-4 rounded-xl border border-cdl-success-border bg-cdl-success-soft px-4 py-3 text-sm font-semibold text-cdl-success">
      {created ? tw(locale, 'quoteCreated') : tw(locale, 'quoteUpdated')}
    </div>
  )
}

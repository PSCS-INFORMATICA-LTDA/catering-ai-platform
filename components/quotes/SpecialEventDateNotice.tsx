'use client'

import {
  getSpecialEventDateNotice,
  isSpecialCdlEventDate,
} from '@/Lib/cdlSeasonalRules'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

export default function SpecialEventDateNotice({
  eventDate,
  language,
}: {
  eventDate?: string | null
  language: QuoteLanguage
}) {
  if (!isSpecialCdlEventDate(eventDate)) return null
  const copy = getSpecialEventDateNotice(language)
  return (
    <aside
      data-special-date-notice
      className="cdl-special-date-notice"
      role="status"
    >
      <p className="cdl-special-date-notice-title">{copy.title}</p>
      <ul>
        {copy.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </aside>
  )
}

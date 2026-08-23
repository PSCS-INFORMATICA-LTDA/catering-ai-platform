import type { ReactNode } from 'react'
import type { LandingHighlightTone } from '@/Lib/publicQuote/landingStoryCopy'

export default function CdlHighlight({
  tone,
  children,
}: {
  tone: LandingHighlightTone
  children: ReactNode
}) {
  return (
    <mark data-cdl-highlight={tone} className={`cdl-highlight cdl-highlight--${tone}`}>
      {children}
    </mark>
  )
}

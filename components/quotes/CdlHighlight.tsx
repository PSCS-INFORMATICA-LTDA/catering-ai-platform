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
    <mark
      data-cdl-highlight={tone}
      data-landing-brazil-identity={tone === 'brazil' ? 'true' : undefined}
      className={`cdl-highlight cdl-highlight--${tone}`}
    >
      {children}
    </mark>
  )
}

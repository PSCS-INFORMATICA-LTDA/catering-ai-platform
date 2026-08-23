import CdlHighlight from '@/components/quotes/CdlHighlight'
import type { LandingTitlePart } from '@/Lib/publicQuote/landingStoryCopy'

export default function PublicLandingTitle({
  parts,
  as: Tag = 'h2',
  className,
}: {
  parts: readonly LandingTitlePart[]
  as?: 'h1' | 'h2'
  className: string
}) {
  return (
    <Tag className={className}>
      {parts.map((part, index) => {
        const node = part.highlight ? (
          <CdlHighlight tone={part.highlight}>{part.text}</CdlHighlight>
        ) : (
          part.text
        )
        return (
          <span key={`${part.text}-${index}`}>
            {node}
            {part.breakAfter ? <br /> : null}
          </span>
        )
      })}
    </Tag>
  )
}

import CdlHighlight from '@/components/quotes/CdlHighlight'
import {
  groupLandingTitleLines,
  type LandingTitlePart,
} from '@/Lib/publicQuote/landingStoryCopy'

export default function PublicLandingTitle({
  parts,
  as: Tag = 'h2',
  className,
}: {
  parts: readonly LandingTitlePart[]
  as?: 'h1' | 'h2'
  className: string
}) {
  const lines = groupLandingTitleLines(parts)

  return (
    <Tag data-landing-title className={className}>
      {lines.map((line, lineIndex) => (
        <span
          key={`line-${lineIndex}-${line.map((part) => part.text).join('')}`}
          data-landing-title-line
          className="public-landing-title-line"
        >
          {line.map((part, partIndex) =>
            part.highlight ? (
              <CdlHighlight key={`${part.text}-${partIndex}`} tone={part.highlight}>
                {part.text}
              </CdlHighlight>
            ) : (
              <span key={`${part.text}-${partIndex}`}>{part.text}</span>
            ),
          )}
        </span>
      ))}
    </Tag>
  )
}

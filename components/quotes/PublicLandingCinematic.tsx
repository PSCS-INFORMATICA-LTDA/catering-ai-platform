'use client'

import PublicLandingReveal from '@/components/quotes/PublicLandingReveal'
import PublicLandingTitle from '@/components/quotes/PublicLandingTitle'
import CdlHighlight from '@/components/quotes/CdlHighlight'
import PublicQuoteHeroMedia from '@/components/quotes/PublicQuoteHeroMedia'
import PublicQuoteHowItWorks from '@/components/quotes/PublicQuoteHowItWorks'
import { publicLandingStory } from '@/Lib/publicQuote/landingStoryCopy'
import { PUBLIC_QUOTE_HERO_VIDEO_SRCS } from '@/Lib/publicQuote/heroMedia'
import type { PublicHeroMediaItem } from '@/Lib/publicQuote/companyPublicHeroMedia'
import type { PublicHowItWorksVideo } from '@/Lib/media/types'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

type PublicLandingCinematicProps = {
  locale: QuoteLanguage
  heroImages: PublicHeroMediaItem[]
  posterUrl?: string | null
  videos: readonly PublicHowItWorksVideo[]
  starting: boolean
  startError: boolean
  startErrorText: string
  onStart: () => void
}

export default function PublicLandingCinematic({
  locale,
  heroImages,
  posterUrl,
  videos,
  starting,
  startError,
  startErrorText,
  onStart,
}: PublicLandingCinematicProps) {
  const story = publicLandingStory(locale)

  return (
    <div
      data-public-landing
      data-public-landing-story
      data-public-landing-theme="dark"
      data-landing-pending-assets={
        PUBLIC_QUOTE_HERO_VIDEO_SRCS.length > 0 || heroImages.length > 0
          ? undefined
          : 'true'
      }
      className="public-cinematic"
    >
      <div data-public-hero-frame className="public-cinematic-hero">
        <PublicQuoteHeroMedia
          videos={PUBLIC_QUOTE_HERO_VIDEO_SRCS}
          media={heroImages}
          posterUrl={posterUrl}
          locale={locale}
        />
        <div className="public-cinematic-read-veil" aria-hidden />
      </div>

      <div className="public-cinematic-story">
        <section
          data-landing-chapter="intro"
          className="public-cinematic-chapter public-cinematic-chapter--intro"
        >
          <PublicLandingReveal eager className="public-cinematic-copy">
            <p className="public-cinematic-eyebrow">{story.hero.eyebrow}</p>
            <PublicLandingTitle
              as="h1"
              parts={story.hero.title}
              className="public-cinematic-display"
            />
            <p className="public-cinematic-lead">{story.hero.subtitle}</p>
            <p className="public-cinematic-micro">{story.hero.microcopy}</p>
            <button
              type="button"
              data-landing-start-quote
              data-landing-quick-cta
              onClick={onStart}
              disabled={starting}
              className="public-cinematic-cta public-cinematic-cta--quick"
            >
              {starting ? '…' : story.hero.quickCta}
              <span aria-hidden>→</span>
            </button>
            {startError ? (
              <p className="public-cinematic-error">{startErrorText}</p>
            ) : null}
          </PublicLandingReveal>
        </section>

        <section
          data-landing-chapter="how-it-works"
          className="public-cinematic-chapter"
        >
          <PublicLandingReveal className="public-cinematic-copy">
            <PublicLandingTitle
              parts={story.howItWorksTitle}
              className="public-cinematic-editorial"
            />
          </PublicLandingReveal>
        </section>

        {story.stories.map((chapter) => (
          <section
            key={chapter.id}
            data-landing-chapter={chapter.id}
            className="public-cinematic-chapter"
          >
            <PublicLandingReveal className="public-cinematic-copy">
              <p className="public-cinematic-kicker">{chapter.kicker}</p>
              {chapter.badge ? (
                <p className="mb-3">
                  <CdlHighlight tone={chapter.badge.tone}>{chapter.badge.text}</CdlHighlight>
                </p>
              ) : null}
              <PublicLandingTitle
                parts={chapter.title}
                className="public-cinematic-story-title"
              />
              <p className="public-cinematic-body">{chapter.body}</p>
            </PublicLandingReveal>
          </section>
        ))}

        <section
          data-landing-chapter="final-cta"
          className="public-cinematic-chapter"
        >
          <PublicLandingReveal className="public-cinematic-copy">
            <p className="public-cinematic-eyebrow">{story.finalCta.eyebrow}</p>
            <PublicLandingTitle
              parts={story.finalCta.title}
              className="public-cinematic-story-title"
            />
            <p className="public-cinematic-body">{story.finalCta.body}</p>
            <button
              type="button"
              data-landing-start-quote
              data-landing-final-cta
              onClick={onStart}
              disabled={starting}
              className="public-cinematic-cta public-cinematic-cta--final"
            >
              {starting ? '…' : story.finalCta.button}
              <span aria-hidden>→</span>
            </button>
          </PublicLandingReveal>
        </section>

        <section
          data-landing-chapter="video"
          className="public-cinematic-chapter public-cinematic-chapter--video"
        >
          <PublicLandingReveal className="public-cinematic-copy">
            <p className="public-cinematic-eyebrow">{story.video.eyebrow}</p>
            <p className="public-cinematic-body">{story.video.body}</p>
            <PublicQuoteHowItWorks
              label={story.video.play}
              title={story.video.title}
              closeLabel={story.video.close}
              videos={videos}
              routeLocale={locale}
              localeLabels={story.video.locales}
            />
          </PublicLandingReveal>
        </section>
      </div>
    </div>
  )
}

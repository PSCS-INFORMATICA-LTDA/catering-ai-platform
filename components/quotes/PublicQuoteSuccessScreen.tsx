'use client'

import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PublicQuoteSubmissionResult } from '@/app/quotes/new/QuoteWizard'
import { resolvePublicCompanyContacts } from '@/Lib/publicQuote/companyContacts'
import { scrollPublicQuoteToTop } from '@/Lib/publicQuote/scrollPublicQuoteToTop'
import { publicSuccessCopy } from '@/Lib/publicQuote/successCopy'
import {
  PUBLIC_SUCCESS_FIRE_FALLBACK_SRC,
  PUBLIC_SUCCESS_FIRE_POSTER_SRC,
  resolvePublicSuccessFireVideoSrc,
} from '@/Lib/publicQuote/successHeroMedia'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import PublicLandingTitle from '@/components/quotes/PublicLandingTitle'

function formatSuccessMoney(
  value: number,
  locale: QuoteLanguage,
  currency: string,
) {
  const languageTag = locale === 'en' ? 'en-US' : locale === 'es' ? 'es-US' : 'pt-BR'
  return new Intl.NumberFormat(languageTag, {
    style: 'currency',
    currency,
  }).format(value)
}

export default function PublicQuoteSuccessScreen({
  locale,
  companySlug,
  companyName,
  currencyCode,
  emblemSrc,
  support,
  success,
  restartHref,
  onRestart,
}: {
  locale: QuoteLanguage
  companySlug: string
  companyName: string
  currencyCode: string
  emblemSrc: string | null
  support: {
    phone: string | null
    whatsappUrl: string | null
    instagramUrl?: string | null
    instagramHandle?: string | null
  }
  success: PublicQuoteSubmissionResult
  restartHref: string
  onRestart: () => void
}) {
  const copy = publicSuccessCopy(locale)
  const contacts = resolvePublicCompanyContacts(support, companySlug)
  const rootRef = useRef<HTMLElement>(null)
  const videoSrc = resolvePublicSuccessFireVideoSrc()
  const [videoFailed, setVideoFailed] = useState(!videoSrc)
  const [posterFailed, setPosterFailed] = useState(false)
  const showVideo = Boolean(videoSrc) && !videoFailed
  const posterSrc = posterFailed
    ? PUBLIC_SUCCESS_FIRE_FALLBACK_SRC
    : PUBLIC_SUCCESS_FIRE_POSTER_SRC

  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration
    try {
      window.history.scrollRestoration = 'manual'
    } catch {
      /* ignore unsupported browsers */
    }
    scrollPublicQuoteToTop(rootRef.current)
    const frame = window.requestAnimationFrame(() => {
      scrollPublicQuoteToTop(rootRef.current)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      try {
        window.history.scrollRestoration = previous
      } catch {
        /* ignore */
      }
    }
  }, [success.quote.id])

  useEffect(() => {
    const reset = () => scrollPublicQuoteToTop(rootRef.current)
    const onPageShow = () => reset()
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [success.quote.id])

  const talkHref = contacts.whatsappUrl || (contacts.phone ? `tel:${contacts.phone}` : null)

  return (
    <main
      ref={rootRef}
      data-success-screen
      data-public-success
      data-success-hero-mode={showVideo ? 'video' : 'poster'}
      className="public-success"
    >
      <section className="public-success-hero" data-success-fire-hero>
        <div className="public-success-hero-media" aria-hidden>
          {showVideo ? (
            <video
              data-success-fire-video
              className="public-success-hero-video"
              src={videoSrc ?? undefined}
              poster={PUBLIC_SUCCESS_FIRE_POSTER_SRC}
              autoPlay
              muted
              playsInline
              loop
              preload="metadata"
              onError={() => setVideoFailed(true)}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              data-success-fire-poster
              src={posterSrc}
              alt=""
              className="public-success-hero-photo"
              onError={() => setPosterFailed(true)}
            />
          )}
          <div className="public-success-hero-veil" />
        </div>

        <div className="public-success-hero-copy">
          {emblemSrc ? (
            <div
              data-success-flame-art
              className="cdl-success-emblem public-success-emblem relative mx-auto flex h-24 w-24 items-center justify-center sm:h-28 sm:w-28"
            >
              <span
                aria-hidden
                className="cdl-success-emblem-halo pointer-events-none absolute inset-[-22%] rounded-full"
              />
              <div className="cdl-success-emblem-mark relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={emblemSrc}
                  alt=""
                  className="h-full w-full scale-[1.08] object-cover object-center"
                />
              </div>
            </div>
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
              ✓
            </span>
          )}
          <p className="public-cinematic-eyebrow public-success-kicker">{copy.kicker}</p>
          <PublicLandingTitle
            as="h1"
            className="public-cinematic-display public-success-title"
            parts={[
              { text: copy.title, breakAfter: true },
              { text: copy.titleMark, highlight: 'red' },
            ]}
          />
          <p className="public-cinematic-lead public-success-body-copy">{copy.body}</p>
        </div>
      </section>

      <section className="public-success-panel" data-success-summary>
        <dl className="public-success-summary">
          <div>
            <dt>{copy.quote}</dt>
            <dd>{success.quote.number || '—'}</dd>
          </div>
          <div>
            <dt>{copy.date}</dt>
            <dd>{success.quote.eventDate}</dd>
          </div>
          <div>
            <dt>{copy.name}</dt>
            <dd>{success.quote.eventName}</dd>
          </div>
          {typeof success.quote.total === 'number' ? (
            <div>
              <dt>{copy.total}</dt>
              <dd>
                {formatSuccessMoney(
                  success.quote.total,
                  locale,
                  success.quote.currency || currencyCode,
                )}
              </dd>
            </div>
          ) : null}
        </dl>

        <p data-success-zelle className="public-success-zelle">
          {copy.zelle}
        </p>

        <div data-success-contacts className="public-success-contacts">
          <p className="public-success-contacts-label">{copy.contacts}</p>
          <ul>
            {contacts.phone ? (
              <li>
                <a href={`tel:${contacts.phone}`}>
                  {copy.phone}
                  <span>{contacts.phone}</span>
                </a>
              </li>
            ) : null}
            {contacts.instagramUrl ? (
              <li>
                <a href={contacts.instagramUrl} target="_blank" rel="noreferrer">
                  {copy.instagram}
                  <span>{contacts.instagramHandle || companyName}</span>
                </a>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="public-success-actions">
          <Link
            href={restartHref}
            data-success-restart
            onClick={onRestart}
            className="public-cinematic-cta public-success-cta"
          >
            {copy.restart}
          </Link>
          {talkHref ? (
            <a
              href={talkHref}
              target={contacts.whatsappUrl ? '_blank' : undefined}
              rel={contacts.whatsappUrl ? 'noreferrer' : undefined}
              data-success-talk
              className="public-success-cta-secondary"
            >
              {copy.talk}
            </a>
          ) : null}
        </div>
      </section>
    </main>
  )
}

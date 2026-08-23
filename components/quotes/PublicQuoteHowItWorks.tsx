'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import type { PublicHowItWorksVideo } from '@/Lib/media/types'
import { pickHowItWorksVideo } from '@/Lib/publicQuote/howItWorksVideos'

export const PUBLIC_QUOTE_HOW_IT_WORKS_VIDEO_SRC =
  '/cdl/video/cdl-como-funciona.mp4'
export const PUBLIC_QUOTE_HOW_IT_WORKS_POSTER_SRC =
  '/cdl/video/cdl-como-funciona-poster.webp'

type PublicQuoteHowItWorksProps = {
  label: string
  closeLabel: string
  title: string
  src?: string | null
  poster?: string | null
  videos?: readonly PublicHowItWorksVideo[]
  routeLocale?: QuoteLanguage
  localeLabels?: Partial<Record<QuoteLanguage, string>>
}

export default function PublicQuoteHowItWorks({
  label,
  closeLabel,
  title,
  src,
  poster,
  videos = [],
  routeLocale = 'pt',
  localeLabels,
}: PublicQuoteHowItWorksProps) {
  const available = useMemo(
    () => videos.filter((video) => Boolean(video.src)),
    [videos],
  )
  const initial = pickHowItWorksVideo(available, routeLocale, 'pt')
  const [selectedLocale, setSelectedLocale] = useState<QuoteLanguage>(
    initial?.locale || routeLocale,
  )
  const selected =
    pickHowItWorksVideo(available, selectedLocale, routeLocale) || initial
  const videoSrc =
    selected?.src?.trim() || src?.trim() || PUBLIC_QUOTE_HOW_IT_WORKS_VIDEO_SRC
  const posterSrc =
    selected?.poster?.trim() ||
    poster?.trim() ||
    PUBLIC_QUOTE_HOW_IT_WORKS_POSTER_SRC
  const showLocaleSwitch = available.length > 1
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [open, setOpen] = useState(false)

  const pauseAndReset = useCallback(() => {
    const node = videoRef.current
    if (!node) return
    node.pause()
    node.currentTime = 0
  }, [])

  const closeModal = useCallback(() => {
    pauseAndReset()
    setOpen(false)
  }, [pauseAndReset])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
      pauseAndReset()
    }
  }, [closeModal, open, pauseAndReset])

  return (
    <>
      <button
        type="button"
        data-landing-how-it-works
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-2xl border border-white/22 bg-white/8 px-5 text-sm font-semibold tracking-wide text-white/92 backdrop-blur-sm transition hover:bg-white/12 sm:w-auto"
      >
        <svg
          viewBox="0 0 20 20"
          className="h-3.5 w-3.5 shrink-0"
          aria-hidden
        >
          <path fill="currentColor" d="M6.2 4.1v11.8L16.4 10 6.2 4.1z" />
        </svg>
        <span>{label}</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0b1220]/82 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          role="presentation"
          data-how-it-works-overlay
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-how-it-works-modal
            className="relative w-full max-w-[22rem] overflow-hidden rounded-3xl bg-[#0b1220] shadow-2xl ring-1 ring-white/12"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <h2
                id={titleId}
                className="text-sm font-semibold tracking-wide text-white/90"
              >
                {title}
              </h2>
              <button
                ref={closeRef}
                type="button"
                data-how-it-works-close
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/12 text-2xl leading-none text-white"
                aria-label={closeLabel}
                onClick={closeModal}
              >
                ×
              </button>
            </div>
            {showLocaleSwitch ? (
              <div
                data-how-it-works-locales
                className="flex flex-wrap gap-2 px-4 pb-3"
                role="tablist"
                aria-label="Video language"
              >
                {available.map((video) => {
                  const selectedTab = video.locale === selected?.locale
                  return (
                    <button
                      key={video.locale}
                      type="button"
                      role="tab"
                      aria-selected={selectedTab}
                      data-how-it-works-locale={video.locale}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold tracking-wide ${
                        selectedTab
                          ? 'bg-white text-[#0b1220]'
                          : 'bg-white/10 text-white/80'
                      }`}
                      onClick={() => {
                        pauseAndReset()
                        setSelectedLocale(video.locale)
                      }}
                    >
                      {localeLabels?.[video.locale] || video.locale.toUpperCase()}
                    </button>
                  )
                })}
              </div>
            ) : null}
            <video
              ref={videoRef}
              key={videoSrc}
              data-how-it-works-video
              className="mx-auto block h-auto max-h-[min(72dvh,38rem)] w-full bg-black object-contain"
              src={videoSrc}
              poster={posterSrc}
              controls
              playsInline
              preload="none"
            />
          </div>
        </div>
      ) : null}
    </>
  )
}

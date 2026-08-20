'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

export const PUBLIC_QUOTE_HOW_IT_WORKS_VIDEO_SRC =
  '/cdl/video/cdl-como-funciona.mp4'
export const PUBLIC_QUOTE_HOW_IT_WORKS_POSTER_SRC =
  '/cdl/video/cdl-como-funciona-poster.webp'

type PublicQuoteHowItWorksProps = {
  label: string
  closeLabel: string
  title: string
}

export default function PublicQuoteHowItWorks({
  label,
  closeLabel,
  title,
}: PublicQuoteHowItWorksProps) {
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
        className="mt-3 inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-2xl border border-white/22 bg-white/5 px-5 text-sm font-semibold tracking-wide text-white/88 transition hover:bg-white/10 sm:w-auto"
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
            <video
              ref={videoRef}
              data-how-it-works-video
              className="mx-auto block h-auto max-h-[min(72dvh,38rem)] w-full bg-black object-contain"
              src={PUBLIC_QUOTE_HOW_IT_WORKS_VIDEO_SRC}
              poster={PUBLIC_QUOTE_HOW_IT_WORKS_POSTER_SRC}
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

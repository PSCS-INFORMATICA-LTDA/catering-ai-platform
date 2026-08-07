'use client'

import { useEffect, useState } from 'react'

export default function PackageHeroImage({
  src,
  alt,
  fallbackLabel = 'Imagem do pacote',
  expand = true,
  compact = false,
}: {
  src?: string | null
  alt: string
  fallbackLabel?: string
  /** Expande além do padding do card pai (Etapa 3 / resumo). */
  expand?: boolean
  /** Coluna ao lado das opções — imagem menor, sem max-width largo. */
  compact?: boolean
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const normalizedSrc = src?.trim() || null

  useEffect(() => {
    if (!lightboxOpen) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [lightboxOpen])

  const frameClass = [
    compact
      ? 'my-0'
      : expand
        ? '-mx-4 my-4 sm:-mx-2 sm:my-3'
        : 'my-3',
    'overflow-hidden rounded-3xl bg-white p-1 shadow-lg ring-1 ring-black/5',
    compact ? 'w-full max-w-full' : 'md:mx-auto md:max-w-3xl lg:max-w-4xl',
  ]
    .filter(Boolean)
    .join(' ')

  const imgMaxClass = compact
    ? 'max-h-[280px] md:max-h-[360px] lg:max-h-[420px]'
    : 'max-h-[620px] md:max-h-[760px]'

  const openLightbox = () => setLightboxOpen(true)

  if (!normalizedSrc) {
    return (
      <div className={frameClass}>
        <div className="flex min-h-[10rem] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-50 px-4 py-10">
          <span className="text-center text-xs font-semibold uppercase tracking-wider text-neutral-500">
            {fallbackLabel}
          </span>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={frameClass}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={normalizedSrc}
          alt={alt}
          onClick={openLightbox}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openLightbox()
            }
          }}
          role="button"
          tabIndex={0}
          className={`h-auto w-full max-w-full cursor-zoom-in rounded-2xl object-contain ${imgMaxClass}`}
          loading="lazy"
          decoding="async"
          aria-label={`Ampliar imagem: ${alt}`}
        />
      </div>

      {lightboxOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-3xl leading-none text-white backdrop-blur-sm transition hover:bg-white/25 sm:right-5 sm:top-5"
            aria-label="Fechar"
            onClick={(e) => {
              e.stopPropagation()
              setLightboxOpen(false)
            }}
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={normalizedSrc}
            alt={alt}
            className="max-h-[92vh] max-w-[min(96vw,64rem)] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  )
}

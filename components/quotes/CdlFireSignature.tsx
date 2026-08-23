'use client'

import { useEffect, useState } from 'react'
import { PUBLIC_SUCCESS_CDL_LOGO_SRC } from '@/Lib/publicQuote/successHeroMedia'

function CdlFireFlames() {
  return (
    <svg
      className="cdl-fire-flames"
      data-cdl-fire-flames
      viewBox="0 0 240 260"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id="cdlFireWarm" x1="120" y1="240" x2="120" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5a0808" />
          <stop offset="22%" stopColor="#b1120f" />
          <stop offset="48%" stopColor="#ff5a00" />
          <stop offset="74%" stopColor="#ffb020" />
          <stop offset="100%" stopColor="#ffe58a" />
        </linearGradient>
        <linearGradient id="cdlFireDeep" x1="80" y1="230" x2="160" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3d0606" />
          <stop offset="30%" stopColor="#c41b12" />
          <stop offset="62%" stopColor="#ff7a18" />
          <stop offset="100%" stopColor="#ffd36a" />
        </linearGradient>
        <radialGradient id="cdlFireBrazilHint" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#ffdf00" stopOpacity="0.32" />
          <stop offset="42%" stopColor="#009b3a" stopOpacity="0.16" />
          <stop offset="78%" stopColor="#002776" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#002776" stopOpacity="0" />
        </radialGradient>
        <filter id="cdlFireSoft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>

      <g className="cdl-fire-flame cdl-fire-flame--back" filter="url(#cdlFireSoft)">
        <path
          fill="url(#cdlFireDeep)"
          d="M64 208c-18-28-16-62 4-86 8 16 22 24 28 6 4 22 18 28 24 8 10 28 8 58-12 80-18 20-32 14-44-8z"
        />
        <path
          fill="url(#cdlFireDeep)"
          d="M176 208c18-28 16-62-4-86-8 16-22 24-28 6-4 22-18 28-24 8-10 28-8 58 12 80 18 20 32 14 44-8z"
        />
        <path
          fill="url(#cdlFireWarm)"
          d="M120 236c-36-18-48-58-28-96 10 18 24 20 28-8 4 28 18 26 28 8 20 38 8 78-28 96z"
        />
      </g>

      <g className="cdl-fire-flame cdl-fire-flame--mid">
        <path
          fill="url(#cdlFireWarm)"
          d="M92 214c-16-24-12-54 8-74 7 14 16 16 20 2 3 18 14 20 18 2 14 26 6 52-10 70-14 16-24 12-36 0z"
        />
        <path
          fill="url(#cdlFireWarm)"
          d="M148 214c16-24 12-54-8-74-7 14-16 16-20 2-3 18-14 20-18 2-14 26-6 52 10 70 14 16 24 12 36 0z"
        />
        <path
          fill="url(#cdlFireWarm)"
          d="M120 228c-22-14-30-44-14-72 8 14 16 14 14-12 0 26 8 26 16 12 16 28 6 58-16 72z"
        />
        <path
          fill="url(#cdlFireWarm)"
          d="M70 188c-10-22-4-46 14-62 6 12 14 12 16-2 2 16 12 16 16 0 10 22 2 44-12 58-12 12-24 14-34 6z"
        />
        <path
          fill="url(#cdlFireWarm)"
          d="M170 188c10-22 4-46-14-62-6 12-14 12-16-2-2 16-12 16-16 0-10 22-2 44 12 58 12 12 24 14 34 6z"
        />
      </g>

      <g className="cdl-fire-flame cdl-fire-flame--crown">
        <path
          fill="url(#cdlFireWarm)"
          d="M88 58c-10 18-6 36 8 46 4-10 10-10 12-2 2-12 10-14 14-2 10-16 6-34-6-46-10-10-20-8-28 4z"
        />
        <path
          fill="url(#cdlFireWarm)"
          d="M152 58c10 18 6 36-8 46-4-10-10-10-12-2-2-12-10-14-14-2-10-16-6-34 6-46 10-10 20-8 28 4z"
        />
        <path
          fill="url(#cdlFireWarm)"
          d="M120 42c-12 14-10 32 2 42 4-10 8-8 10 2 6-14 8-28-2-44-4-6-8-6-10 0z"
        />
      </g>

      <ellipse
        className="cdl-fire-brazil-hint"
        cx="78"
        cy="96"
        rx="16"
        ry="22"
        fill="url(#cdlFireBrazilHint)"
      />
      <ellipse
        className="cdl-fire-brazil-hint"
        cx="168"
        cy="168"
        rx="14"
        ry="18"
        fill="url(#cdlFireBrazilHint)"
      />
    </svg>
  )
}

export default function CdlFireSignature({
  src,
  alt,
}: {
  src?: string | null
  alt: string
}) {
  const markSrc = src || PUBLIC_SUCCESS_CDL_LOGO_SRC
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduceMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return (
    <section
      data-cdl-fire-signature
      data-success-fire-logo
      data-success-cdl-signature
      data-success-uses-final-cdl-mp4="false"
      data-success-fire-transparent="true"
      data-success-fire-reduced-motion={reduceMotion ? 'true' : 'false'}
      className={`cdl-fire-signature public-success-cdl-signature${reduceMotion ? ' is-static' : ''}`}
      aria-label={alt}
    >
      <div className="cdl-fire-signature-stage" aria-hidden>
        <span className="cdl-fire-signature-halo" />
        <span className="cdl-fire-signature-glow" />
        {reduceMotion ? null : (
          <>
            <CdlFireFlames />
            <span className="cdl-fire-signature-embers">
              <i />
              <i />
              <i />
              <i />
            </span>
          </>
        )}
        <span className="cdl-fire-signature-mark-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-success-fire-logo-mark
            data-success-cdl-logo
            data-cdl-fire-signature-mark
            src={markSrc}
            alt=""
            className="cdl-fire-signature-mark public-success-cdl-static"
          />
        </span>
      </div>
    </section>
  )
}

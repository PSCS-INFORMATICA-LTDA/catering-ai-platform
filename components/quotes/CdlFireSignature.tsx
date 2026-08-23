'use client'

import { useEffect, useState } from 'react'
import {
  PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC,
  PUBLIC_SUCCESS_CDL_LOGO_SRC,
} from '@/Lib/publicQuote/successHeroMedia'

/**
 * Success closing signature.
 * Official fire plate is shown as a circular fade — no extra mark overlay,
 * no CSS tongues, no rectangular plate.
 */
export default function CdlFireSignature({
  src,
  alt,
}: {
  src?: string | null
  alt: string
}) {
  const markSrc = src || PUBLIC_SUCCESS_CDL_LOGO_SRC
  const [reduceMotion, setReduceMotion] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduceMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const showVideo = !reduceMotion && !videoFailed

  return (
    <section
      data-cdl-fire-signature
      data-success-fire-logo
      data-success-cdl-signature
      data-success-uses-final-cdl-mp4={showVideo ? 'true' : 'false'}
      data-success-fire-treated-mp4="true"
      data-success-fire-transparent="true"
      data-success-fire-no-book-now="true"
      data-success-video-has-no-book-now="true"
      data-success-fire-reduced-motion={reduceMotion ? 'true' : 'false'}
      className={`cdl-fire-signature public-success-cdl-signature${showVideo ? '' : ' is-static'}`}
      aria-label={alt}
    >
      <div className="cdl-fire-signature-stage" aria-hidden>
        {showVideo ? (
          <video
            data-success-cdl-fire-video
            data-cdl-fire-treated-video
            className="cdl-fire-signature-video"
            src={PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            controls={false}
            disablePictureInPicture
            onError={() => setVideoFailed(true)}
          />
        ) : (
          <>
            <span className="cdl-fire-signature-glow" />
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
          </>
        )}
      </div>
    </section>
  )
}

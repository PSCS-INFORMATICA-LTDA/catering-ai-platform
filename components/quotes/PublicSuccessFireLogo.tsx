'use client'

import { useEffect, useState } from 'react'
import {
  PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC,
  PUBLIC_SUCCESS_CDL_LOGO_SRC,
} from '@/Lib/publicQuote/successHeroMedia'

/**
 * Final-confirmation CDL signature.
 * Fire comes only from the approved MP4. No CSS flames, glow, or spin.
 */
export default function PublicSuccessFireLogo({
  src,
  alt,
}: {
  src: string
  alt: string
}) {
  const staticSrc = src || PUBLIC_SUCCESS_CDL_LOGO_SRC
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
      data-success-fire-logo
      data-success-cdl-signature
      className="public-success-cdl-signature"
      aria-label={alt}
    >
      {showVideo ? (
        <video
          data-success-cdl-fire-video
          data-success-uses-final-cdl-mp4="true"
          data-success-video-has-no-book-now="true"
          className="public-success-cdl-fire-video"
          src={PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC}
          poster={staticSrc}
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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-success-fire-logo-mark
          data-success-cdl-logo
          src={staticSrc}
          alt=""
          className="public-success-cdl-static"
        />
      )}
    </section>
  )
}

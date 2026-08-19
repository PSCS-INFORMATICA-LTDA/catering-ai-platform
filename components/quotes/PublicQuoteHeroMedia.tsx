'use client'

import { useEffect, useRef, useState } from 'react'

type PublicQuoteHeroMediaProps = {
  videos?: readonly string[]
  images: string[]
  posterUrl?: string | null
}

export default function PublicQuoteHeroMedia({
  videos = [],
  images,
  posterUrl,
}: PublicQuoteHeroMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoIndex, setVideoIndex] = useState(0)
  const [imageIndex, setImageIndex] = useState(0)
  const activeVideo = videos[videoIndex] || null
  const hasImages = images.length > 0

  useEffect(() => {
    const node = videoRef.current
    if (!node || !activeVideo) return
    node.muted = true
    node.defaultMuted = true
    const play = () => {
      void node.play().catch(() => {})
    }
    play()
    node.addEventListener('loadeddata', play)
    return () => node.removeEventListener('loadeddata', play)
  }, [activeVideo])

  useEffect(() => {
    if (activeVideo || images.length < 2) return
    const timer = window.setInterval(() => {
      setImageIndex((current) => (current + 1) % images.length)
    }, 7000)
    return () => window.clearInterval(timer)
  }, [activeVideo, images.length])

  return (
    <div
      data-public-hero-media
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#0b1220]"
    >
      {activeVideo ? (
        <video
          ref={videoRef}
          key={activeVideo}
          className="absolute inset-0 h-full w-full object-cover"
          src={activeVideo}
          poster={posterUrl || images[0] || undefined}
          autoPlay
          muted
          playsInline
          loop={videos.length === 1}
          preload="metadata"
          onEnded={() => {
            if (videos.length < 2) return
            setVideoIndex((current) => (current + 1) % videos.length)
          }}
        />
      ) : hasImages ? (
        images.map((src, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
              index === imageIndex ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,color-mix(in_srgb,var(--brand-primary-2)_28%,transparent),transparent_36%),linear-gradient(135deg,#0b1220,#18233a)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/35" />
    </div>
  )
}

'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  PUBLIC_HERO_FADE_MS,
  PUBLIC_HERO_HOLD_MS,
  type PublicHeroMediaItem,
} from '@/Lib/publicQuote/companyPublicHeroMedia'

type PublicQuoteHeroMediaProps = {
  videos?: readonly string[]
  media: PublicHeroMediaItem[]
  posterUrl?: string | null
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return reduced
}

function usePageIsVisible() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const sync = () => setVisible(document.visibilityState === 'visible')
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  return visible
}

export default function PublicQuoteHeroMedia({
  videos = [],
  media,
  posterUrl,
}: PublicQuoteHeroMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const touchStartX = useRef<number | null>(null)
  const [videoIndex, setVideoIndex] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [outgoing, setOutgoing] = useState<PublicHeroMediaItem | null>(null)
  const [paused, setPaused] = useState(false)
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const reducedMotion = usePrefersReducedMotion()
  const pageVisible = usePageIsVisible()
  const activeVideo = videos[videoIndex] || null
  const playable = useMemo(
    () => media.filter((item) => !failedIds.has(item.id)),
    [failedIds, media],
  )
  const activePhoto = playable[activeIndex] ?? null
  const nextPhoto =
    playable.length > 1
      ? (playable[(activeIndex + 1) % playable.length] ?? null)
      : null
  const hasPhotos = playable.length > 0

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
    setActiveIndex(0)
    setOutgoing(null)
  }, [media])

  useEffect(() => {
    if (activeIndex < playable.length) return
    setActiveIndex(0)
  }, [activeIndex, playable.length])

  useEffect(() => {
    if (activeVideo || reducedMotion || !pageVisible || paused) return
    if (playable.length < 2) return

    const timer = window.setTimeout(() => {
      const current = playable[activeIndex]
      setOutgoing(current ?? null)
      setActiveIndex((currentIndex) => (currentIndex + 1) % playable.length)
    }, PUBLIC_HERO_HOLD_MS)

    return () => window.clearTimeout(timer)
  }, [
    activeIndex,
    activeVideo,
    pageVisible,
    paused,
    playable,
    reducedMotion,
  ])

  useEffect(() => {
    if (!outgoing) return
    const timer = window.setTimeout(() => setOutgoing(null), PUBLIC_HERO_FADE_MS)
    return () => window.clearTimeout(timer)
  }, [outgoing])

  useEffect(() => {
    if (!nextPhoto?.src) return
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = nextPhoto.src
    document.head.appendChild(link)
    return () => {
      link.remove()
    }
  }, [nextPhoto?.src])

  const goTo = (index: number) => {
    if (playable.length < 2) return
    const nextIndex = (index + playable.length) % playable.length
    if (nextIndex === activeIndex) return
    setOutgoing(playable[activeIndex] ?? null)
    setActiveIndex(nextIndex)
    setPaused(true)
  }

  const renderedPhotos = useMemo(() => {
    const byId = new Map<string, PublicHeroMediaItem>()
    if (activePhoto) byId.set(activePhoto.id, activePhoto)
    if (outgoing && outgoing.id !== activePhoto?.id) {
      byId.set(outgoing.id, outgoing)
    }
    return [...byId.values()]
  }, [activePhoto, outgoing])

  return (
    <div
      data-public-hero-media
      data-hero-photo-count={media.length}
      data-hero-active-id={activePhoto?.id ?? ''}
      data-hero-paused={paused ? 'true' : 'false'}
      aria-roledescription="carousel"
      aria-label="Event photography"
      className="absolute inset-0 overflow-hidden bg-[#0b1220]"
      onPointerDown={() => {
        if (playable.length > 1) setPaused(true)
      }}
      onTouchStart={(event) => {
        touchStartX.current = event.changedTouches[0]?.clientX ?? null
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current
        const end = event.changedTouches[0]?.clientX
        touchStartX.current = null
        if (start == null || end == null || playable.length < 2) return
        const delta = end - start
        if (Math.abs(delta) < 40) return
        goTo(delta < 0 ? activeIndex + 1 : activeIndex - 1)
      }}
    >
      {activeVideo ? (
        <video
          ref={videoRef}
          key={activeVideo}
          className="absolute inset-0 h-full w-full object-cover"
          src={activeVideo}
          poster={posterUrl || media[0]?.src || undefined}
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
      ) : hasPhotos ? (
        renderedPhotos.map((item) => {
          const isActive = item.id === activePhoto?.id
          return (
            <div
              key={item.id}
              data-hero-photo-id={item.id}
              className={`public-hero-slide ${isActive ? 'is-active' : ''}`}
              style={{
                ['--hero-pos-mobile' as string]: item.mobilePosition,
                ['--hero-pos-desktop' as string]: item.desktopPosition,
                transitionDuration: `${PUBLIC_HERO_FADE_MS}ms`,
              }}
            >
              <Image
                src={item.src}
                alt={item.alt || ''}
                fill
                sizes="100vw"
                quality={90}
                priority={isActive && item.id === playable[0]?.id}
                loading={isActive ? 'eager' : 'lazy'}
                fetchPriority={isActive ? 'high' : 'low'}
                className="public-hero-photo"
                onError={() => {
                  setFailedIds((current) => {
                    if (current.has(item.id)) return current
                    const next = new Set(current)
                    next.add(item.id)
                    return next
                  })
                }}
              />
            </div>
          )
        })
      ) : (
        <div
          data-hero-fallback
          className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,color-mix(in_srgb,var(--brand-primary-2)_28%,transparent),transparent_36%),linear-gradient(135deg,#0b1220,#18233a)]"
        />
      )}
      <div className="public-hero-overlay" />
      {playable.length > 1 && !activeVideo ? (
        <div
          data-hero-indicators
          className="public-hero-indicators"
          role="tablist"
          aria-label="Gallery photographs"
        >
          {playable.map((item, index) => {
            const selected = index === activeIndex
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={item.alt || `Photograph ${index + 1}`}
                data-hero-indicator={item.id}
                className={`public-hero-indicator ${selected ? 'is-active' : ''}`}
                onClick={() => goTo(index)}
              />
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

export default function PublicLandingReveal({
  children,
  className = '',
  eager = false,
}: {
  children: ReactNode
  className?: string
  eager?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(eager)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      data-landing-reveal
      data-visible={visible ? 'true' : 'false'}
      className={`public-landing-reveal${visible ? ' is-visible' : ''} ${className}`.trim()}
    >
      {children}
    </div>
  )
}

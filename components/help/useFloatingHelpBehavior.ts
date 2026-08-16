'use client'

import { useEffect, useRef, useState } from 'react'
import { getHelpHintGreeting } from '@/components/help/helpChat'

const HINT_SHOW_DELAY_MS = 2000
const HINT_VISIBLE_MS = 5000

export function helpHintSeenKey(pathname: string): string {
  return `help_hint_seen_${pathname.split('?')[0] ?? '/'}`
}

export function useFloatingHelpBehavior(
  pathname: string,
  panelOpen: boolean,
  locale?: string | null,
) {
  const [hintVisible, setHintVisible] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setHintVisible(false)

    if (panelOpen) return

    const key = helpHintSeenKey(pathname)
    const alreadySeen =
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem(key) === '1'

    if (alreadySeen) return

    showTimerRef.current = setTimeout(() => {
      setHintVisible(true)
      hideTimerRef.current = setTimeout(() => {
        setHintVisible(false)
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(key, '1')
        }
      }, HINT_VISIBLE_MS)
    }, HINT_SHOW_DELAY_MS)

    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [pathname, panelOpen])

  function dismissHint() {
    setHintVisible(false)
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(helpHintSeenKey(pathname), '1')
    }
  }

  return {
    hintText: getHelpHintGreeting(locale),
    hintVisible,
    dismissHint,
    clearHint: dismissHint,
  }
}

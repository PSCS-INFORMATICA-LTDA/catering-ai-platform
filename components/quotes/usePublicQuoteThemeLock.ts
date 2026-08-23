'use client'

import { useEffect } from 'react'

const WIZARD_LOCK = 'light-locked'

export function usePublicQuoteThemeLock(mode: 'landing-dark' | 'wizard-light') {
  useEffect(() => {
    const root = document.documentElement
    const previousTheme = root.getAttribute('data-theme')
    const previousLock = root.getAttribute('data-public-wizard-theme')
    const previousScheme = root.style.colorScheme

    if (mode === 'wizard-light') {
      root.setAttribute('data-theme', 'light')
      root.setAttribute('data-public-wizard-theme', WIZARD_LOCK)
      root.style.colorScheme = 'light'
    } else {
      root.setAttribute('data-theme', 'dark')
      root.removeAttribute('data-public-wizard-theme')
      root.style.colorScheme = 'dark'
    }

    return () => {
      if (previousTheme) root.setAttribute('data-theme', previousTheme)
      else root.removeAttribute('data-theme')
      if (previousLock) root.setAttribute('data-public-wizard-theme', previousLock)
      else root.removeAttribute('data-public-wizard-theme')
      root.style.colorScheme = previousScheme
    }
  }, [mode])
}

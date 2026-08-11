'use client'

import { tChrome } from '@/Lib/i18n/chrome'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { glassBtn } from '@/Lib/liquidGlass'
import { useTheme } from './ThemeProvider'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const locale = useAuthLocaleFromMe()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={glassBtn('secondary', className)}
      aria-label={
        isDark
          ? tChrome(locale, 'themeActivateLight')
          : tChrome(locale, 'themeActivateDark')
      }
      title={
        isDark
          ? tChrome(locale, 'themeLightTitle')
          : tChrome(locale, 'themeDarkTitle')
      }
    >
      <span aria-hidden className="text-base leading-none">
        {isDark ? '☀' : '☾'}
      </span>
      <span>
        {isDark ? tChrome(locale, 'themeLight') : tChrome(locale, 'themeDark')}
      </span>
    </button>
  )
}

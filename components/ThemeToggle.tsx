'use client'

import { glassBtn } from '@/Lib/liquidGlass'
import { useTheme } from './ThemeProvider'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={glassBtn('secondary', className)}
      aria-label={
        theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'
      }
      title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
    >
      <span aria-hidden className="text-base leading-none">
        {theme === 'dark' ? '☀' : '☾'}
      </span>
      <span>{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
    </button>
  )
}

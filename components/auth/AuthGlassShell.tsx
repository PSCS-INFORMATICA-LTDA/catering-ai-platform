'use client'

import type { ReactNode } from 'react'
import { CateringAuthLogo } from '@/components/brand/CateringAuthLogo'
import { PscsOneMark } from '@/components/brand/PscsOneMark'
import { glassCard } from '@/Lib/liquidGlass'

type AuthGlassShellProps = {
  children: ReactNode
  /** Controles auxiliares no topo do painel (ex.: seletor de idioma). */
  toolbar?: ReactNode
}

export function AuthGlassShell({ children, toolbar }: AuthGlassShellProps) {
  return (
    <main className="auth-glass-shell relative mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-2xl flex-col items-center justify-center px-4 py-10">
      <div className="auth-glass-shell__glow" aria-hidden />
      <div className="relative z-[1] mb-4 w-full sm:mb-6">
        <CateringAuthLogo />
      </div>
      <div className={`relative z-[1] w-full max-w-lg ${glassCard('auth-glass-shell__panel p-6 sm:p-8')}`}>
        {toolbar ? (
          <div className="mb-5 flex items-center justify-end">{toolbar}</div>
        ) : null}
        {children}
      </div>
      <div className="relative z-[1] mt-6">
        <PscsOneMark className="mx-auto h-6 dark:brightness-0 dark:invert dark:opacity-70" />
      </div>
    </main>
  )
}

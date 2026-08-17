'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { ThemeToggle } from '@/components/ThemeToggle'
import {
  isPublicQuotePathname,
  isPublicRoutePathname,
} from '@/Lib/publicRoutes'

/** Shell lateral nas telas autenticadas; páginas públicas ficam limpas. */
export function AuthenticatedShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/'

  if (isPublicQuotePathname(pathname)) {
    return <div className="relative min-h-full">{children}</div>
  }

  if (isPublicRoutePathname(pathname)) {
    return (
      <>
        <div className="no-print pointer-events-none fixed top-4 right-4 z-50 sm:top-6 sm:right-6">
          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
        </div>
        <div className="relative min-h-full pt-14">{children}</div>
      </>
    )
  }

  return <AppShell>{children}</AppShell>
}

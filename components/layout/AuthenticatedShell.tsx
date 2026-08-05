'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { ThemeToggle } from '@/components/ThemeToggle'

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  if (pathname.startsWith('/login')) return true
  if (pathname.startsWith('/auth')) return true
  if (pathname.startsWith('/customer-quote')) return true
  if (pathname.startsWith('/quote-request')) return true
  if (pathname.startsWith('/proposta/')) return true
  return false
}

/** Shell lateral nas telas autenticadas; páginas públicas ficam limpas. */
export function AuthenticatedShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/'

  if (isPublicPath(pathname)) {
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

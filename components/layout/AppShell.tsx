'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { CateringSidebar } from '@/components/layout/CateringSidebar'

const COLLAPSE_KEY = 'cdl-sidebar-collapsed'

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [mobileOpen])

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <div className="app-shell flex h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden bg-cdl-bg print:block print:h-auto print:max-h-none print:overflow-visible">
      <div className="print:hidden">
        <CateringSidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          onToggleCollapsed={toggleCollapsed}
        />
      </div>
      <div className="app-shell-column flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden print:block print:h-auto print:max-h-none print:overflow-visible">
        <div className="print:hidden">
          <AppHeader onMenuClick={() => setMobileOpen(true)} />
        </div>
        <main className="app-shell-main min-h-0 flex-1 overflow-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5 print:h-auto print:max-h-none print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
    </div>
  )
}

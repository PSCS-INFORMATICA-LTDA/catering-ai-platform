'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import AuthSessionBar from '@/components/auth/AuthSessionBar'
import TenantContextBar from '@/components/tenant/TenantContextBar'
import { glassBtn, glassTabLink } from '@/Lib/liquidGlass'
import { getQuoteStrings } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

function getNavLinks(language: QuoteLanguage = 'pt') {
  const t = getQuoteStrings(language).nav
  return [
    { href: '/agenda', label: 'Agenda' },
    { href: '/teams', label: 'Equipes' },
    { href: '/quotes', label: t.quotes },
    { href: '/customers', label: t.customers },
    { href: '/packages', label: t.packages },
    { href: '/additional-items', label: t.itemCatalog },
    { href: '/commercial-rules', label: t.rules },
    { href: '/packages/images', label: t.images },
  ] as const
}

function isNavActive(pathname: string, href: string) {
  if (href === '/agenda') {
    return pathname === '/agenda' || pathname.startsWith('/agenda/')
  }
  if (href === '/teams') {
    return pathname === '/teams' || pathname.startsWith('/teams/')
  }
  if (href === '/quotes') {
    return (
      pathname === '/quotes' ||
      (pathname.startsWith('/quotes/') && !pathname.startsWith('/quotes/new'))
    )
  }
  if (href === '/customers') {
    return pathname === '/customers' || pathname.startsWith('/customers/')
  }
  if (href === '/packages') {
    return (
      pathname === '/packages' ||
      (pathname.startsWith('/packages/') && !pathname.startsWith('/packages/images'))
    )
  }
  if (href === '/packages/images') {
    return pathname.startsWith('/packages/images')
  }
  if (href === '/additional-items') {
    return (
      pathname === '/additional-items' ||
      pathname.startsWith('/additional-items/')
    )
  }
  if (href === '/commercial-rules') {
    return (
      pathname === '/commercial-rules' ||
      pathname.startsWith('/commercial-rules/')
    )
  }
  return pathname === href
}

export default function AdminCompactMenu({
  language = 'pt',
}: {
  language?: QuoteLanguage
}) {
  const pathname = usePathname() ?? ''
  const navLinks = getNavLinks(language)
  const quoteStrings = getQuoteStrings(language)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="space-y-2">
      <AuthSessionBar />
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={glassBtn('secondary', 'h-10 w-10 !min-h-10 !p-0')}
          aria-expanded={open}
          aria-label="Menu administrativo"
        >
          <span className="sr-only">Menu</span>
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>

        <Link href="/quotes/new" className={glassBtn('primary')}>
          {quoteStrings.nav.newQuote}
        </Link>

        {open ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/30"
              aria-label="Fechar menu"
              onClick={() => setOpen(false)}
            />
            <div className="liquid-glass-menu-panel fixed left-3 right-3 top-14 z-50 max-h-[min(70vh,28rem)] overflow-y-auto p-3 sm:left-auto sm:right-4 sm:w-72">
              <TenantContextBar />
              <nav className="mt-3 flex flex-col gap-1.5" aria-label="Navegação administrativa">
                {navLinks.map((link) => {
                  const active = isNavActive(pathname, link.href)
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={glassTabLink(
                        active,
                        'w-full justify-start liquid-glass-tab-link--plain',
                      )}
                    >
                      {link.label}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

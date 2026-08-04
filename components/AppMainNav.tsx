'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AuthSessionBar from '@/components/auth/AuthSessionBar'
import BuildVersionBadge from '@/components/BuildVersionBadge'
import TenantContextBar from '@/components/tenant/TenantContextBar'
import { glassBtn, glassTabLink, glassTabsNav } from '@/Lib/liquidGlass'

const NAV_LINKS = [
  { href: '/quotes', label: 'Cotações' },
  { href: '/customers', label: 'Cadastros' },
  { href: '/packages', label: 'Pacotes' },
  { href: '/additional-items', label: 'Cadastro de itens' },
  { href: '/commercial-rules', label: 'Regras' },
  { href: '/packages/images', label: 'Imagens' },
  { href: '/users', label: 'Usuários' },
  { href: '/profile', label: 'Perfil' },
] as const

function isNavActive(pathname: string, href: string) {
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
  if (href === '/users') {
    return pathname === '/users' || pathname.startsWith('/users/')
  }
  if (href === '/profile') {
    return pathname === '/profile' || pathname.startsWith('/profile/')
  }
  return pathname === href
}

export default function AppMainNav({ className = '' }: { className?: string }) {
  const pathname = usePathname() ?? ''
  const isNewQuoteActive =
    pathname === '/quotes/new' || pathname.startsWith('/quotes/new/')

  return (
    <div className={`w-full ${className}`}>
      <TenantContextBar />
      <AuthSessionBar />
      <nav
        className={`mt-2 ${glassTabsNav()}`}
        aria-label="Navegação principal"
      >
        {NAV_LINKS.map((link) => {
          const active = isNavActive(pathname, link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={glassTabLink(active)}
            >
              {link.label}
            </Link>
          )
        })}
        <Link
          href="/quotes/new"
          className={
            isNewQuoteActive ? glassTabLink(true) : glassBtn('primary')
          }
        >
          Nova cotação
        </Link>
      </nav>
      <BuildVersionBadge className="mt-2 hidden sm:block" />
    </div>
  )
}

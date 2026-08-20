'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { tInventoryUi } from '@/Lib/i18n/inventoryUi'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

const LINKS = [
  { href: '/estoque', key: 'navOverview' as const, exact: true },
  { href: '/estoque/disponibilidade', key: 'navAvailability' as const },
  { href: '/estoque/reservas', key: 'navCommitments' as const },
  { href: '/estoque/kardex', key: 'navKardex' as const },
  { href: '/estoque/documentos', key: 'navDocuments' as const },
  { href: '/estoque/locais', key: 'navLocations' as const },
  { href: '/estoque/lotes', key: 'navLots' as const },
]

export default function InventorySubnav() {
  const pathname = usePathname()
  const locale = useAuthLocaleFromMe()

  return (
    <nav
      aria-label={tInventoryUi(locale, 'title')}
      className="border-b border-cdl-border bg-cdl-bg/80"
    >
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {LINKS.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-cdl-surface text-cdl-fg shadow-sm'
                  : 'text-cdl-muted hover:bg-cdl-surface/60 hover:text-cdl-fg'
              }`}
            >
              {tInventoryUi(locale, link.key)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

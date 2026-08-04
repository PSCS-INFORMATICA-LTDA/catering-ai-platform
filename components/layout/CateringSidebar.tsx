'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/ThemeToggle'
import { CATERING_NAV, isNavHrefActive } from '@/components/layout/navConfig'

type Props = {
  collapsed: boolean
  mobileOpen: boolean
  onClose: () => void
  onToggleCollapsed: () => void
}

export function CateringSidebar({
  collapsed,
  mobileOpen,
  onClose,
  onToggleCollapsed,
}: Props) {
  const pathname = usePathname() ?? ''

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!mobileOpen}
        onClick={onClose}
      />

      <aside
        className={`catering-sidebar-shell fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 text-white transition-[width,transform] duration-200 ease-out lg:static lg:z-auto lg:h-full lg:min-h-0 lg:translate-x-0 lg:self-stretch ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'lg:w-[3.75rem]' : 'w-[min(20.5rem,92vw)] lg:w-72'}`}
        aria-label="Menu principal"
      >
        {/* Desktop recolhido: só o botão para expandir (como Logistics/Cursor). */}
        {collapsed ? (
          <div className="hidden h-full flex-col items-center gap-3 py-3 lg:flex">
            <Link
              href="/quotes"
              onClick={onClose}
              title="Catering AI Platform"
              className="px-1"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/catering-logo-dark.png"
                alt="Catering AI Platform"
                width={48}
                height={48}
                className="h-10 w-10 object-contain"
              />
            </Link>
            <button
              type="button"
              className="catering-sidebar-expand-btn"
              aria-label="Expandir menu"
              title="Expandir menu"
              onClick={onToggleCollapsed}
            >
              »
            </button>
            <span className="mt-auto text-[0.55rem] text-white/35">PSCS</span>
          </div>
        ) : null}

        {/* Expandido (desktop) + drawer mobile */}
        <div
          className={`flex h-full min-h-0 flex-col ${
            collapsed ? 'lg:hidden' : ''
          }`}
        >
          <div className="flex items-start gap-2 border-b border-white/10 px-3 py-3">
            <Link
              href="/quotes"
              className="min-w-0 flex-1"
              onClick={onClose}
              title="Catering AI Platform"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/catering-logo-dark.png"
                alt="Catering AI Platform"
                width={360}
                height={210}
                className="h-auto w-full max-w-[11rem] object-contain"
              />
            </Link>
            <button
              type="button"
              className="catering-sidebar-icon-btn hidden lg:inline-flex"
              aria-label="Recolher menu"
              title="Recolher menu"
              onClick={onToggleCollapsed}
            >
              «
            </button>
            <button
              type="button"
              className="catering-sidebar-icon-btn lg:hidden"
              aria-label="Fechar menu"
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          <div className="border-b border-white/10 px-3 py-3">
            <ThemeToggle className="w-full justify-center" />
          </div>

          <nav className="flex-1 overflow-y-auto overscroll-contain px-2 py-3 [-webkit-overflow-scrolling:touch]">
            {CATERING_NAV.map((group) => (
              <div
                key={group.label}
                className="catering-sidebar-group"
                aria-label={group.label}
              >
                <p className="catering-sidebar-group-label">{group.label}</p>
                {group.children.map((child) => {
                  if (child.soon) {
                    return (
                      <span
                        key={`${group.label}-${child.label}`}
                        className="catering-sidebar-nav-btn catering-sidebar-nav-btn--soon"
                        title="Em breve"
                      >
                        {child.label}
                      </span>
                    )
                  }
                  const active = isNavHrefActive(pathname, child.href)
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      title={child.label}
                      onClick={onClose}
                      className={`catering-sidebar-nav-btn ${
                        active ? 'catering-sidebar-nav-btn--active' : ''
                      }`}
                    >
                      {child.label}
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>

          <footer className="border-t border-white/10 px-3 py-3">
            <p className="text-center text-[0.65rem] text-white/40">
              PSCS Informática
            </p>
          </footer>
        </div>
      </aside>
    </>
  )
}

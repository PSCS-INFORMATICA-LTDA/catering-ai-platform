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
        } ${collapsed ? 'lg:w-[4.5rem]' : 'w-[min(20.5rem,92vw)] lg:w-72'}`}
        aria-label="Menu principal"
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
          {!collapsed ? (
            <Link
              href="/quotes"
              className="min-w-0 flex-1"
              onClick={onClose}
              title="Catering AI Platform"
            >
              {/* Logo clara no fundo escuro do menu (versão dark-theme). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/catering-logo-dark.png"
                alt="Catering AI Platform"
                width={360}
                height={210}
                className="h-auto w-full max-w-[11rem] object-contain"
              />
            </Link>
          ) : (
            <Link
              href="/quotes"
              className="mx-auto text-xs font-black tracking-wider text-white/90"
              onClick={onClose}
            >
              CAP
            </Link>
          )}
          <button
            type="button"
            className="catering-sidebar-icon-btn hidden lg:inline-flex"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            onClick={onToggleCollapsed}
          >
            {collapsed ? '»' : '«'}
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

        {!collapsed ? (
          <div className="border-b border-white/10 px-3 py-3">
            <ThemeToggle className="w-full justify-center" />
          </div>
        ) : (
          <div className="border-b border-white/10 px-2 py-3">
            <ThemeToggle className="w-full !min-h-10 !px-0 justify-center [&>span:last-child]:hidden" />
          </div>
        )}

        <nav className="flex-1 overflow-y-auto overscroll-contain px-2 py-3 [-webkit-overflow-scrolling:touch]">
          {CATERING_NAV.map((group) => (
            <div
              key={group.label}
              className="catering-sidebar-group"
              aria-label={group.label}
            >
              {!collapsed ? (
                <p className="catering-sidebar-group-label">{group.label}</p>
              ) : (
                <p className="mb-1 truncate px-1 text-center text-[0.55rem] font-semibold uppercase tracking-wider text-white/35">
                  {group.label.slice(0, 3)}
                </p>
              )}
              {group.children.map((child) => {
                if (child.soon) {
                  return (
                    <span
                      key={`${group.label}-${child.label}`}
                      className="catering-sidebar-nav-btn catering-sidebar-nav-btn--soon"
                      title="Em breve"
                    >
                      {!collapsed ? child.label : '·'}
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
                    } ${collapsed ? 'justify-center px-2' : ''}`}
                  >
                    {collapsed ? child.label.slice(0, 1) : child.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <footer className="border-t border-white/10 px-3 py-3">
          <p className="text-center text-[0.65rem] text-white/40">
            {collapsed ? 'PSCS' : 'PSCS Informática'}
          </p>
        </footer>
      </aside>
    </>
  )
}

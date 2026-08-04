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

/** Ícone de painel lateral (estilo Cursor) — abre/fecha o menu. */
function SidebarPanelIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.25" />
      <path d="M9.5 4.5v15" />
    </svg>
  )
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
        } ${collapsed ? 'lg:w-[3.75rem]' : 'w-[min(20.5rem,92vw)] lg:w-80'}`}
        aria-label="Menu principal"
      >
        {/* Desktop recolhido */}
        {collapsed ? (
          <div className="hidden h-full flex-col items-center gap-2 py-2.5 lg:flex">
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
                width={36}
                height={36}
                className="h-8 w-8 object-contain"
              />
            </Link>
            <button
              type="button"
              className="catering-sidebar-panel-btn"
              aria-label="Expandir menu"
              title="Expandir menu"
              onClick={onToggleCollapsed}
            >
              <SidebarPanelIcon className="h-3 w-3" />
            </button>
            <div className="mt-auto flex flex-col items-center gap-2 px-1 pb-1">
              <ThemeToggle className="catering-sidebar-theme-toggle catering-sidebar-theme-toggle--icon !px-0 justify-center [&>span:last-child]:sr-only" />
              <span className="text-[0.55rem] text-white/35">PSCS</span>
            </div>
          </div>
        ) : null}

        {/* Expandido (desktop) + drawer mobile */}
        <div
          className={`flex h-full min-h-0 flex-col ${
            collapsed ? 'lg:hidden' : ''
          }`}
        >
          <div className="catering-sidebar-brand-zone">
            <Link
              href="/quotes"
              className="catering-sidebar-brand-link"
              onClick={onClose}
              title="Catering AI Platform"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/catering-logo-dark.png"
                alt="Catering AI Platform"
                width={220}
                height={83}
                className="catering-sidebar-brand-logo"
              />
            </Link>
            {/* Desktop: janela na reta da barra de rolagem, tamanho dos botões do menu */}
            <button
              type="button"
              className="catering-sidebar-panel-btn catering-sidebar-panel-btn--desktop"
              aria-label="Recolher menu"
              title="Recolher menu"
              onClick={onToggleCollapsed}
            >
              <SidebarPanelIcon className="h-4 w-4" />
            </button>
            {/* Só mobile */}
            <button
              type="button"
              className="catering-sidebar-close-btn"
              aria-label="Fechar menu"
              onClick={onClose}
            >
              ✕
            </button>
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

          <footer className="mt-auto space-y-2 border-t border-white/10 px-3 py-2.5">
            <ThemeToggle className="catering-sidebar-theme-toggle w-full justify-center" />
            <p className="text-center text-[0.65rem] text-white/40">
              PSCS Informática
            </p>
          </footer>
        </div>
      </aside>
    </>
  )
}

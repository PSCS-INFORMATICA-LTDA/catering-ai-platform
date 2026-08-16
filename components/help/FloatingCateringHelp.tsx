'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTenant } from '@/components/tenant/TenantProvider'
import { resolveCompanyBrand } from '@/Lib/help/companyBranding'
import CompanyHelpAvatar from '@/components/help/CompanyHelpAvatar'
import HelpMiniChat from '@/components/help/HelpMiniChat'
import { isHelpHiddenRoute, isQuoteFlowRoute } from '@/components/help/helpContext'
import { useFloatingHelpBehavior } from '@/components/help/useFloatingHelpBehavior'
import { tHelp } from '@/Lib/i18n/help'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

export type FloatingCateringHelpProps = {
  disabled?: boolean
  disabledRoutes?: string[]
  quoteId?: string | null
  packageId?: string | null
  userRole?: string | null
}

export default function FloatingCateringHelp({
  disabled = false,
  disabledRoutes = [],
}: FloatingCateringHelpProps = {}) {
  const pathname = usePathname() ?? ''
  const locale = useAuthLocaleFromMe()
  const { companyId, company } = useTenant()
  const [open, setOpen] = useState(false)

  const brand = useMemo(
    () => resolveCompanyBrand(companyId, company),
    [companyId, company],
  )

  const { hintText, hintVisible, clearHint } = useFloatingHelpBehavior(
    pathname,
    open,
    locale,
  )

  const hidden =
    disabled ||
    isHelpHiddenRoute(pathname) ||
    disabledRoutes.some(
      (route) =>
        pathname === route || pathname.startsWith(`${route}/`),
    )

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (hidden) return null

  const quoteFlow = isQuoteFlowRoute(pathname)
  const buttonBottomClass = quoteFlow
    ? 'bottom-[calc(env(safe-area-inset-bottom)+96px)] md:bottom-6'
    : 'bottom-[calc(env(safe-area-inset-bottom)+80px)] md:bottom-6'
  const chatBottomClass = quoteFlow
    ? 'bottom-[calc(env(safe-area-inset-bottom)+168px)] md:bottom-24'
    : 'bottom-[calc(env(safe-area-inset-bottom)+150px)] md:bottom-24'

  function handleOpen() {
    clearHint()
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
  }

  return (
    <>
      {open ? (
        <div
          className={`fixed right-4 z-[9998] sm:right-5 ${chatBottomClass}`}
        >
          <HelpMiniChat
            brand={brand}
            pathname={pathname}
            onClose={handleClose}
          />
        </div>
      ) : null}

      {!open && hintVisible ? (
        <div
          className={`fixed right-4 z-[9997] max-w-[min(14rem,calc(100vw-5.5rem))] sm:right-5 ${buttonBottomClass}`}
          style={{ transform: 'translateY(calc(-100% - 0.5rem))' }}
        >
          <button
            type="button"
            onClick={handleOpen}
            className="w-full rounded-2xl rounded-br-sm border border-neutral-200 bg-white px-3 py-2 text-left text-xs leading-snug text-neutral-700 shadow-md dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          >
            {hintText}
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => (open ? handleClose() : handleOpen())}
        className={`fixed right-4 z-[9999] flex items-center gap-2 rounded-full border border-neutral-200 bg-white/95 shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition hover:shadow-[0_10px_28px_rgba(0,0,0,0.2)] dark:border-neutral-700 dark:bg-neutral-900/95 sm:right-5 ${buttonBottomClass} ${
          open ? 'ring-2 ring-neutral-300 dark:ring-neutral-600' : ''
        }`}
        aria-label={tHelp(locale, 'openHelp')}
        aria-expanded={open}
      >
        <div className="h-10 w-10 shrink-0 p-0.5 sm:h-11 sm:w-11">
          <CompanyHelpAvatar brand={brand} size="sm" className="h-full w-full" />
        </div>
        <span className="hidden pr-3 text-xs font-semibold text-neutral-800 dark:text-neutral-100 md:inline">
          {tHelp(locale, 'help')}
        </span>
      </button>
    </>
  )
}

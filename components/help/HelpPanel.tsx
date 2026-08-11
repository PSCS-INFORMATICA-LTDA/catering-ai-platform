'use client'

import type { CompanyBrand } from '@/Lib/help/companyBranding'
import CompanyHelpAvatar from '@/components/help/CompanyHelpAvatar'
import type { HelpRouteContext } from '@/components/help/helpContext'
import {
  getHelpActionLabels,
  type HelpAction,
  buildHelpActionResponse,
} from '@/components/help/helpHints'
import { tHelp } from '@/Lib/i18n/help'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

function IconClose({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

const PRIMARY_ACTIONS: HelpAction[] = [
  'explain',
  'pending',
  'next',
  'tips',
]
const SECONDARY_ACTIONS: HelpAction[] = ['support', 'whatsapp']

export default function HelpPanel({
  brand,
  routeContext,
  pathname,
  activeAction,
  responseText,
  onAction,
  onClose,
}: {
  brand: CompanyBrand
  routeContext: HelpRouteContext
  pathname: string
  activeAction: HelpAction | null
  responseText: string | null
  onAction: (action: HelpAction) => void
  onClose: () => void
}) {
  const locale = useAuthLocaleFromMe()
  const actionLabels = getHelpActionLabels(locale)
  const displayResponse =
    responseText ??
    buildHelpActionResponse('explain', pathname, routeContext, brand.displayName)

  return (
    <div
      className="flex max-h-[min(70vh,32rem)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.22)] dark:border-neutral-700 dark:bg-neutral-900"
      role="dialog"
      aria-label={tHelp(locale, 'helpCenter')}
    >
      <div className="flex items-start gap-3 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <CompanyHelpAvatar brand={brand} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-neutral-900 dark:text-white">
            {brand.displayName}
          </p>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            {tHelp(locale, 'helpCenter')}
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500">
            {tHelp(locale, 'contextualHelp')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label={tHelp(locale, 'closeHelp')}
        >
          <IconClose />
        </button>
      </div>

      <div className="space-y-3 overflow-y-auto p-4">
        <div className="rounded-xl bg-neutral-50 px-3 py-3 dark:bg-neutral-800/60">
          <p className="text-sm font-bold text-neutral-900 dark:text-white">
            {routeContext.title}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
            {routeContext.description}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {PRIMARY_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onAction(action)}
              className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${
                activeAction === action
                  ? 'border-neutral-400 bg-neutral-100 text-neutral-900 dark:border-neutral-500 dark:bg-neutral-800 dark:text-white'
                  : 'border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              {actionLabels[action]}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {SECONDARY_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onAction(action)}
              className={`rounded-xl border border-dashed px-3 py-2 text-left text-xs font-medium transition ${
                activeAction === action
                  ? 'border-neutral-400 bg-neutral-50 text-neutral-900 dark:border-neutral-500 dark:bg-neutral-800'
                  : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400'
              }`}
            >
              {actionLabels[action]}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-neutral-100 bg-white px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900/50">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
            {tHelp(locale, 'response')}
          </p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">
            {displayResponse}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-100 px-3 py-2 dark:border-neutral-800">
          <p className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
            {tHelp(locale, 'quickChecklist')}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-300">
            {routeContext.quickTips.map((tip) => (
              <li key={tip}>· {tip}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

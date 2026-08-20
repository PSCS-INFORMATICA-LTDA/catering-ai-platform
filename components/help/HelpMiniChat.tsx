'use client'

import { useState, type ReactNode } from 'react'
import type { CompanyBrand } from '@/Lib/help/companyBranding'
import CompanyHelpAvatar from '@/components/help/CompanyHelpAvatar'
import {
  getChatChipsForRoute,
  getContextChatMessage,
  getHelpGreeting,
  resolveHelpHeaderTitle,
  type HelpChatChip,
} from '@/components/help/helpChat'
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

function ChatBubble({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-neutral-100 px-3 py-2 text-sm leading-snug text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
      {children}
    </div>
  )
}

export default function HelpMiniChat({
  brand,
  pathname,
  onClose,
}: {
  brand: CompanyBrand
  pathname: string
  onClose: () => void
}) {
  const locale = useAuthLocaleFromMe()
  const [reply, setReply] = useState<string | null>(null)
  const chips = getChatChipsForRoute(pathname, locale).slice(0, 3)
  const headerTitle = resolveHelpHeaderTitle(brand.displayName, locale)

  function handleChip(chip: HelpChatChip) {
    setReply(chip.response)
  }

  return (
    <div
      className="flex max-h-[45vh] w-[320px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)] dark:border-neutral-700 dark:bg-neutral-900"
      role="dialog"
      aria-label={tHelp(locale, 'helpDialog')}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-100 px-3 py-2.5 dark:border-neutral-800">
        <CompanyHelpAvatar brand={brand} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-neutral-900 dark:text-white">
            {headerTitle}
          </p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
            {tHelp(locale, 'onlineNow')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label={tHelp(locale, 'closeHelp')}
        >
          <IconClose />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        <ChatBubble>{getHelpGreeting(locale)}</ChatBubble>
        <ChatBubble>{getContextChatMessage(pathname)}</ChatBubble>
        {reply ? <ChatBubble>{reply}</ChatBubble> : null}
      </div>

      <div className="shrink-0 border-t border-neutral-100 px-3 py-2.5 dark:border-neutral-800">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => handleChip(chip)}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

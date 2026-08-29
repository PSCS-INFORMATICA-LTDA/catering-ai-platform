'use client'

import { useRef } from 'react'
import { revealNextBlockWhenReady } from '@/Lib/revealFloatingPanel'
import {
  getCommercialOptionGroupLabel,
  sortOptionGroupsForQuote,
} from '@/Lib/packageQuoteDisplay'
import { isRequiredOptionGroup, type PackageOptionGroup } from '@/Lib/packageOptionGroups'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import { tw } from '@/Lib/quoteTranslations'
import { pickLocalizedText } from '@/Lib/i18n/locales'
import { resolveSausageDisplayLabel } from '@/Lib/publicQuote/sausageOptions'

const SELECTED_OPTION_CLASS =
  'border-[var(--brand-primary-2)] bg-[color-mix(in_srgb,var(--brand-primary)_10%,white)] text-[var(--brand-primary)] ring-1 ring-[color-mix(in_srgb,var(--brand-primary-2)_35%,transparent)]'

export default function PackageIncludedOptions({
  optionGroups,
  selections,
  onChange,
  language = 'pt',
  mode = 'select',
  pendingGroupIds = [],
  onlyGroupKeys,
}: {
  optionGroups: ReadonlyArray<PackageOptionGroup>
  selections: Record<string, string>
  onChange?: (groupId: string, itemId: string) => void
  language?: QuoteLanguage
  mode?: 'select' | 'summary'
  pendingGroupIds?: string[]
  onlyGroupKeys?: ReadonlyArray<string>
}) {
  const allowedKeys = onlyGroupKeys?.map((key) => key.trim().toUpperCase()) ?? null
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const activeGroups = sortOptionGroupsForQuote(optionGroups).filter((group) => {
    if (!allowedKeys?.length) return true
    const key = group.option_group_key?.trim().toUpperCase() ?? ''
    return allowedKeys.includes(key)
  })

  if (activeGroups.length === 0) return null

  if (mode === 'summary') {
    const selectableGroups = activeGroups.filter(
      (group) => (group.items?.length ?? 0) > 0,
    )

    return (
      <div className="space-y-2">
        {selectableGroups.map((group) => {
          const selectedId = selections[group.id]?.trim()
          const item = group.items.find((row) => row.id === selectedId)
          if (!item) return null
          const label =
            resolveSausageDisplayLabel(item, language) ||
            pickLocalizedText(
              { pt: item.label_pt, en: item.label_en, es: item.label_es },
              language,
            ) ||
            item.option_item_key ||
            '—'
          const groupLabel = getCommercialOptionGroupLabel(group, language)
          return (
            <p key={group.id} className="text-sm text-neutral-800">
              <span className="font-semibold text-neutral-900">{groupLabel}:</span>{' '}
              {label}
            </p>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {activeGroups.map((group, groupIndex) => {
        const groupLabel = getCommercialOptionGroupLabel(group, language)
        const required = isRequiredOptionGroup(group)
        const selectedItemId = selections[group.id] ?? null
        const isPending = pendingGroupIds.includes(group.id)
        const items = group.items ?? []
        const nextGroup = activeGroups[groupIndex + 1] ?? null

        return (
          <div
            key={group.id}
            ref={(node) => {
              groupRefs.current[group.id] = node
            }}
            data-package-option-group={group.id}
            className={`rounded-xl border bg-white px-3 py-2.5 ${
              isPending
                ? 'border-[color-mix(in_srgb,var(--brand-primary-2)_35%,transparent)] bg-[color-mix(in_srgb,var(--brand-primary)_6%,white)]'
                : 'border-neutral-200'
            }`}
          >
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-sm font-bold text-neutral-900">{groupLabel}</p>
              {required ? (
                <span className="text-[10px] font-medium text-neutral-500">
                  {tw(language, 'required')}
                </span>
              ) : null}
            </div>

            {isPending ? (
              <p className="mb-2 text-xs text-[var(--brand-primary)]">
                {tw(language, 'chooseOption')}
              </p>
            ) : null}

            {items.length === 0 ? (
              <p className="text-xs text-neutral-500">
                {tw(language, 'optionsUnavailable')}
              </p>
            ) : (
              <div
                className="grid grid-cols-2 gap-2"
                role="group"
                aria-label={groupLabel}
              >
                {items.map((item) => {
                  const active = selectedItemId === item.id
                  const itemLabel =
                    resolveSausageDisplayLabel(item, language) ||
                    pickLocalizedText(
                      {
                        pt: item.label_pt,
                        en: item.label_en,
                        es: item.label_es,
                      },
                      language,
                    ) ||
                    item.option_item_key?.trim() ||
                    '—'
                  return (
                    <button
                      key={`${group.id}-${item.id}`}
                      type="button"
                      onClick={(event) => {
                        onChange?.(group.id, item.id)
                        // Only when a further group exists, and only far enough
                        // to show it starts — the chosen chip stays on screen.
                        if (!nextGroup) return
                        const chip = event.currentTarget
                        revealNextBlockWhenReady(
                          () => chip,
                          () => groupRefs.current[nextGroup.id] ?? null,
                        )
                      }}
                      aria-pressed={active}
                      className={`min-h-[2.5rem] rounded-lg border px-2 py-2 text-center text-xs font-semibold leading-tight transition sm:text-sm ${
                        active
                          ? SELECTED_OPTION_CLASS
                          : 'border-neutral-200 bg-neutral-50 text-neutral-800 hover:border-neutral-300 hover:bg-white'
                      }`}
                    >
                      {itemLabel}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

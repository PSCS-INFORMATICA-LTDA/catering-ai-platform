'use client'

import { useState } from 'react'
import {
  BackofficeBtnDanger,
  BackofficeBtnOutline,
  BackofficeBtnPrimary,
  BackofficeBtnSecondary,
  BackofficeStatusBadge,
} from '@/components/backoffice/BackofficeCardPrimitives'
import { PremiumCard } from '@/components/premium/PremiumPrimitives'
import type { CommercialRuleRow } from '@/Lib/commercialRulesTableSchema'
import { formatCommercialRuleDisplayValue } from '@/Lib/commercialRulesTableSchema'
import { getCommercialRuleDescription } from '@/Lib/getCommercialRuleDescription'
import { tCommon } from '@/Lib/i18n/common'
import { toBcp47Locale } from '@/Lib/i18n/locales'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

type RuleDraft = {
  rule_key: string
  rule_value: {
    value: string | number | boolean
    type: string
    label_pt: string
    unit?: string
  }
  active: boolean
}

function isLongTextType(type: string) {
  return type === 'long_text' || type === 'text' || type === 'json'
}

export default function RuleCard({
  row,
  editing,
  draft,
  saving,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDeactivate,
  onDuplicate,
  onDraftChange,
  onDraftValueChange,
}: {
  row: CommercialRuleRow
  editing: boolean
  draft: RuleDraft
  saving: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
  onDeactivate: () => void
  onDuplicate: () => void
  onDraftChange: (patch: Partial<RuleDraft>) => void
  onDraftValueChange: (value: string) => void
}) {
  const locale = useAuthLocaleFromMe()
  const [expanded, setExpanded] = useState(false)
  const label = getCommercialRuleDescription(row.rule_key, row.rule_value)
  const display = formatCommercialRuleDisplayValue(row.rule_value)
  const ruleType = row.rule_value?.type ?? 'text'

  return (
    <PremiumCard>
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-start justify-between gap-4 p-5 text-left transition hover:bg-neutral-50/80"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-500">
              {row.rule_key}
            </span>
            <BackofficeStatusBadge active={row.active !== false} />
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-600">
              {ruleType}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-bold text-neutral-900">{label}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{display}</p>
        </div>
        <span className="text-sm text-red-600">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded ? (
        <div className="border-t border-neutral-100 p-5">
          {editing ? (
            <div className="space-y-3">
              <input
                value={draft.rule_key}
                onChange={(e) => onDraftChange({ rule_key: e.target.value })}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm font-mono"
                placeholder="rule_key"
              />
              {isLongTextType(draft.rule_value.type) ? (
                <textarea
                  rows={3}
                  value={String(draft.rule_value.value ?? '')}
                  onChange={(e) => onDraftValueChange(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              ) : (
                <input
                  value={String(draft.rule_value.value ?? '')}
                  onChange={(e) => onDraftValueChange(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              )}
              <select
                value={draft.rule_value.type}
                onChange={(e) =>
                  onDraftChange({
                    rule_value: { ...draft.rule_value, type: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="text">text</option>
                <option value="number">number</option>
                <option value="long_text">long_text</option>
                <option value="json">json</option>
                <option value="boolean">boolean</option>
              </select>
              <input
                value={draft.rule_value.label_pt ?? ''}
                onChange={(e) =>
                  onDraftChange({
                    rule_value: { ...draft.rule_value, label_pt: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                placeholder={tCommon(locale, 'labelPt')}
              />
              <div className="flex flex-wrap gap-2">
                <BackofficeBtnPrimary onClick={onSave} disabled={saving}>
                  {saving ? tCommon(locale, 'saving') : tCommon(locale, 'save')}
                </BackofficeBtnPrimary>
                <BackofficeBtnSecondary onClick={onCancelEdit}>
                  {tCommon(locale, 'cancel')}
                </BackofficeBtnSecondary>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3 text-sm text-neutral-700">
                <p>
                  <span className="font-bold">{tCommon(locale, 'value')}:</span>{' '}
                  {display}
                </p>
                <p>
                  <span className="font-bold">{tCommon(locale, 'type')}:</span>{' '}
                  {ruleType}
                </p>
                {row.updated_at ? (
                  <p>
                    <span className="font-bold">{tCommon(locale, 'updatedAt')}:</span>{' '}
                    {new Date(row.updated_at).toLocaleString(toBcp47Locale(locale))}
                  </p>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <BackofficeBtnSecondary onClick={onStartEdit}>
                  {tCommon(locale, 'edit')}
                </BackofficeBtnSecondary>
                <BackofficeBtnOutline accent onClick={onDuplicate}>
                  {tCommon(locale, 'duplicate')}
                </BackofficeBtnOutline>
                {row.active !== false ? (
                  <BackofficeBtnDanger onClick={onDeactivate}>
                    {tCommon(locale, 'deactivate')}
                  </BackofficeBtnDanger>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </PremiumCard>
  )
}

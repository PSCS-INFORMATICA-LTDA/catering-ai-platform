'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BackofficeBtnOutline,
  BackofficeBtnPrimary,
  BackofficeField,
  BackofficeInput,
} from '@/components/backoffice/BackofficeCardPrimitives'
import { BackofficeFormSectionTitle } from '@/components/backoffice/BackofficeSectionPrimitives'
import { tCommon } from '@/Lib/i18n/common'
import { tInventoryUi } from '@/Lib/i18n/inventoryUi'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import {
  BOM_CALCULATION_TYPES,
  BOM_GUEST_BASES,
  BOM_ROUNDING_RULES,
  type BomCalculationType,
  type BomGuestBasis,
  type BomRoundingRule,
  type BomSourceType,
  type BomTierBand,
} from '@/Lib/orders/operationalMaterialBom'
import { MATERIAL_TYPES, type MaterialType } from '@/Lib/orders/orderMaterials'

type RuleRow = {
  id: string
  source_type: BomSourceType
  source_id: string
  material_description_snapshot: string
  material_type: MaterialType
  unit: string
  calculation_type: BomCalculationType
  fixed_quantity: number | null
  quantity_per_guest: number | null
  guest_basis: BomGuestBasis | null
  tier_json: BomTierBand[] | null
  rounding_rule: BomRoundingRule
  enabled: boolean
  sort_order: number
  notes: string | null
}

const selectClass =
  'w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 outline-none'

const emptyForm = {
  material_description_snapshot: '',
  material_type: 'consumable' as MaterialType,
  unit: 'unit',
  calculation_type: 'fixed' as BomCalculationType,
  fixed_quantity: '1',
  quantity_per_guest: '1',
  guest_basis: 'billable_guests' as BomGuestBasis,
  rounding_rule: 'none' as BomRoundingRule,
  tier_text: '1-30=1\n31-60=2\n61-100=3',
  notes: '',
}

function parseTierText(text: string): BomTierBand[] {
  const bands: BomTierBand[] = []
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) continue
    const m = t.match(/^(\d+)\s*-\s*(\d+|\+)\s*=\s*([\d.]+)$/)
    if (!m) continue
    const min = Number(m[1])
    const max = m[2] === '+' ? null : Number(m[2])
    const quantity = Number(m[3])
    if (!Number.isFinite(min) || !Number.isFinite(quantity)) continue
    bands.push({ min_guests: min, max_guests: max, quantity })
  }
  return bands
}

function tierToText(bands: BomTierBand[] | null | undefined): string {
  if (!bands?.length) return ''
  return bands
    .map((b) =>
      b.max_guests == null
        ? `${b.min_guests}-+=${b.quantity}`
        : `${b.min_guests}-${b.max_guests}=${b.quantity}`,
    )
    .join('\n')
}

export default function OperationalMaterialsBomPanel({
  sourceType,
  sourceId,
  canManage,
}: {
  sourceType: 'package' | 'additional'
  sourceId: string
  canManage: boolean
}) {
  const locale = useAuthLocaleFromMe()
  const [rows, setRows] = useState<RuleRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const reload = useCallback(async () => {
    const qs = new URLSearchParams({
      source_type: sourceType,
      source_id: sourceId,
    })
    const res = await fetch(`/api/materials/rules?${qs}`, { cache: 'no-store' })
    const json = (await res.json()) as { data?: RuleRow[]; error?: string }
    if (!res.ok) {
      setError(json.error || tInventoryUi(locale, 'loadBomFailed'))
      return
    }
    setRows(json.data ?? [])
    setError(null)
  }, [sourceType, sourceId, locale])

  useEffect(() => {
    void reload()
  }, [reload])

  async function createRule() {
    setBusy(true)
    setError(null)
    try {
      const tier_json =
        form.calculation_type === 'tier' ? parseTierText(form.tier_text) : []
      const res = await fetch('/api/materials/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: sourceType,
          source_id: sourceId,
          material_description_snapshot: form.material_description_snapshot,
          material_type: form.material_type,
          unit: form.unit,
          calculation_type: form.calculation_type,
          fixed_quantity:
            form.calculation_type === 'fixed'
              ? Number(form.fixed_quantity)
              : null,
          quantity_per_guest:
            form.calculation_type === 'per_guest'
              ? Number(form.quantity_per_guest)
              : null,
          guest_basis:
            form.calculation_type === 'fixed' ? null : form.guest_basis,
          tier_json,
          rounding_rule: form.rounding_rule,
          notes: form.notes || null,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(json.error || tInventoryUi(locale, 'createFailed'))
        return
      }
      setShowAdd(false)
      setForm(emptyForm)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function toggleEnabled(rule: RuleRow) {
    setBusy(true)
    try {
      const res = await fetch(`/api/materials/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(json.error || tInventoryUi(locale, 'updateFailed'))
        return
      }
      await reload()
    } finally {
      setBusy(false)
    }
  }

  function methodLabel(r: RuleRow): string {
    if (r.calculation_type === 'fixed') {
      return tInventoryUi(locale, 'methodFixed', { qty: r.fixed_quantity ?? 0 })
    }
    if (r.calculation_type === 'per_guest') {
      return `${r.quantity_per_guest ?? 0}/${r.guest_basis ?? 'billable_guests'} (${r.rounding_rule})`
    }
    return tInventoryUi(locale, 'methodTier', {
      count: (r.tier_json ?? []).length,
    })
  }

  return (
    <section className="mt-6 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackofficeFormSectionTitle>
          {tInventoryUi(locale, 'bomTitle')}
        </BackofficeFormSectionTitle>
        {canManage ? (
          <BackofficeBtnPrimary
            disabled={busy}
            onClick={() => setShowAdd((v) => !v)}
          >
            {tInventoryUi(locale, 'addMaterial')}
          </BackofficeBtnPrimary>
        ) : null}
      </div>
      <p className="text-xs text-neutral-500">
        {tInventoryUi(locale, 'bomHint')}
      </p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {showAdd ? (
        <div className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-3 sm:grid-cols-2">
          <BackofficeField label={tInventoryUi(locale, 'material')} className="sm:col-span-2">
            <BackofficeInput
              value={form.material_description_snapshot}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  material_description_snapshot: v,
                }))
              }
            />
          </BackofficeField>
          <BackofficeField label={tInventoryUi(locale, 'type')}>
            <select
              className={selectClass}
              value={form.material_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  material_type: e.target.value as MaterialType,
                }))
              }
            >
              {MATERIAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </BackofficeField>
          <BackofficeField label={tCommon(locale, 'unit')}>
            <BackofficeInput
              value={form.unit}
              onChange={(v) => setForm((f) => ({ ...f, unit: v }))}
            />
          </BackofficeField>
          <BackofficeField label={tInventoryUi(locale, 'method')}>
            <select
              className={selectClass}
              value={form.calculation_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  calculation_type: e.target.value as BomCalculationType,
                }))
              }
            >
              {BOM_CALCULATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </BackofficeField>
          <BackofficeField label={tInventoryUi(locale, 'rounding')}>
            <select
              className={selectClass}
              value={form.rounding_rule}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  rounding_rule: e.target.value as BomRoundingRule,
                }))
              }
            >
              {BOM_ROUNDING_RULES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </BackofficeField>
          {form.calculation_type === 'fixed' ? (
            <BackofficeField label={tInventoryUi(locale, 'fixedQty')}>
              <BackofficeInput
                type="number"
                value={form.fixed_quantity}
                onChange={(v) =>
                  setForm((f) => ({ ...f, fixed_quantity: v }))
                }
              />
            </BackofficeField>
          ) : null}
          {form.calculation_type === 'per_guest' ? (
            <>
              <BackofficeField label={tInventoryUi(locale, 'qtyPerGuest')}>
                <BackofficeInput
                  type="number"
                  value={form.quantity_per_guest}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, quantity_per_guest: v }))
                  }
                />
              </BackofficeField>
              <BackofficeField label={tInventoryUi(locale, 'basis')}>
                <select
                  className={selectClass}
                  value={form.guest_basis}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      guest_basis: e.target.value as BomGuestBasis,
                    }))
                  }
                >
                  {BOM_GUEST_BASES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </BackofficeField>
            </>
          ) : null}
          {form.calculation_type === 'tier' ? (
            <BackofficeField label={tInventoryUi(locale, 'tiers')} className="sm:col-span-2">
              <textarea
                className={`${selectClass} min-h-[88px]`}
                value={form.tier_text}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tier_text: e.target.value }))
                }
              />
            </BackofficeField>
          ) : null}
          <div className="flex gap-2 sm:col-span-2">
            <BackofficeBtnPrimary
              disabled={busy || !form.material_description_snapshot.trim()}
              onClick={() => void createRule()}
            >
              {tInventoryUi(locale, 'saveRule')}
            </BackofficeBtnPrimary>
            <BackofficeBtnOutline onClick={() => setShowAdd(false)}>
              {tCommon(locale, 'close')}
            </BackofficeBtnOutline>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">{tInventoryUi(locale, 'emptyBom')}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <div>
                <p
                  className={`font-medium ${r.enabled ? 'text-neutral-900' : 'text-neutral-400 line-through'}`}
                >
                  {r.material_description_snapshot}
                </p>
                <p className="text-xs text-neutral-500">
                  {r.material_type} · {r.unit} · {methodLabel(r)}
                  {r.calculation_type === 'tier'
                    ? ` · ${tierToText(r.tier_json)}`
                    : ''}
                </p>
              </div>
              {canManage ? (
                <BackofficeBtnOutline
                  disabled={busy}
                  onClick={() => void toggleEnabled(r)}
                >
                  {r.enabled
                    ? tCommon(locale, 'deactivate')
                    : tCommon(locale, 'activate')}
                </BackofficeBtnOutline>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

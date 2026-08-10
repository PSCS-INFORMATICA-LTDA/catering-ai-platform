'use client'

import { useCallback, useEffect, useState } from 'react'
import { WhatsAppIcon } from '@/components/icons/ShareIcons'
import WhatsAppButton from '@/components/share/WhatsAppButton'
import {
  materialStatusLabel,
  materialTypeLabel,
  tQuotesOrders,
} from '@/Lib/i18n/quotesOrders'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { glassAction, glassBtn, glassField } from '@/Lib/liquidGlass'
import type {
  MaterialStatus,
  MaterialType,
  ServiceOrderMaterialRow,
} from '@/Lib/orders/orderMaterials'
import {
  canCloseMaterial,
  MATERIAL_TYPES,
  sortMaterialsForOperations,
} from '@/Lib/orders/orderMaterials'
import {
  formatWhatsAppPhoneDisplay,
  normalizeWhatsAppPhone,
} from '@/Lib/whatsapp'

function statusBadgeClass(status: MaterialStatus): string {
  switch (status) {
    case 'checked':
      return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100'
    case 'separated':
      return 'bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-100'
    case 'partial':
      return 'bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100'
    case 'divergence':
      return 'bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-100'
    case 'dispatched':
      return 'bg-violet-50 text-violet-800 dark:bg-violet-500/15 dark:text-violet-100'
    case 'returned':
      return 'bg-teal-50 text-teal-800 dark:bg-teal-500/15 dark:text-teal-100'
    case 'closed':
      return 'bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-neutral-200'
    case 'cancelled':
      return 'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300'
    default:
      return 'bg-neutral-50 text-neutral-700 dark:bg-white/5 dark:text-neutral-200'
  }
}

function materialOriginText(
  row: ServiceOrderMaterialRow,
  locale: ReturnType<typeof useAuthLocaleFromMe>,
): string {
  const origin =
    row.source_type === 'package'
      ? tQuotesOrders(locale, 'materialOriginPackage')
      : row.source_type === 'additional'
        ? tQuotesOrders(locale, 'materialOriginAdditional')
        : row.source_type === 'rule'
          ? tQuotesOrders(locale, 'materialOriginRule')
          : row.source_type === 'supplier'
            ? tQuotesOrders(locale, 'materialOriginSupplier')
            : tQuotesOrders(locale, 'materialOriginManual')
  return row.source_label_snapshot
    ? `${origin} ${row.source_label_snapshot}`
    : origin
}

function canRegisterReturn(row: ServiceOrderMaterialRow): boolean {
  return row.status === 'dispatched' || Number(row.dispatched_quantity) > 0
}

/** Sobra só faz sentido para consumível (carne, guarnição…). */
function canEditLeftover(row: ServiceOrderMaterialRow): boolean {
  return row.material_type === 'consumable'
}

/** Separação editável só antes da conferência fechada. */
function canEditSeparation(row: ServiceOrderMaterialRow): boolean {
  return (
    row.status === 'pending' ||
    row.status === 'partial' ||
    row.status === 'separated'
  )
}

/** Conferência: após salvar (status checked+) vira só leitura. */
function canEditCheck(row: ServiceOrderMaterialRow): boolean {
  return (
    row.status === 'pending' ||
    row.status === 'partial' ||
    row.status === 'separated' ||
    row.status === 'divergence'
  )
}

/** Cores por tipo — facilita montagem de malas (equipamento vs retornável vs consumível). */
function materialTypeBadgeClass(type: MaterialType): string {
  switch (type) {
    case 'equipment':
      return 'bg-sky-100 text-sky-900 ring-1 ring-sky-300/80 dark:bg-sky-500/25 dark:text-sky-100 dark:ring-sky-400/40'
    case 'returnable':
      return 'bg-indigo-950 text-indigo-50 ring-1 ring-indigo-800 dark:bg-indigo-900/80 dark:text-indigo-50 dark:ring-indigo-500/50'
    case 'consumable':
      return 'bg-amber-100 text-amber-950 ring-1 ring-amber-400/70 dark:bg-amber-500/20 dark:text-amber-100 dark:ring-amber-400/40'
    case 'disposable':
      return 'bg-stone-200 text-stone-800 ring-1 ring-stone-400/60 dark:bg-stone-500/25 dark:text-stone-100 dark:ring-stone-400/40'
    default:
      return 'bg-neutral-100 text-neutral-700 ring-1 ring-neutral-300 dark:bg-white/10 dark:text-neutral-200'
  }
}

function materialTypeRowClass(type: MaterialType): string {
  switch (type) {
    case 'equipment':
      return 'border-l-4 border-l-sky-500 bg-sky-50/40 dark:bg-sky-500/5'
    case 'returnable':
      return 'border-l-4 border-l-indigo-950 bg-indigo-950/[0.04] dark:bg-indigo-500/10'
    case 'consumable':
      return 'border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-500/5'
    case 'disposable':
      return 'border-l-4 border-l-stone-400 bg-stone-50/60 dark:bg-stone-500/5'
    default:
      return 'border-l-4 border-l-transparent'
  }
}

function MaterialTypeBadge({
  type,
  locale,
}: {
  type: MaterialType
  locale: ReturnType<typeof useAuthLocaleFromMe>
}) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide ${materialTypeBadgeClass(type)}`}
    >
      {materialTypeLabel(type, locale)}
    </span>
  )
}

type DispatchPrepareResult = {
  whatsapp_text?: string
  phone?: string | null
  confirm_url?: string | null
  divergences_pending?: number
}

export default function OrderMaterialsPanel({
  orderId,
  canPrepare,
  canCheck,
  canDispatch = false,
  canReturn = false,
}: {
  orderId: string
  canPrepare: boolean
  canCheck: boolean
  canDispatch?: boolean
  canReturn?: boolean
}) {
  const locale = useAuthLocaleFromMe()
  const [rows, setRows] = useState<ServiceOrderMaterialRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [draftSeparate, setDraftSeparate] = useState<Record<string, string>>({})
  const [draftCheck, setDraftCheck] = useState<Record<string, string>>({})
  const [draftReturn, setDraftReturn] = useState<Record<string, string>>({})
  const [draftLeftover, setDraftLeftover] = useState<Record<string, string>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    description_snapshot: '',
    material_type: 'consumable' as MaterialType,
    unit: 'unit',
    required_quantity: '1',
    notes: '',
  })
  const [dispatchPreviewOpen, setDispatchPreviewOpen] = useState(false)
  const [dispatchWhatsappText, setDispatchWhatsappText] = useState('')
  const [dispatchPhone, setDispatchPhone] = useState('')
  const [dispatchConfirmUrl, setDispatchConfirmUrl] = useState<string | null>(
    null,
  )
  const [leaderBlockReason, setLeaderBlockReason] = useState<string | null>(
    null,
  )

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/orders/${orderId}/materials`, {
      cache: 'no-store',
    })
    const json = (await res.json()) as {
      data?: ServiceOrderMaterialRow[]
      error?: string
    }
    if (!res.ok) {
      setError(json.error || 'Falha ao carregar materiais')
      return
    }
    setRows(json.data ?? [])
    setError(null)
  }, [orderId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function addMaterial() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: 'manual',
          description_snapshot: addForm.description_snapshot,
          material_type: addForm.material_type,
          unit: addForm.unit,
          required_quantity: Number(addForm.required_quantity),
          notes: addForm.notes || null,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(json.error || 'Falha ao adicionar')
        return
      }
      setShowAdd(false)
      setAddForm({
        description_snapshot: '',
        material_type: 'consumable',
        unit: 'unit',
        required_quantity: '1',
        notes: '',
      })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function patchMaterial(
    materialId: string,
    body: Record<string, unknown>,
  ) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/orders/${orderId}/materials/${materialId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(json.error || 'Falha ao atualizar')
        return
      }
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function prepareDispatch(revokeOnly = false) {
    setBusy(true)
    setError(null)
    setHint(null)
    if (!revokeOnly) setLeaderBlockReason(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/materials/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(revokeOnly ? { revoke_only: true } : {}),
      })
      const json = (await res.json()) as {
        data?: DispatchPrepareResult & { revoked?: boolean }
        error?: string
        leader?: { blockedReason?: string | null; leaderName?: string | null }
      }
      if (res.status === 422) {
        const reason = json.leader?.blockedReason
        setLeaderBlockReason(
          json.error ||
            (reason
              ? tQuotesOrders(locale, 'materialNoLeader')
              : tQuotesOrders(locale, 'materialNoLeader')),
        )
        return
      }
      if (!res.ok) {
        setError(json.error || 'Falha ao preparar conferência de saída')
        return
      }
      if (revokeOnly) {
        setDispatchPreviewOpen(false)
        setDispatchWhatsappText('')
        setDispatchPhone('')
        setDispatchConfirmUrl(null)
        setHint(tQuotesOrders(locale, 'materialRevokeDispatch'))
        return
      }
      const data = json.data
      setDispatchWhatsappText(data?.whatsapp_text ?? '')
      setDispatchPhone(data?.phone?.trim() ?? '')
      setDispatchConfirmUrl(data?.confirm_url ?? null)
      setDispatchPreviewOpen(true)
      setHint(tQuotesOrders(locale, 'materialDispatchReady'))
      window.setTimeout(() => {
        document
          .getElementById('material-dispatch-preview')
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
    } finally {
      setBusy(false)
    }
  }

  const dispatchPhoneOk = Boolean(normalizeWhatsAppPhone(dispatchPhone))
  const active = sortMaterialsForOperations(
    rows.filter((r) => r.status !== 'cancelled'),
  )

  function renderReturnInputs(row: ServiceOrderMaterialRow, compact = false) {
    if (!canReturn || !canRegisterReturn(row)) return null
    const leftoverEditable = canEditLeftover(row)
    const leftoverValue = leftoverEditable
      ? (draftLeftover[row.id] ?? String(row.leftover_quantity))
      : '0'
    const inputs = (
      <>
        <label className="block space-y-0.5">
          <span className="text-xs text-cdl-muted">
            {tQuotesOrders(locale, 'materialReturnedLabel')}
          </span>
          <input
            className={glassField()}
            type="number"
            min={0}
            step="any"
            value={draftReturn[row.id] ?? String(row.returned_quantity)}
            onChange={(e) =>
              setDraftReturn((d) => ({ ...d, [row.id]: e.target.value }))
            }
          />
        </label>
        <label className="block space-y-0.5">
          <span className="text-xs text-cdl-muted">
            {tQuotesOrders(locale, 'materialLeftoverLabel')}
          </span>
          <input
            className={`${glassField()} ${leftoverEditable ? '' : 'cursor-not-allowed opacity-50'}`}
            type="number"
            min={0}
            step="any"
            disabled={!leftoverEditable}
            readOnly={!leftoverEditable}
            title={
              leftoverEditable
                ? undefined
                : tQuotesOrders(locale, 'materialLeftoverNotApplicable')
            }
            value={leftoverValue}
            onChange={(e) => {
              if (!leftoverEditable) return
              setDraftLeftover((d) => ({ ...d, [row.id]: e.target.value }))
            }}
          />
        </label>
      </>
    )
    if (compact) {
      return (
        <div className="flex flex-col gap-1">
          {inputs}
          <button
            type="button"
            className={glassBtn('ghost')}
            disabled={busy}
            onClick={() =>
              void patchMaterial(row.id, {
                action: 'return',
                returned_quantity: Number(
                  draftReturn[row.id] ?? row.returned_quantity,
                ),
                leftover_quantity: leftoverEditable
                  ? Number(draftLeftover[row.id] ?? row.leftover_quantity)
                  : 0,
              })
            }
          >
            {tQuotesOrders(locale, 'materialRegisterReturn')}
          </button>
        </div>
      )
    }
    return inputs
  }

  function registerReturnButton(row: ServiceOrderMaterialRow) {
    if (!canReturn || !canRegisterReturn(row)) return null
    const leftoverEditable = canEditLeftover(row)
    return (
      <button
        type="button"
        className={glassBtn('ghost')}
        disabled={busy}
        onClick={() =>
          void patchMaterial(row.id, {
            action: 'return',
            returned_quantity: Number(
              draftReturn[row.id] ?? row.returned_quantity,
            ),
            leftover_quantity: leftoverEditable
              ? Number(draftLeftover[row.id] ?? row.leftover_quantity)
              : 0,
          })
        }
      >
        {tQuotesOrders(locale, 'materialRegisterReturn')}
      </button>
    )
  }

  function renderCloseAction(row: ServiceOrderMaterialRow) {
    if (
      !canReturn ||
      row.status === 'closed' ||
      row.status === 'cancelled' ||
      !canCloseMaterial(row)
    ) {
      return null
    }
    return (
      <button
        type="button"
        className={glassBtn('secondary')}
        disabled={busy}
        onClick={() => void patchMaterial(row.id, { action: 'close' })}
      >
        {tQuotesOrders(locale, 'materialClose')}
      </button>
    )
  }

  function renderDivergenceHints(row: ServiceOrderMaterialRow) {
    return (
      <>
        {row.status === 'divergence' ? (
          <p className="text-xs text-red-600">
            {tQuotesOrders(locale, 'materialDivergenceHint')}
          </p>
        ) : null}
        {row.status === 'divergence' &&
        canReturn &&
        canRegisterReturn(row) ? (
          <p className="text-xs text-red-600">
            {tQuotesOrders(locale, 'materialReturnDivergenceHint')}
          </p>
        ) : null}
      </>
    )
  }

  return (
    <section className="liquid-glass-card space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-cdl-fg">
            {tQuotesOrders(locale, 'materialsSection')}
          </h2>
          <p className="mt-0.5 text-xs text-cdl-muted">
            {tQuotesOrders(locale, 'materialsOperationalHint')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canDispatch ? (
            <button
              type="button"
              className={glassAction('green')}
              disabled={busy}
              onClick={() => void prepareDispatch(false)}
            >
              <span className="inline-flex items-center gap-2">
                <WhatsAppIcon className="h-5 w-5 text-white" />
                {tQuotesOrders(locale, 'materialPrepareDispatch')}
              </span>
            </button>
          ) : null}
          {canPrepare ? (
            <button
              type="button"
              className={glassBtn('primary')}
              disabled={busy}
              onClick={() => setShowAdd((v) => !v)}
            >
              {tQuotesOrders(locale, 'materialAdd')}
            </button>
          ) : null}
        </div>
      </div>

      {leaderBlockReason ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-100">
          {leaderBlockReason}
        </p>
      ) : null}

      {canDispatch && dispatchPreviewOpen ? (
        <div
          id="material-dispatch-preview"
          className="space-y-3 rounded-xl border border-emerald-300/40 bg-emerald-50/80 p-4 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10"
        >
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">
            {tQuotesOrders(locale, 'materialDispatchReady')}
          </p>
          <p className="text-xs text-cdl-muted">
            {tQuotesOrders(locale, 'materialConfirmDispatchHint')}
          </p>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-cdl-muted">
              WhatsApp do líder
            </span>
            <input
              className={glassField()}
              type="tel"
              placeholder="+1 407 …"
              value={dispatchPhone}
              onChange={(e) => setDispatchPhone(e.target.value)}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <WhatsAppButton
              phone={dispatchPhone}
              message={dispatchWhatsappText}
              editable
              disabled={!dispatchWhatsappText.trim()}
              onMessageChange={setDispatchWhatsappText}
              className="h-11 w-11 shrink-0 !p-0"
              title={
                dispatchPhoneOk
                  ? `WhatsApp · ${formatWhatsAppPhoneDisplay(dispatchPhone)}`
                  : 'Informe um telefone válido com DDI.'
              }
              onInvalidPhone={() =>
                setHint('Informe um telefone válido com DDI.')
              }
            />
            <button
              type="button"
              className={glassBtn('ghost')}
              disabled={busy}
              onClick={() => void prepareDispatch(true)}
            >
              {tQuotesOrders(locale, 'materialRevokeDispatch')}
            </button>
            <button
              type="button"
              className={glassBtn('ghost')}
              onClick={() => setDispatchPreviewOpen(false)}
            >
              Fechar prévia
            </button>
          </div>

          {dispatchWhatsappText.trim() ? (
            dispatchPhoneOk ? (
              <p className="text-xs text-cdl-muted">
                Destino: {formatWhatsAppPhoneDisplay(dispatchPhone)} — clique no
                ícone verde do WhatsApp para abrir o painel de envio.
              </p>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-200">
                Informe um telefone válido com DDI para liberar o envio.
              </p>
            )
          ) : null}

          <label className="block space-y-1">
            <span className="text-xs font-medium text-cdl-muted">
              Mensagem (editável)
            </span>
            <textarea
              className="min-h-[14rem] w-full whitespace-pre-wrap rounded-lg border border-cdl-border bg-cdl-surface p-3 font-sans text-sm leading-relaxed text-cdl-fg"
              value={dispatchWhatsappText}
              onChange={(e) => setDispatchWhatsappText(e.target.value)}
            />
          </label>

          {dispatchConfirmUrl ? (
            <p className="break-all text-xs text-cdl-muted">
              Link de conferência: {dispatchConfirmUrl}
            </p>
          ) : null}
        </div>
      ) : null}

      {showAdd ? (
        <div className="grid gap-2 rounded-lg border border-cdl-border p-3 sm:grid-cols-2">
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs text-cdl-muted">
              {tQuotesOrders(locale, 'materialDescription')}
            </span>
            <input
              className={glassField()}
              value={addForm.description_snapshot}
              onChange={(e) =>
                setAddForm((f) => ({
                  ...f,
                  description_snapshot: e.target.value,
                }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-cdl-muted">
              {tQuotesOrders(locale, 'materialTypeLabel')}
            </span>
            <select
              className={glassField()}
              value={addForm.material_type}
              onChange={(e) =>
                setAddForm((f) => ({
                  ...f,
                  material_type: e.target.value as MaterialType,
                }))
              }
            >
              {MATERIAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {materialTypeLabel(t, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-cdl-muted">
              {tQuotesOrders(locale, 'materialUnitLabel')}
            </span>
            <input
              className={glassField()}
              value={addForm.unit}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, unit: e.target.value }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-cdl-muted">
              {tQuotesOrders(locale, 'materialRequiredLabel')}
            </span>
            <input
              className={glassField()}
              type="number"
              min={0}
              step="any"
              value={addForm.required_quantity}
              onChange={(e) =>
                setAddForm((f) => ({
                  ...f,
                  required_quantity: e.target.value,
                }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-cdl-muted">
              {tQuotesOrders(locale, 'materialNotes')}
            </span>
            <input
              className={glassField()}
              value={addForm.notes}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </label>
          <div className="flex items-end gap-2 sm:col-span-2">
            <button
              type="button"
              className={glassBtn('primary')}
              disabled={busy || !addForm.description_snapshot.trim()}
              onClick={() => void addMaterial()}
            >
              {busy
                ? tQuotesOrders(locale, 'materialSaving')
                : tQuotesOrders(locale, 'materialAdd')}
            </button>
          </div>
        </div>
      ) : null}

      {active.length === 0 ? (
        <p className="text-sm text-cdl-muted">
          {tQuotesOrders(locale, 'materialsEmpty')}
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="text-xs uppercase text-cdl-muted">
                <tr>
                  <th className="py-2 pr-2">
                    {tQuotesOrders(locale, 'materialLabel')}
                  </th>
                  <th className="py-2 pr-2">
                    {tQuotesOrders(locale, 'materialTypeLabel')}
                  </th>
                  <th className="py-2 pr-2">
                    {tQuotesOrders(locale, 'materialUnitLabel')}
                  </th>
                  <th className="py-2 pr-2">
                    {tQuotesOrders(locale, 'materialRequiredLabel')}
                  </th>
                  <th className="py-2 pr-2">
                    {tQuotesOrders(locale, 'materialSeparatedLabel')}
                  </th>
                  <th className="py-2 pr-2">
                    {tQuotesOrders(locale, 'materialCheckedLabel')}
                  </th>
                  <th className="py-2 pr-2">
                    {tQuotesOrders(locale, 'materialDispatchedLabel')}
                  </th>
                  <th className="py-2 pr-2">
                    {tQuotesOrders(locale, 'materialReturnedLabel')}
                  </th>
                  <th className="py-2 pr-2">
                    {tQuotesOrders(locale, 'materialLeftoverLabel')}
                  </th>
                  <th className="py-2 pr-2">
                    {tQuotesOrders(locale, 'status')}
                  </th>
                  <th className="py-2">
                    {tQuotesOrders(locale, 'actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {active.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-t border-black/5 align-top ${materialTypeRowClass(row.material_type)}`}
                  >
                    <td className="py-2 pr-2 font-medium text-cdl-fg">
                      {row.description_snapshot}
                      <p className="text-xs font-normal text-cdl-muted">
                        {tQuotesOrders(locale, 'materialOrigin')}:{' '}
                        {materialOriginText(row, locale)}
                      </p>
                      {renderDivergenceHints(row)}
                    </td>
                    <td className="py-2 pr-2">
                      <MaterialTypeBadge
                        type={row.material_type}
                        locale={locale}
                      />
                    </td>
                    <td className="py-2 pr-2">{row.unit}</td>
                    <td className="py-2 pr-2">{row.required_quantity}</td>
                    <td className="py-2 pr-2">
                      {canPrepare && canEditSeparation(row) ? (
                        <div className="flex flex-col gap-1">
                          <input
                            className={glassField()}
                            type="number"
                            min={0}
                            step="any"
                            value={
                              draftSeparate[row.id] ??
                              String(row.separated_quantity)
                            }
                            onChange={(e) =>
                              setDraftSeparate((d) => ({
                                ...d,
                                [row.id]: e.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className={glassBtn('ghost')}
                            disabled={busy}
                            onClick={() =>
                              void patchMaterial(row.id, {
                                action: 'separate',
                                separated_quantity: Number(
                                  draftSeparate[row.id] ??
                                    row.separated_quantity,
                                ),
                              })
                            }
                          >
                            {tQuotesOrders(locale, 'materialSaveSeparate')}
                          </button>
                        </div>
                      ) : (
                        row.separated_quantity
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      {canCheck && canEditCheck(row) ? (
                        <div className="flex flex-col gap-1">
                          <input
                            className={glassField()}
                            type="number"
                            min={0}
                            step="any"
                            value={
                              draftCheck[row.id] ??
                              String(row.checked_quantity)
                            }
                            onChange={(e) =>
                              setDraftCheck((d) => ({
                                ...d,
                                [row.id]: e.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className={glassBtn('ghost')}
                            disabled={busy}
                            onClick={() =>
                              void patchMaterial(row.id, {
                                action: 'check',
                                checked_quantity: Number(
                                  draftCheck[row.id] ?? row.checked_quantity,
                                ),
                              })
                            }
                          >
                            {tQuotesOrders(locale, 'materialSaveCheck')}
                          </button>
                        </div>
                      ) : (
                        row.checked_quantity
                      )}
                    </td>
                    <td className="py-2 pr-2">{row.dispatched_quantity}</td>
                    <td className="py-2 pr-2">
                      {canReturn && canRegisterReturn(row) ? (
                        <label className="block space-y-0.5">
                          <span className="sr-only">
                            {tQuotesOrders(locale, 'materialReturnedLabel')}
                          </span>
                          <input
                            className={glassField()}
                            type="number"
                            min={0}
                            step="any"
                            value={
                              draftReturn[row.id] ??
                              String(row.returned_quantity)
                            }
                            onChange={(e) =>
                              setDraftReturn((d) => ({
                                ...d,
                                [row.id]: e.target.value,
                              }))
                            }
                          />
                        </label>
                      ) : (
                        row.returned_quantity
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      {canReturn &&
                      canRegisterReturn(row) &&
                      canEditLeftover(row) ? (
                        <label className="block space-y-0.5">
                          <span className="sr-only">
                            {tQuotesOrders(locale, 'materialLeftoverLabel')}
                          </span>
                          <input
                            className={glassField()}
                            type="number"
                            min={0}
                            step="any"
                            value={
                              draftLeftover[row.id] ??
                              String(row.leftover_quantity)
                            }
                            onChange={(e) =>
                              setDraftLeftover((d) => ({
                                ...d,
                                [row.id]: e.target.value,
                              }))
                            }
                          />
                        </label>
                      ) : (
                        <span
                          className={
                            canRegisterReturn(row) && !canEditLeftover(row)
                              ? 'text-cdl-muted opacity-50'
                              : undefined
                          }
                          title={
                            canRegisterReturn(row) && !canEditLeftover(row)
                              ? tQuotesOrders(
                                  locale,
                                  'materialLeftoverNotApplicable',
                                )
                              : undefined
                          }
                        >
                          {canEditLeftover(row)
                            ? row.leftover_quantity
                            : 0}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
                      >
                        {materialStatusLabel(row.status, locale)}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex flex-col gap-1">
                        {registerReturnButton(row)}
                        {renderCloseAction(row)}
                        {canPrepare ? (
                          <button
                            type="button"
                            className="text-xs text-red-600 underline"
                            disabled={busy}
                            onClick={() =>
                              void patchMaterial(row.id, { action: 'cancel' })
                            }
                          >
                            {tQuotesOrders(locale, 'materialCancel')}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {active.map((row) => (
              <li
                key={row.id}
                className={`space-y-2 rounded-lg border border-cdl-border p-3 ${materialTypeRowClass(row.material_type)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-cdl-fg">
                      {row.description_snapshot}
                    </p>
                    <p className="text-xs text-cdl-muted">
                      {tQuotesOrders(locale, 'materialOrigin')}:{' '}
                      {materialOriginText(row, locale)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
                  >
                    {materialStatusLabel(row.status, locale)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <MaterialTypeBadge
                    type={row.material_type}
                    locale={locale}
                  />
                  <span className="text-cdl-muted">{row.unit}</span>
                </div>
                {renderDivergenceHints(row)}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <p>
                    {tQuotesOrders(locale, 'materialRequiredLabel')}:{' '}
                    {row.required_quantity}
                  </p>
                  <p>
                    {tQuotesOrders(locale, 'materialDispatchedLabel')}:{' '}
                    {row.dispatched_quantity}
                  </p>
                  {!(canReturn && canRegisterReturn(row)) ? (
                    <>
                      <p>
                        {tQuotesOrders(locale, 'materialReturnedLabel')}:{' '}
                        {row.returned_quantity}
                      </p>
                      <p
                        className={
                          !canEditLeftover(row)
                            ? 'text-cdl-muted opacity-50'
                            : undefined
                        }
                        title={
                          !canEditLeftover(row)
                            ? tQuotesOrders(
                                locale,
                                'materialLeftoverNotApplicable',
                              )
                            : undefined
                        }
                      >
                        {tQuotesOrders(locale, 'materialLeftoverLabel')}:{' '}
                        {canEditLeftover(row) ? row.leftover_quantity : 0}
                      </p>
                    </>
                  ) : null}
                </div>
                {canPrepare && canEditSeparation(row) ? (
                  <label className="block space-y-1">
                    <span className="text-xs text-cdl-muted">
                      {tQuotesOrders(locale, 'materialSeparatedLabel')}
                    </span>
                    <div className="flex gap-2">
                      <input
                        className={glassField()}
                        type="number"
                        min={0}
                        step="any"
                        value={
                          draftSeparate[row.id] ??
                          String(row.separated_quantity)
                        }
                        onChange={(e) =>
                          setDraftSeparate((d) => ({
                            ...d,
                            [row.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className={glassBtn('secondary')}
                        disabled={busy}
                        onClick={() =>
                          void patchMaterial(row.id, {
                            action: 'separate',
                            separated_quantity: Number(
                              draftSeparate[row.id] ?? row.separated_quantity,
                            ),
                          })
                        }
                      >
                        {tQuotesOrders(locale, 'materialSeparate')}
                      </button>
                    </div>
                  </label>
                ) : (
                  <p className="text-sm">
                    {tQuotesOrders(locale, 'materialSeparatedLabel')}:{' '}
                    {row.separated_quantity}
                  </p>
                )}
                {canCheck && canEditCheck(row) ? (
                  <label className="block space-y-1">
                    <span className="text-xs text-cdl-muted">
                      {tQuotesOrders(locale, 'materialCheckedLabel')}
                    </span>
                    <div className="flex gap-2">
                      <input
                        className={glassField()}
                        type="number"
                        min={0}
                        step="any"
                        value={
                          draftCheck[row.id] ?? String(row.checked_quantity)
                        }
                        onChange={(e) =>
                          setDraftCheck((d) => ({
                            ...d,
                            [row.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className={glassBtn('secondary')}
                        disabled={busy}
                        onClick={() =>
                          void patchMaterial(row.id, {
                            action: 'check',
                            checked_quantity: Number(
                              draftCheck[row.id] ?? row.checked_quantity,
                            ),
                          })
                        }
                      >
                        {tQuotesOrders(locale, 'materialCheck')}
                      </button>
                    </div>
                  </label>
                ) : (
                  <p className="text-sm">
                    {tQuotesOrders(locale, 'materialCheckedLabel')}:{' '}
                    {row.checked_quantity}
                  </p>
                )}
                {canReturn && canRegisterReturn(row) ? (
                  <div className="space-y-2 border-t border-cdl-border pt-2">
                    {renderReturnInputs(row, true)}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {renderCloseAction(row)}
                  {canPrepare ? (
                    <button
                      type="button"
                      className="text-xs text-red-600 underline"
                      disabled={busy}
                      onClick={() =>
                        void patchMaterial(row.id, { action: 'cancel' })
                      }
                    >
                      {tQuotesOrders(locale, 'materialCancel')}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {hint ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-200">{hint}</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  )
}

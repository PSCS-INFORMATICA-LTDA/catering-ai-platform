'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  isOperationalRoleKey,
  operationalRoleLabel,
  type OperationalRoleKey,
} from '@/Lib/agenda/operationalRoles'
import {
  buildTeamScaleSlots,
  evaluateTeamScale,
  type TeamScaleSlotDef,
} from '@/Lib/agenda/teamScale'
import { getCustomerDisplayName } from '@/Lib/getCustomerDisplayName'
import { glassAction, glassBtn, glassField } from '@/Lib/liquidGlass'
import { buildMailtoHref } from '@/Lib/quoteProposal'
import { buildSmsShareHref } from '@/Lib/smsShare'
import {
  formatWhatsAppPhoneDisplay,
  normalizeWhatsAppPhone,
} from '@/Lib/whatsapp'
import { MailIcon, SmsIcon, WhatsAppIcon } from '@/components/icons/ShareIcons'
import SmsShareAnchor from '@/components/share/SmsShareAnchor'
import WhatsAppButton from '@/components/share/WhatsAppButton'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import { tCommon } from '@/Lib/i18n/common'

type Summary = {
  confirmed: number
  pending: number
  declined: number
  cancelled: number
}

type Share = {
  person_id: string
  role_key: string
  phone: string | null
  person_name?: string
  whatsappText: string
  confirmUrl: string
  confirmation_id: string
}

type Confirmation = {
  id: string
  person_id: string
  role_key: string
  status: string
}

type Member = {
  person_id: string
  role_key: string
  customers?:
    | { full_name?: string | null; ab_name?: string | null; phone?: string | null }
    | Array<{ full_name?: string | null; ab_name?: string | null; phone?: string | null }>
    | null
}

type Candidate = {
  id: string
  full_name?: string | null
  ab_name?: string | null
  phone?: string | null
  display_name: string
  role_keys: string[]
}

type SlotState = TeamScaleSlotDef & { person_id: string }

const SHARE_ICON = 'h-11 w-11 shrink-0 !p-0'

function memberName(m: Member): string {
  const raw = m.customers
  const person = Array.isArray(raw) ? raw[0] : raw
  return getCustomerDisplayName(person, {
    emptyLabel: `${m.person_id.slice(0, 8)}…`,
  })
}

function activeConfirmation(
  confirmations: Confirmation[],
  personId: string,
): Confirmation | undefined {
  return (
    confirmations.find(
      (c) =>
        c.person_id === personId &&
        (c.status === 'pending' || c.status === 'confirmed'),
    ) || confirmations.find((c) => c.person_id === personId)
  )
}

function defaultSlotsFromMembers(members: Member[]): SlotState[] {
  const defs = buildTeamScaleSlots()
  const used = new Set<string>()
  const byRole = new Map<OperationalRoleKey, string[]>()
  for (const m of members) {
    if (!isOperationalRoleKey(m.role_key)) continue
    const list = byRole.get(m.role_key) ?? []
    list.push(m.person_id)
    byRole.set(m.role_key, list)
  }
  return defs.map((def) => {
    const pool = byRole.get(def.role_key) ?? []
    let person_id = ''
    for (const id of pool) {
      if (!used.has(id)) {
        person_id = id
        used.add(id)
        break
      }
    }
    return { ...def, person_id }
  })
}

export default function OrderTeamConfirmationsPanel({
  orderId,
  canManage,
}: {
  orderId: string
  canManage: boolean
}) {
  const locale = useAuthLocaleFromMe()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [confirmations, setConfirmations] = useState<Confirmation[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [slots, setSlots] = useState<SlotState[]>([])
  const [shares, setShares] = useState<Share[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [phones, setPhones] = useState<Record<string, string>>({})
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [alert, setAlert] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/orders/${orderId}/team-confirmations`, {
      cache: 'no-store',
    })
    const json = (await res.json()) as {
      data?: {
        summary?: Summary | null
        confirmations?: Confirmation[]
        members?: Member[]
        candidates?: Candidate[]
        event?: { id: string } | null
      }
      error?: string
    }
    if (!res.ok) {
      setError(json.error || tQuotesOrders(locale, 'loadScaleError'))
      return
    }
    const memberList = json.data?.members ?? []
    const candidateList = json.data?.candidates ?? []
    setSummary(json.data?.summary ?? null)
    setConfirmations(json.data?.confirmations ?? [])
    setMembers(memberList)
    setCandidates(candidateList)
    setSlots((prev) => {
      if (prev.length && prev.some((s) => s.person_id)) return prev
      return defaultSlotsFromMembers(memberList)
    })

    const scale = evaluateTeamScale(
      memberList.map((m) => ({
        person_id: m.person_id,
        role_key: m.role_key,
        active: true,
      })),
    )

    const confs = json.data?.confirmations ?? []
    const activeConfs = confs.filter(
      (c) => c.status === 'pending' || c.status === 'confirmed',
    )
    const allMembersHaveActive = memberList.every((m) =>
      activeConfs.some((c) => c.person_id === m.person_id),
    )
    const allConfirmed =
      memberList.length > 0 &&
      memberList.every((m) =>
        confs.some((c) => c.person_id === m.person_id && c.status === 'confirmed'),
      )

    if (!json.data?.event) setAlert(tQuotesOrders(locale, 'noTeam'))
    else if (!scale.closed) {
      setAlert(
        scale.nextRoleLabel
          ? tQuotesOrders(locale, 'teamIncompleteAssign', {
              role: scale.nextRoleLabel,
            })
          : tQuotesOrders(locale, 'teamIncomplete'),
      )
    } else if ((json.data.summary?.declined ?? 0) > 0)
      setAlert(tQuotesOrders(locale, 'memberDeclined'))
    else if (!allMembersHaveActive)
      setAlert(tQuotesOrders(locale, 'teamClosedSelectScale'))
    else if ((json.data.summary?.pending ?? 0) > 0)
      setAlert(tQuotesOrders(locale, 'awaitingConfirmations'))
    else if (allConfirmed) setAlert(tQuotesOrders(locale, 'teamConfirmed'))
    else setAlert(null)
  }, [orderId, locale])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const candidateById = useMemo(() => {
    const map = new Map<string, Candidate>()
    for (const c of candidates) map.set(c.id, c)
    return map
  }, [candidates])

  function optionsForSlot(slot: SlotState): Candidate[] {
    const taken = new Set(
      slots.filter((s) => s.slotKey !== slot.slotKey && s.person_id).map((s) => s.person_id),
    )
    const preferred = candidates.filter(
      (c) =>
        !taken.has(c.id) &&
        (c.role_keys.includes(slot.role_key) || c.role_keys.length === 0),
    )
    const fallback = candidates.filter((c) => !taken.has(c.id))
    const list = preferred.length ? preferred : fallback
    const selected = slot.person_id ? candidateById.get(slot.person_id) : null
    if (selected && !list.some((c) => c.id === selected.id)) {
      return [selected, ...list]
    }
    return list
  }

  function updateSlotPerson(slotKey: string, personId: string) {
    setSlots((prev) =>
      prev.map((s) => (s.slotKey === slotKey ? { ...s, person_id: personId } : s)),
    )
    setSelectedSlotKey(slotKey)
    if (personId) {
      const cand = candidateById.get(personId)
      setPhones((prev) => ({
        ...prev,
        [personId]: prev[personId] ?? cand?.phone?.trim() ?? '',
      }))
    }
    setHint(
      tQuotesOrders(locale, 'scaleChangedHint'),
    )
  }

  async function prepareConfirmations() {
    const selectedMembers = slots
      .filter((s) => s.person_id)
      .map((s) => ({ person_id: s.person_id, role_key: s.role_key }))

    if (!selectedMembers.length) {
      setError(tQuotesOrders(locale, 'selectAtLeastOneMember'))
      return
    }

    const dup = new Set<string>()
    for (const m of selectedMembers) {
      if (dup.has(m.person_id)) {
        setError(tQuotesOrders(locale, 'samePersonTwoSlots'))
        return
      }
      dup.add(m.person_id)
    }

    setBusy(true)
    setError(null)
    setHint(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/team-confirmations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: selectedMembers }),
      })
      const json = (await res.json()) as {
        data?: { shares?: Share[] }
        error?: string
        conflict?: {
          next_available_start?: string | null
          message_pt?: string
        }
      }
      if (!res.ok) {
        const base =
          json.conflict?.message_pt ||
          json.error ||
          tQuotesOrders(locale, 'prepareScaleError')
        const next = json.conflict?.next_available_start
        setError(
          next
            ? `${base} ${tQuotesOrders(locale, 'nextAvailablePrefix')} ${next}`
            : base,
        )
        return
      }
      const nextShares = json.data?.shares ?? []
      setShares(nextShares)
      const nextDrafts: Record<string, string> = {}
      const nextPhones: Record<string, string> = { ...phones }
      for (const s of nextShares) {
        nextDrafts[s.person_id] = s.whatsappText
        nextPhones[s.person_id] =
          nextPhones[s.person_id]?.trim() || s.phone?.trim() || ''
      }
      setDrafts(nextDrafts)
      setPhones(nextPhones)

      const focus =
        slots.find((s) => s.slotKey === selectedSlotKey && s.person_id) ||
        slots.find((s) => s.person_id) ||
        null
      setSelectedSlotKey(focus?.slotKey ?? null)
      setPreviewOpen(true)
      await refresh()
      window.setTimeout(() => {
        document
          .getElementById('team-confirmation-preview')
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
    } finally {
      setBusy(false)
    }
  }

  const selectedSlot =
    slots.find((s) => s.slotKey === selectedSlotKey) ||
    slots.find((s) => s.person_id) ||
    null

  const selectedShare = useMemo(() => {
    if (!selectedSlot?.person_id) return null
    return (
      shares.find((s) => s.person_id === selectedSlot.person_id) ?? null
    )
  }, [shares, selectedSlot])

  const selectedCandidate = selectedSlot?.person_id
    ? candidateById.get(selectedSlot.person_id) ?? null
    : null

  const selectedPhone = selectedSlot?.person_id
    ? phones[selectedSlot.person_id] ??
      selectedShare?.phone ??
      selectedCandidate?.phone ??
      ''
    : ''
  const selectedMessage = selectedShare
    ? drafts[selectedShare.person_id] ?? selectedShare.whatsappText
    : ''
  const phoneOk = Boolean(normalizeWhatsAppPhone(selectedPhone))

  return (
    <section className="liquid-glass-card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-cdl-fg">Equipe / Escala</h2>
        {canManage ? (
          <button
            type="button"
            className={glassAction('green')}
            disabled={busy}
            onClick={() => void prepareConfirmations()}
          >
            <span className="inline-flex items-center gap-2">
              <WhatsAppIcon className="h-5 w-5 text-white" />
              {previewOpen
                ? tQuotesOrders(locale, 'updateWhatsAppPreview')
                : tQuotesOrders(locale, 'prepareWhatsAppConfirmations')}
            </span>
          </button>
        ) : null}
      </div>

      {alert ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
          {alert}
        </p>
      ) : null}

      {summary ? (
        <p className="text-sm text-cdl-muted">
          {tQuotesOrders(locale, 'summaryConfirmedPendingDeclined', {
            confirmed: summary.confirmed,
            pending: summary.pending,
            declined: summary.declined,
          })}
        </p>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium text-cdl-fg">
          {tQuotesOrders(locale, 'scaleChooseHint')}
        </p>
        <p className="text-xs text-cdl-muted">
          {tQuotesOrders(locale, 'scaleMinHint')}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {slots.map((slot) => {
            const options = optionsForSlot(slot)
            const active = slot.slotKey === selectedSlot?.slotKey
            return (
              <label
                key={slot.slotKey}
                className={`block space-y-1 rounded-lg border px-3 py-2 ${
                  active
                    ? 'border-emerald-400/60 bg-emerald-50/70 dark:border-emerald-500/40 dark:bg-emerald-500/10'
                    : 'border-cdl-border bg-cdl-surface/60'
                }`}
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-cdl-muted">
                  {slot.label}
                </span>
                <select
                  className={glassField()}
                  value={slot.person_id}
                  disabled={!canManage}
                  onChange={(e) => updateSlotPerson(slot.slotKey, e.target.value)}
                  onFocus={() => setSelectedSlotKey(slot.slotKey)}
                >
                  <option value="">Selecionar…</option>
                  {options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name}
                      {c.phone ? ` · ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )
          })}
        </div>
        {canManage ? (
          <button
            type="button"
            className={glassBtn('ghost')}
            onClick={() => {
              setSlots((prev) => {
                const grillCount = prev.filter(
                  (s) => s.role_key === 'grill_master',
                ).length
                const nextIndex = grillCount
                return [
                  ...prev,
                  {
                    slotKey: `grill_master:${nextIndex}`,
                    role_key: 'grill_master' as OperationalRoleKey,
                    label: `Churrasqueiro ${nextIndex + 1}`,
                    index: nextIndex,
                    person_id: '',
                  },
                ]
              })
              setHint(
                tQuotesOrders(locale, 'extraGrillSlotAdded'),
              )
            }}
          >
            + Adicionar churrasqueiro
          </button>
        ) : null}
      </div>

      <ul className="space-y-1 text-sm">
        {members.map((m) => {
          const conf = activeConfirmation(confirmations, m.person_id)
          return (
            <li
              key={`${m.person_id}-${m.role_key}`}
              className="flex justify-between gap-2 border-b border-black/5 py-1"
            >
              <span>
                {operationalRoleLabel(m.role_key, 'pt')} · {memberName(m)}
                <span className="text-cdl-muted"> (equipe base)</span>
              </span>
              <span className="font-medium">{conf?.status || 'na escala'}</span>
            </li>
          )
        })}
      </ul>

      {previewOpen && selectedSlot ? (
        <div
          id="team-confirmation-preview"
          className="space-y-3 rounded-xl border border-emerald-300/40 bg-emerald-50/80 p-4 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10"
        >
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">
            {tQuotesOrders(locale, 'confirmationPreviewTitle')}
          </p>
          <p className="text-xs text-cdl-muted">
            {tQuotesOrders(locale, 'confirmationPreviewHint')}
          </p>

          <div className="flex flex-wrap gap-2">
            {slots
              .filter((s) => s.person_id)
              .map((s) => {
                const cand = candidateById.get(s.person_id)
                const active = s.slotKey === selectedSlot.slotKey
                return (
                  <button
                    key={s.slotKey}
                    type="button"
                    className={
                      active ? glassBtn('primary') : glassBtn('secondary')
                    }
                    onClick={() => setSelectedSlotKey(s.slotKey)}
                  >
                    {s.label}
                    {cand ? ` · ${cand.display_name}` : ''}
                  </button>
                )
              })}
          </div>

          <p className="text-sm font-medium text-cdl-fg">
            {selectedSlot.label}
            {selectedCandidate ? ` · ${selectedCandidate.display_name}` : ''}
          </p>

          {!selectedShare ? (
            <p className="text-xs text-amber-800 dark:text-amber-100">
              {tQuotesOrders(locale, 'prepareConfirmationsHint')}
            </p>
          ) : null}

          <label className="block space-y-1">
            <span className="text-xs font-medium text-cdl-muted">
              {tQuotesOrders(locale, 'memberWhatsApp')}
            </span>
            <input
              className={glassField()}
              type="tel"
              placeholder="+1 407 …"
              value={selectedPhone}
              disabled={!selectedSlot.person_id}
              onChange={(e) => {
                if (!selectedSlot.person_id) return
                setPhones((prev) => ({
                  ...prev,
                  [selectedSlot.person_id]: e.target.value,
                }))
              }}
            />
          </label>

          <div className="proposal-toolbar flex flex-wrap items-center gap-2">
            <WhatsAppButton
              phone={selectedPhone}
              message={selectedMessage}
              editable
              disabled={!selectedShare}
              onMessageChange={(value) => {
                if (!selectedShare) return
                setDrafts((prev) => ({
                  ...prev,
                  [selectedShare.person_id]: value,
                }))
              }}
              className={SHARE_ICON}
              title={
                !selectedShare
                  ? tQuotesOrders(locale, 'preparePreviewFirst')
                  : phoneOk
                    ? `WhatsApp · ${formatWhatsAppPhoneDisplay(selectedPhone)}`
                    : tQuotesOrders(locale, 'enterPhoneToSend')
              }
              onInvalidPhone={() =>
                setHint(tQuotesOrders(locale, 'enterPhoneToSend'))
              }
            />

            {selectedShare && buildSmsShareHref(selectedPhone, selectedMessage) ? (
              <SmsShareAnchor
                href={buildSmsShareHref(selectedPhone, selectedMessage)!}
                message={selectedMessage}
                className={`${glassAction('sky', true)} ${SHARE_ICON}`}
                title={tQuotesOrders(locale, 'sendBySms')}
                aria-label={tQuotesOrders(locale, 'sendBySms')}
                onDesktopHint={() =>
                  setHint(
                    tQuotesOrders(locale, 'smsCopiedHint'),
                  )
                }
              >
                <SmsIcon className="h-5 w-5" />
              </SmsShareAnchor>
            ) : (
              <button
                type="button"
                disabled
                className={`${glassAction('sky', true)} ${SHARE_ICON} opacity-50`}
                title={tCommon(locale, 'smsUnavailable')}
                aria-label={tCommon(locale, 'smsUnavailable')}
              >
                <SmsIcon className="h-5 w-5" />
              </button>
            )}

            {(() => {
              const mailHref =
                selectedShare &&
                buildMailtoHref({
                  email: null,
                  subject: tQuotesOrders(locale, 'confirmationEmailSubject', {
                    label: selectedSlot.label,
                  }),
                  body: selectedMessage,
                })
              return mailHref ? (
                <a
                  href={mailHref}
                  className={`${glassAction('sky', true)} ${SHARE_ICON}`}
                  title={tQuotesOrders(locale, 'emailLabel')}
                  aria-label={tQuotesOrders(locale, 'emailLabel')}
                >
                  <MailIcon className="h-5 w-5" />
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className={`${glassAction('sky', true)} ${SHARE_ICON} opacity-50`}
                  title={tCommon(locale, 'emailUnavailable')}
                  aria-label={tCommon(locale, 'emailUnavailable')}
                >
                  <MailIcon className="h-5 w-5" />
                </button>
              )
            })()}

            <button
              type="button"
              className={glassBtn('ghost')}
              disabled={!selectedShare}
              onClick={() => {
                if (!selectedShare) return
                setDrafts((prev) => ({
                  ...prev,
                  [selectedShare.person_id]: selectedShare.whatsappText,
                }))
              }}
            >
              {tQuotesOrders(locale, 'restoreDefaultText')}
            </button>
            <button
              type="button"
              className={glassBtn('ghost')}
              onClick={() => setPreviewOpen(false)}
            >
              {tCommon(locale, 'closePreview')}
            </button>
          </div>

          {selectedShare ? (
            phoneOk ? (
              <p className="text-xs text-cdl-muted">
                {tQuotesOrders(locale, 'destinationClickWhatsApp', {
                  phone: formatWhatsAppPhoneDisplay(selectedPhone),
                })}
              </p>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-200">
                {tQuotesOrders(locale, 'enterPhoneToSend')}
              </p>
            )
          ) : null}

          <label className="block space-y-1">
            <span className="text-xs font-medium text-cdl-muted">
              {tQuotesOrders(locale, 'editableMessageLabel')}
            </span>
            <textarea
              className="min-h-[14rem] w-full whitespace-pre-wrap rounded-lg border border-cdl-border bg-cdl-surface p-3 font-sans text-sm leading-relaxed text-cdl-fg"
              value={selectedMessage}
              disabled={!selectedShare}
              onChange={(e) => {
                if (!selectedShare) return
                setDrafts((prev) => ({
                  ...prev,
                  [selectedShare.person_id]: e.target.value,
                }))
              }}
              placeholder={tQuotesOrders(locale, 'messagePlaceholderScale')}
            />
          </label>

          {selectedShare?.confirmUrl ? (
            <p className="break-all text-xs text-cdl-muted">
              {tQuotesOrders(locale, 'confirmationLink', {
                url: selectedShare.confirmUrl,
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {hint ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-200">{hint}</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { operationalRoleLabel } from '@/Lib/agenda/operationalRoles'
import { evaluateTeamScale } from '@/Lib/agenda/teamScale'
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

const SHARE_ICON = 'h-11 w-11 shrink-0 !p-0'

function memberName(m: Member): string {
  const raw = m.customers
  const person = Array.isArray(raw) ? raw[0] : raw
  return person?.ab_name || person?.full_name || `${m.person_id.slice(0, 8)}…`
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

export default function OrderTeamConfirmationsPanel({
  orderId,
  canManage,
}: {
  orderId: string
  canManage: boolean
}) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [confirmations, setConfirmations] = useState<Confirmation[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [shares, setShares] = useState<Share[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [phones, setPhones] = useState<Record<string, string>>({})
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
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
        event?: { id: string } | null
      }
      error?: string
    }
    if (!res.ok) {
      setError(json.error || 'Falha ao carregar escala')
      return
    }
    const memberList = json.data?.members ?? []
    setSummary(json.data?.summary ?? null)
    setConfirmations(json.data?.confirmations ?? [])
    setMembers(memberList)

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

    if (!json.data?.event) setAlert('SEM EQUIPE')
    else if (!scale.closed) {
      setAlert(
        scale.nextRoleLabel
          ? `EQUIPE INCOMPLETA — designar: ${scale.nextRoleLabel}`
          : 'EQUIPE INCOMPLETA',
      )
    } else if ((json.data.summary?.declined ?? 0) > 0) setAlert('INTEGRANTE RECUSOU')
    else if (!allMembersHaveActive)
      setAlert('EQUIPE FECHADA — preparar confirmações aos integrantes')
    else if ((json.data.summary?.pending ?? 0) > 0) setAlert('AGUARDANDO CONFIRMAÇÕES')
    else if (allConfirmed) setAlert('EQUIPE CONFIRMADA')
    else setAlert(null)
  }, [orderId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function prepareConfirmations() {
    setBusy(true)
    setError(null)
    setHint(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/team-confirmations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
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
          json.conflict?.message_pt || json.error || 'Falha ao preparar escala'
        const next = json.conflict?.next_available_start
        setError(
          next ? `${base} Próximo horário disponível: ${next}` : base,
        )
        return
      }
      const nextShares = json.data?.shares ?? []
      setShares(nextShares)
      const nextDrafts: Record<string, string> = {}
      const nextPhones: Record<string, string> = {}
      for (const s of nextShares) {
        nextDrafts[s.person_id] = s.whatsappText
        nextPhones[s.person_id] = s.phone?.trim() || ''
      }
      setDrafts(nextDrafts)
      setPhones(nextPhones)
      setSelectedPersonId(nextShares[0]?.person_id ?? null)
      setPreviewOpen(true)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const selectedShare = useMemo(
    () => shares.find((s) => s.person_id === selectedPersonId) ?? shares[0] ?? null,
    [shares, selectedPersonId],
  )

  const selectedMember = useMemo(
    () =>
      members.find((m) => m.person_id === selectedShare?.person_id) ?? null,
    [members, selectedShare],
  )

  const selectedPhone = selectedShare
    ? phones[selectedShare.person_id] ?? selectedShare.phone ?? ''
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
                ? 'Atualizar prévia WhatsApp'
                : 'Preparar confirmações WhatsApp'}
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
          {summary.confirmed} confirmados · {summary.pending} aguardando ·{' '}
          {summary.declined} indisponíveis
        </p>
      ) : null}

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
              </span>
              <span className="font-medium">{conf?.status || 'na escala'}</span>
            </li>
          )
        })}
      </ul>

      {previewOpen && selectedShare ? (
        <div className="space-y-3 rounded-xl border border-emerald-300/40 bg-emerald-50/80 p-4 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">
            Prévia da confirmação — revise a mensagem antes de abrir o WhatsApp
          </p>
          <p className="text-xs text-cdl-muted">
            Mesmo padrão da designação de equipe: edite o texto, confira o
            telefone e só então envie.
          </p>

          <div className="flex flex-wrap gap-2">
            {shares.map((s) => {
              const m = members.find((x) => x.person_id === s.person_id)
              const active = s.person_id === selectedShare.person_id
              return (
                <button
                  key={s.confirmation_id || s.person_id}
                  type="button"
                  className={
                    active ? glassBtn('primary') : glassBtn('secondary')
                  }
                  onClick={() => setSelectedPersonId(s.person_id)}
                >
                  {operationalRoleLabel(s.role_key, 'pt')}
                  {m ? ` · ${memberName(m)}` : ''}
                </button>
              )
            })}
          </div>

          <p className="text-sm font-medium text-cdl-fg">
            {operationalRoleLabel(selectedShare.role_key, 'pt')}
            {selectedMember ? ` · ${memberName(selectedMember)}` : ''}
          </p>

          {selectedShare.confirmUrl ? (
            <p className="break-all text-xs text-cdl-muted">
              Link de confirmação: {selectedShare.confirmUrl}
            </p>
          ) : null}

          <label className="block space-y-1">
            <span className="text-xs font-medium text-cdl-muted">
              WhatsApp do integrante
            </span>
            <input
              className={glassField()}
              type="tel"
              placeholder="+1 407 …"
              value={selectedPhone}
              onChange={(e) =>
                setPhones((prev) => ({
                  ...prev,
                  [selectedShare.person_id]: e.target.value,
                }))
              }
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-cdl-muted">
              Mensagem (editável)
            </span>
            <textarea
              className="min-h-[12rem] w-full rounded-lg border border-cdl-border bg-cdl-surface p-3 text-xs text-cdl-fg"
              value={selectedMessage}
              onChange={(e) =>
                setDrafts((prev) => ({
                  ...prev,
                  [selectedShare.person_id]: e.target.value,
                }))
              }
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={glassBtn('ghost')}
              onClick={() =>
                setDrafts((prev) => ({
                  ...prev,
                  [selectedShare.person_id]: selectedShare.whatsappText,
                }))
              }
            >
              Restaurar texto padrão
            </button>
            <button
              type="button"
              className={glassBtn('ghost')}
              onClick={() => setPreviewOpen(false)}
            >
              Fechar prévia
            </button>
          </div>

          <div className="proposal-toolbar flex flex-wrap items-center gap-2">
            <WhatsAppButton
              phone={selectedPhone}
              message={selectedMessage}
              editable
              onMessageChange={(value) =>
                setDrafts((prev) => ({
                  ...prev,
                  [selectedShare.person_id]: value,
                }))
              }
              className={SHARE_ICON}
              title={
                phoneOk
                  ? `WhatsApp · ${formatWhatsAppPhoneDisplay(selectedPhone)}`
                  : 'Informe um telefone válido com DDI.'
              }
              onInvalidPhone={() =>
                setHint('Informe um telefone válido com DDI.')
              }
            />

            {buildSmsShareHref(selectedPhone, selectedMessage) ? (
              <SmsShareAnchor
                href={buildSmsShareHref(selectedPhone, selectedMessage)!}
                message={selectedMessage}
                className={`${glassAction('sky', true)} ${SHARE_ICON}`}
                title="Enviar por SMS"
                aria-label="Enviar por SMS"
                onDesktopHint={() =>
                  setHint(
                    'Mensagem SMS copiada. No PC use Phone Link se disponível.',
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
                title="SMS indisponível"
                aria-label="SMS indisponível"
              >
                <SmsIcon className="h-5 w-5" />
              </button>
            )}

            {(() => {
              const mailHref = buildMailtoHref({
                email: null,
                subject: `Confirmação de escala — ${operationalRoleLabel(selectedShare.role_key, 'pt')}`,
                body: selectedMessage,
              })
              return mailHref ? (
                <a
                  href={mailHref}
                  className={`${glassAction('sky', true)} ${SHARE_ICON}`}
                  title="E-mail"
                  aria-label="E-mail"
                >
                  <MailIcon className="h-5 w-5" />
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className={`${glassAction('sky', true)} ${SHARE_ICON} opacity-50`}
                  title="E-mail indisponível"
                  aria-label="E-mail indisponível"
                >
                  <MailIcon className="h-5 w-5" />
                </button>
              )
            })()}
          </div>

          {phoneOk ? (
            <p className="text-xs text-cdl-muted">
              Destino: {formatWhatsAppPhoneDisplay(selectedPhone)}
            </p>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-200">
              Informe um telefone válido com DDI para liberar o envio.
            </p>
          )}
        </div>
      ) : null}

      {hint ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-200">{hint}</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  )
}

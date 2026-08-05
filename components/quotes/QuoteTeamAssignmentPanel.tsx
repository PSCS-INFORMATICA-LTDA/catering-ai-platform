'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildTeamAvailabilityWhatsAppText,
  parseTeamLeaderFromNotes,
} from '@/Lib/whatsappMessageTemplates'
import {
  suggestPresentationTime,
  formatTimeShort,
} from '@/Lib/teamAssignment'
import { MailIcon, SmsIcon, WhatsAppIcon } from '@/components/icons/ShareIcons'
import SmsShareAnchor from '@/components/share/SmsShareAnchor'
import WhatsAppButton from '@/components/share/WhatsAppButton'
import { buildMailtoHref } from '@/Lib/quoteProposal'
import { buildSmsShareHref } from '@/Lib/smsShare'
import {
  formatWhatsAppPhoneDisplay,
  normalizeWhatsAppPhone,
} from '@/Lib/whatsapp'
import { glassAction, glassBtn, glassField } from '@/Lib/liquidGlass'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

type TeamRow = {
  id: string
  name: string
  color?: string
  notes?: string | null
  preferred_language?: string | null
  contact_person_id?: string | null
  contact?: {
    id: string
    phone?: string | null
    email?: string | null
    preferred_language?: string | null
    full_name?: string | null
    ab_name?: string | null
  } | null
  active?: boolean
}

type Assignment = {
  event_id: string
  code: string
  team_id: string
  event_date: string
  start_time: string
  end_time: string
  presentation_time: string | null
  status: string
  team_assignment_token: string | null
  team_assignment_response: string
  team_assignment_sent_at: string | null
  public_url: string | null
}

type PanelData = {
  quote_id: string
  quote_number: string | null
  proposal_response: string
  quote_status: string | null
  team_presentation_time: string | null
  designated_team_id: string | null
  event_date: string | null
  start_time: string | null
  end_time: string | null
  event_name: string | null
  address: string | null
  client_name: string | null
  available_teams: TeamRow[]
  all_teams: TeamRow[]
  assignment: Assignment | null
}

const TEAM_PHONE_STORAGE_KEY = 'catering.teamWhatsAppPhones'

function loadStoredPhone(teamId: string): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = localStorage.getItem(TEAM_PHONE_STORAGE_KEY)
    if (!raw) return ''
    const map = JSON.parse(raw) as Record<string, string>
    return map[teamId] ?? ''
  } catch {
    return ''
  }
}

function saveStoredPhone(teamId: string, phone: string) {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(TEAM_PHONE_STORAGE_KEY)
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, string>
    map[teamId] = phone
    localStorage.setItem(TEAM_PHONE_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

export default function QuoteTeamAssignmentPanel({
  quoteId,
  proposalResponse,
  quoteStatus,
}: {
  quoteId: string
  proposalResponse?: string | null
  quoteStatus?: string | null
}) {
  const canDesignate =
    proposalResponse === 'accepted' || quoteStatus === 'approved'

  const locale = useAuthLocaleFromMe()
  const [data, setData] = useState<PanelData | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [presentationTime, setPresentationTime] = useState('')
  const [teamId, setTeamId] = useState('')
  const [phone, setPhone] = useState('')
  const [waOpen, setWaOpen] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/team-assignment`, {
        cache: 'no-store',
      })
      const json = (await res.json()) as { data?: PanelData; error?: string }
      if (!res.ok) {
        throw new Error(json.error ?? tQuotesOrders(locale, 'fetchOrdersError'))
      }
      const next = json.data!
      setData(next)
      const preset =
        (next.team_presentation_time
          ? formatTimeShort(next.team_presentation_time)
          : '') ||
        suggestPresentationTime(next.start_time)
      setPresentationTime(preset)
      setTeamId(next.designated_team_id || next.assignment?.team_id || '')
    } catch (e) {
      setError(
        e instanceof Error ? e.message : tQuotesOrders(locale, 'fetchOrdersError'),
      )
    } finally {
      setLoading(false)
    }
  }, [quoteId, locale])

  useEffect(() => {
    if (canDesignate) void load()
  }, [canDesignate, load])

  const selectedTeam = useMemo(() => {
    if (!data || !teamId) return null
    return (
      data.all_teams.find((t) => t.id === teamId) ||
      data.available_teams.find((t) => t.id === teamId) ||
      null
    )
  }, [data, teamId])

  const defaultMessage = useMemo(() => {
    if (!data?.assignment || !selectedTeam) return ''
    const a = data.assignment
    return buildTeamAvailabilityWhatsAppText({
      teamName: selectedTeam.name,
      leaderName: parseTeamLeaderFromNotes(selectedTeam.notes),
      eventCode: a.code,
      eventTitle: data.event_name || a.code,
      clientName: data.client_name,
      eventDate: a.event_date || data.event_date || '',
      startTime: formatTimeShort(a.start_time || data.start_time),
      endTime: formatTimeShort(a.end_time || data.end_time),
      presentationTime:
        formatTimeShort(a.presentation_time) || presentationTime,
      address: data.address,
      companyName: 'BBQ At Home',
      confirmUrl: a.public_url,
      language:
        selectedTeam.contact?.preferred_language ||
        selectedTeam.preferred_language ||
        'pt',
    })
  }, [data, selectedTeam, presentationTime])

  useEffect(() => {
    setMessage(defaultMessage)
  }, [defaultMessage])

  useEffect(() => {
    if (!teamId) return
    const fromPerson = selectedTeam?.contact?.phone?.trim()
    const stored = loadStoredPhone(teamId)
    setPhone(fromPerson || stored || '')
  }, [teamId, selectedTeam])

  if (!canDesignate) return null

  const responseLabel =
    data?.assignment?.team_assignment_response === 'accepted'
      ? tQuotesOrders(locale, 'teamAccepted')
      : data?.assignment?.team_assignment_response === 'rejected'
        ? tQuotesOrders(locale, 'teamRejected')
        : data?.assignment?.team_assignment_sent_at
          ? tQuotesOrders(locale, 'awaitingTeamAcceptance')
          : data?.assignment
            ? tQuotesOrders(locale, 'designatedNotSent')
            : tQuotesOrders(locale, 'notDesignatedYet')

  const teamOptions = useMemo(() => {
    if (!data) return []
    const map = new Map<string, TeamRow>()
    for (const t of data.available_teams) map.set(t.id, t)
    // Mantém a equipe já designada na lista mesmo se “ocupada” por este evento
    if (teamId) {
      const current = data.all_teams.find((t) => t.id === teamId)
      if (current) map.set(current.id, current)
    }
    return Array.from(map.values())
  }, [data, teamId])

  async function designate() {
    setBusy(true)
    setError(null)
    setHint(null)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/team-assignment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'designate',
          team_id: teamId,
          presentation_time: presentationTime,
        }),
      })
      const json = (await res.json()) as {
        data?: { assignment?: Assignment }
        error?: string
      }
      if (!res.ok) {
        throw new Error(json.error ?? tQuotesOrders(locale, 'designateError'))
      }
      setHint(tQuotesOrders(locale, 'designateSuccessHint'))
      await load()
      setWaOpen(true)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : tQuotesOrders(locale, 'designateError'),
      )
    } finally {
      setBusy(false)
    }
  }

  async function ensureSent(options?: { openWa?: boolean }) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/team-assignment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_sent' }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(json.error ?? tQuotesOrders(locale, 'registerSendError'))
      }
      await load()
      if (options?.openWa !== false) setWaOpen(true)
      setHint(tQuotesOrders(locale, 'teamSentHint'))
      return true
    } catch (e) {
      setError(
        e instanceof Error ? e.message : tQuotesOrders(locale, 'registerSendError'),
      )
      return false
    } finally {
      setBusy(false)
    }
  }

  const phoneOk = Boolean(normalizeWhatsAppPhone(phone))

  return (
    <section className="no-print liquid-glass-card mt-4 space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-cdl-fg">
            {tQuotesOrders(locale, 'designateTeam')}
          </h2>
          <p className="mt-1 text-sm text-cdl-muted">
            {tQuotesOrders(locale, 'designateTeamSubtitle')}
          </p>
        </div>
        <span className="rounded-full border border-cdl-border bg-cdl-inset px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cdl-muted">
          {responseLabel}
        </span>
      </div>

      {loading && !data ? (
        <p className="text-sm text-cdl-muted">{tQuotesOrders(locale, 'loadingGeneric')}</p>
      ) : null}

      {data ? (
        <>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-cdl-muted">{tQuotesOrders(locale, 'eventDateFieldLabel')}</dt>
              <dd className="font-medium text-cdl-fg">
                {formatDate(data.event_date)}
              </dd>
            </div>
            <div>
              <dt className="text-cdl-muted">{tQuotesOrders(locale, 'eventTimeFieldLabel')}</dt>
              <dd className="font-medium text-cdl-fg">
                {formatTimeShort(data.start_time)} –{' '}
                {formatTimeShort(data.end_time)}
              </dd>
            </div>
            {data.address ? (
              <div className="sm:col-span-2">
                <dt className="text-cdl-muted">{tQuotesOrders(locale, 'locationLabel')}</dt>
                <dd className="font-medium text-cdl-fg">{data.address}</dd>
              </div>
            ) : null}
          </dl>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-cdl-muted">
              {tQuotesOrders(locale, 'presentationTimeLabel')}
            </span>
            <input
              type="time"
              className={glassField()}
              value={presentationTime}
              onChange={(e) => setPresentationTime(e.target.value)}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-cdl-muted">
              {tQuotesOrders(locale, 'teamFieldLabel')}
            </span>
            <select
              className={glassField()}
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              <option value="">{tQuotesOrders(locale, 'selectPlaceholder')}</option>
              {teamOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {teamOptions.length === 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-200">
                {tQuotesOrders(locale, 'noTeamAvailable')}
              </p>
            ) : null}
          </label>

          {data.assignment?.public_url ? (
            <p className="break-all rounded-xl border border-cdl-border bg-cdl-inset px-3 py-2 text-xs text-cdl-fg">
              {data.assignment.public_url}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={glassBtn('primary')}
              disabled={busy || !teamId || !presentationTime}
              onClick={() => void designate()}
            >
              {data.assignment
                ? tQuotesOrders(locale, 'updateDesignation')
                : tQuotesOrders(locale, 'designateAndGenerateLink')}
            </button>
            <button
              type="button"
              className={glassBtn('secondary')}
              disabled={busy || !data.assignment}
              onClick={() => void ensureSent({ openWa: true })}
            >
              {tQuotesOrders(locale, 'teamWhatsAppButton')}
            </button>
          </div>
        </>
      ) : null}

      {waOpen && data?.assignment ? (
        <div className="space-y-3 rounded-xl border border-emerald-300/40 bg-emerald-50/80 p-4 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">
            {tQuotesOrders(locale, 'sendDesignationTitle')} {data.assignment.code}
          </p>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-cdl-muted">
              {tQuotesOrders(locale, 'phoneOfPersonOrLeader')}
            </span>
            <input
              className={glassField()}
              type="tel"
              placeholder="+55 11 …"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => {
                if (teamId && phone.trim()) saveStoredPhone(teamId, phone.trim())
              }}
            />
          </label>
          <textarea
            className="min-h-[12rem] w-full rounded-lg border border-cdl-border bg-cdl-surface p-3 text-xs text-cdl-fg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            type="button"
            className={glassBtn('ghost')}
            onClick={() => setMessage(defaultMessage)}
          >
            {tQuotesOrders(locale, 'restoreDefaultText')}
          </button>

          <div className="flex w-full flex-col gap-2">
            <WhatsAppButton
              phone={phone}
              message={message}
              editable
              onMessageChange={setMessage}
              className="h-12 w-full justify-center"
              title={
                phoneOk
                  ? `WhatsApp · ${formatWhatsAppPhoneDisplay(phone)}`
                  : tQuotesOrders(locale, 'informPhoneHint')
              }
              onOpenRequested={() => {
                if (teamId && phone.trim()) saveStoredPhone(teamId, phone.trim())
                void ensureSent({ openWa: true })
              }}
              onInvalidPhone={() =>
                setHint(tQuotesOrders(locale, 'informPhoneHint'))
              }
            >
              <span className="inline-flex items-center gap-2">
                <WhatsAppIcon className="h-5 w-5" />
                {tQuotesOrders(locale, 'openWhatsAppDesktop')}
              </span>
            </WhatsAppButton>

            {buildSmsShareHref(phone, message) ? (
              <SmsShareAnchor
                href={buildSmsShareHref(phone, message)!}
                message={message}
                className={`${glassAction('sky')} h-12 w-full justify-center`}
                title={tQuotesOrders(locale, 'sendBySms')}
                aria-label={tQuotesOrders(locale, 'sendBySms')}
                onOpen={() => {
                  if (teamId && phone.trim()) saveStoredPhone(teamId, phone.trim())
                  void ensureSent({ openWa: false })
                }}
                onDesktopHint={() => setHint(tQuotesOrders(locale, 'smsCopiedHint'))}
              >
                <span className="inline-flex items-center gap-2">
                  <SmsIcon className="h-5 w-5" />
                  {tQuotesOrders(locale, 'sendBySms')}
                </span>
              </SmsShareAnchor>
            ) : (
              <button
                type="button"
                disabled
                className={`${glassAction('sky')} h-12 w-full justify-center opacity-50`}
              >
                <span className="inline-flex items-center gap-2">
                  <SmsIcon className="h-5 w-5" />
                  {tQuotesOrders(locale, 'sendBySms')}
                </span>
              </button>
            )}

            {(() => {
              const mailHref = buildMailtoHref({
                email: selectedTeam?.contact?.email,
                subject: `Designação ${data.assignment.code} — BBQ At Home`,
                body: message,
              })
              return mailHref ? (
                <a
                  href={mailHref}
                  className={`${glassAction('sky')} h-11 w-fit justify-center px-4`}
                  onClick={() => {
                    void ensureSent({ openWa: false })
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <MailIcon className="h-5 w-5" />
                    {tQuotesOrders(locale, 'emailLabel')}
                  </span>
                </a>
              ) : null
            })()}

            <button
              type="button"
              className={glassBtn('ghost')}
              onClick={() => setWaOpen(false)}
            >
              {tQuotesOrders(locale, 'closeLabel')}
            </button>
          </div>

          {phoneOk ? (
            <p className="text-xs text-cdl-muted">
              {tQuotesOrders(locale, 'destinationLabel')}: {formatWhatsAppPhoneDisplay(phone)}
            </p>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-200">
              {tQuotesOrders(locale, 'informPhoneHint')}
            </p>
          )}
        </div>
      ) : null}

      {hint ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-200">{hint}</p>
      ) : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </section>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  buildTeamAvailabilityWhatsAppText,
  resolveTeamLeaderDisplayName,
} from '@/Lib/whatsappMessageTemplates'
import { MailIcon, SmsIcon, WhatsAppIcon } from '@/components/icons/ShareIcons'
import SmsShareAnchor from '@/components/share/SmsShareAnchor'
import WhatsAppButton from '@/components/share/WhatsAppButton'
import { buildMailtoHref } from '@/Lib/quoteProposal'
import { buildSmsShareHref } from '@/Lib/smsShare'
import {
  formatWhatsAppPhoneDisplay,
  normalizeWhatsAppPhone,
} from '@/Lib/whatsapp'
import { tAgenda } from '@/Lib/i18n/agenda'
import type { AuthLocale } from '@/Lib/i18n/authUsers'
import { tCommon } from '@/Lib/i18n/common'
import { glassAction, glassBtn, glassField } from '@/Lib/liquidGlass'

const TEAM_PHONE_STORAGE_KEY = 'catering.teamWhatsAppPhones'

const SHARE_ICON =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center p-0'

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

export default function TeamAvailabilitySharePanel({
  locale,
  teamId,
  teamName,
  teamNotes,
  eventCode,
  eventTitle,
  clientName,
  eventDate,
  startTime,
  endTime,
  presentationTime,
  confirmUrl,
  address,
  quoteId,
  language = 'pt',
  defaultPhone,
  contactFullName,
  contactAbName,
  packageLabel,
  companyName = 'BBQ At Home',
}: {
  locale: AuthLocale
  teamId: string
  teamName: string
  teamNotes?: string | null
  eventCode: string
  eventTitle: string
  clientName?: string | null
  eventDate: string
  startTime: string
  endTime: string
  presentationTime?: string | null
  confirmUrl?: string | null
  address?: string | null
  quoteId?: string | null
  /** Idioma preferido da equipe/pessoa: pt | en | es */
  language?: string | null
  /** Telefone da pessoa vinculada (cadastro único) */
  defaultPhone?: string | null
  contactFullName?: string | null
  contactAbName?: string | null
  packageLabel?: string | null
  companyName?: string | null
}) {
  const leaderName = useMemo(
    () =>
      resolveTeamLeaderDisplayName({
        contactFullName,
        contactAbName,
        teamName,
        notes: teamNotes,
      }),
    [contactFullName, contactAbName, teamName, teamNotes],
  )

  const defaultMessage = useMemo(
    () =>
      buildTeamAvailabilityWhatsAppText({
        teamName,
        leaderName,
        eventCode,
        eventTitle,
        clientName,
        eventDate,
        startTime,
        endTime,
        presentationTime,
        address,
        packageLabel,
        companyName,
        confirmUrl,
        language,
      }),
    [
      teamName,
      leaderName,
      eventCode,
      eventTitle,
      clientName,
      eventDate,
      startTime,
      endTime,
      presentationTime,
      address,
      packageLabel,
      companyName,
      confirmUrl,
      language,
    ],
  )

  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState(defaultMessage)
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    const fromPerson = defaultPhone?.trim()
    const stored = loadStoredPhone(teamId)
    setPhone(fromPerson || stored || '')
  }, [teamId, defaultPhone])

  useEffect(() => {
    setMessage(defaultMessage)
  }, [defaultMessage])

  const phoneOk = Boolean(normalizeWhatsAppPhone(phone))

  async function ensureAssignmentSent() {
    if (!quoteId) return
    try {
      await fetch(`/api/quotes/${quoteId}/team-assignment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_sent' }),
      })
    } catch {
      /* best-effort: libera can_respond no link público */
    }
  }

  const assignmentLabel = tAgenda(locale, 'assignmentTitle', { team: teamName })
  const leaderSuffix = leaderName ? ` (${leaderName})` : ''

  return (
    <div className="mt-2 w-full space-y-2">
      <button
        type="button"
        className={open ? glassBtn('secondary') : glassAction('green')}
        onClick={() => {
          setOpen((v) => !v)
          setHint(null)
        }}
      >
        {open ? (
          tAgenda(locale, 'closeTeamWhatsApp')
        ) : (
          <span className="inline-flex items-center gap-2">
            <WhatsAppIcon className="h-5 w-5 text-white" />
            {tAgenda(locale, 'teamWhatsApp')}
          </span>
        )}
      </button>

      {open ? (
        <div className="space-y-3 rounded-xl border border-emerald-300/40 bg-emerald-50/80 p-4 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">
            {assignmentLabel}
            {leaderSuffix}
          </p>
          {presentationTime ? (
            <p className="text-xs text-cdl-muted">
              {tAgenda(locale, 'presentationAt')} <strong>{presentationTime}</strong>
            </p>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-200">
              {tAgenda(locale, 'presentationMissing')}
            </p>
          )}
          {confirmUrl ? (
            <p className="break-all text-xs text-cdl-muted">{confirmUrl}</p>
          ) : null}
          <p className="text-xs text-cdl-muted">
            {tAgenda(locale, 'editBeforeSend')}
          </p>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-cdl-muted">
              {tAgenda(locale, 'teamWhatsAppPhone')}
            </span>
            <input
              className={glassField()}
              type="tel"
              placeholder={tAgenda(locale, 'phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => {
                if (phone.trim()) saveStoredPhone(teamId, phone.trim())
              }}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-cdl-muted">
              {tCommon(locale, 'editableMessage')}
            </span>
            <textarea
              className="min-h-[10rem] w-full rounded-lg border border-cdl-border bg-cdl-surface p-3 text-xs text-cdl-fg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={glassBtn('ghost')}
            onClick={() => setMessage(defaultMessage)}
          >
            {tCommon(locale, 'restoreDefault')}
          </button>
          <div className="proposal-toolbar flex flex-wrap items-center gap-2">
            <WhatsAppButton
              phone={phone}
              message={message}
              editable
              onMessageChange={setMessage}
              className={SHARE_ICON}
              title={
                phoneOk
                  ? `WhatsApp · ${formatWhatsAppPhoneDisplay(phone)}`
                  : tCommon(locale, 'invalidPhone')
              }
              onOpenRequested={() => {
                void ensureAssignmentSent()
                if (phone.trim()) saveStoredPhone(teamId, phone.trim())
              }}
              onInvalidPhone={() =>
                setHint(tCommon(locale, 'invalidPhone'))
              }
            />
            {buildSmsShareHref(phone, message) ? (
              <SmsShareAnchor
                href={buildSmsShareHref(phone, message)!}
                message={message}
                className={`${glassAction('sky', true)} ${SHARE_ICON}`}
                title={tCommon(locale, 'sendSms')}
                aria-label={tCommon(locale, 'sendSms')}
                onOpen={() => {
                  void ensureAssignmentSent()
                  if (phone.trim()) saveStoredPhone(teamId, phone.trim())
                }}
                onDesktopHint={() =>
                  setHint(tAgenda(locale, 'smsCopiedHint'))
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
              const mailHref = buildMailtoHref({
                email: null,
                subject: tAgenda(locale, 'emailSubject', {
                  code: eventCode,
                  company: companyName || 'BBQ At Home',
                }),
                body: message,
              })
              return mailHref ? (
                <a
                  href={mailHref}
                  className={`${glassAction('sky', true)} ${SHARE_ICON}`}
                  title={tCommon(locale, 'email')}
                  aria-label={tCommon(locale, 'email')}
                  onClick={() => {
                    void ensureAssignmentSent()
                  }}
                >
                  <MailIcon className="h-5 w-5" />
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className={`${glassAction('sky', true)} ${SHARE_ICON} opacity-50`}
                  title={tAgenda(locale, 'emailUnavailable')}
                  aria-label={tAgenda(locale, 'emailUnavailable')}
                >
                  <MailIcon className="h-5 w-5" />
                </button>
              )
            })()}
          </div>
          {phoneOk ? (
            <p className="text-xs text-cdl-muted">
              {tAgenda(locale, 'destination')}: {formatWhatsAppPhoneDisplay(phone)}
            </p>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-200">
              {tAgenda(locale, 'phoneToEnableSend')}
            </p>
          )}
          {hint ? (
            <p className="text-xs text-emerald-800 dark:text-emerald-100">{hint}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

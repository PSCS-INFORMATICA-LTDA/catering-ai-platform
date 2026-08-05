'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  buildTeamAvailabilityWhatsAppText,
  parseTeamLeaderFromNotes,
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
import { glassAction, glassBtn, glassField } from '@/Lib/liquidGlass'

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

export default function TeamAvailabilitySharePanel({
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
  packageLabel,
  companyName = 'BBQ At Home',
}: {
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
  packageLabel?: string | null
  companyName?: string | null
}) {
  const leaderName = useMemo(
    () => parseTeamLeaderFromNotes(teamNotes),
    [teamNotes],
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

  return (
    <div className="mt-2 w-full space-y-2">
      <button
        type="button"
        className={glassBtn('secondary', 'liquid-glass-tab-link--plain')}
        onClick={() => {
          setOpen((v) => !v)
          setHint(null)
        }}
      >
        {open ? 'Fechar WhatsApp equipe' : 'Designação / WhatsApp equipe'}
      </button>

      {open ? (
        <div className="space-y-3 rounded-xl border border-emerald-300/40 bg-emerald-50/80 p-4 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">
            Designação da equipe — {teamName}
            {leaderName ? ` (${leaderName})` : ''}
          </p>
          {presentationTime ? (
            <p className="text-xs text-cdl-muted">
              Apresentação no local: <strong>{presentationTime}</strong>
            </p>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-200">
              Defina o horário de apresentação na cotação (após aceite do
              cliente) para incluir na mensagem.
            </p>
          )}
          {confirmUrl ? (
            <p className="break-all text-xs text-cdl-muted">{confirmUrl}</p>
          ) : null}
          <p className="text-xs text-cdl-muted">
            Edite o texto antes de enviar. O telefone fica salvo neste navegador.
          </p>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-cdl-muted">
              WhatsApp da equipe / líder
            </span>
            <input
              className={glassField()}
              type="tel"
              placeholder="+1 407 … ou (11) 9… "
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => {
                if (phone.trim()) saveStoredPhone(teamId, phone.trim())
              }}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-cdl-muted">
              Mensagem (editável)
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
            Restaurar texto padrão
          </button>
          <div className="flex w-full flex-col gap-2">
            <WhatsAppButton
              phone={phone}
              message={message}
              editable
              onMessageChange={setMessage}
              className="h-12 w-full justify-center"
              onOpenRequested={() => {
                void ensureAssignmentSent()
                if (phone.trim()) saveStoredPhone(teamId, phone.trim())
              }}
              onInvalidPhone={() =>
                setHint('Informe um telefone válido com DDI.')
              }
            >
              <span className="inline-flex items-center gap-2">
                <WhatsAppIcon className="h-5 w-5" />
                Abrir WhatsApp Desktop
              </span>
            </WhatsAppButton>
            {buildSmsShareHref(phone, message) ? (
              <SmsShareAnchor
                href={buildSmsShareHref(phone, message)!}
                message={message}
                className={`${glassAction('sky')} h-12 w-full justify-center`}
                onOpen={() => {
                  void ensureAssignmentSent()
                  if (phone.trim()) saveStoredPhone(teamId, phone.trim())
                }}
                onDesktopHint={() =>
                  setHint('Mensagem SMS copiada. No PC use Phone Link se disponível.')
                }
              >
                <span className="inline-flex items-center gap-2">
                  <SmsIcon className="h-5 w-5" />
                  Enviar por SMS
                </span>
              </SmsShareAnchor>
            ) : null}
            {(() => {
              const mailHref = buildMailtoHref({
                email: null,
                subject: `Designação ${eventCode} — BBQ At Home`,
                body: message,
              })
              return mailHref ? (
                <a
                  href={mailHref}
                  className={`${glassAction('sky')} h-11 w-fit justify-center px-4`}
                  onClick={() => {
                    void ensureAssignmentSent()
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <MailIcon className="h-5 w-5" />
                    E-mail
                  </span>
                </a>
              ) : null
            })()}
          </div>
          {phoneOk ? (
            <p className="text-xs text-cdl-muted">
              Destino: {formatWhatsAppPhoneDisplay(phone)}
            </p>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-200">
              Informe um telefone válido com DDI para liberar o envio.
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

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MailIcon, SmsIcon } from '@/components/icons/ShareIcons'
import SmsShareAnchor from '@/components/share/SmsShareAnchor'
import WhatsAppButton from '@/components/share/WhatsAppButton'
import {
  buildMailtoHref,
  buildQuoteProposalEmailBody,
  buildQuoteProposalEmailSubject,
  buildQuoteProposalShareText,
  buildPublicProposalUrl,
  resolveClientProposalShareUrl,
} from '@/Lib/quoteProposal'
import { buildSmsShareHref } from '@/Lib/smsShare'
import {
  copyWhatsAppMessageSync,
  formatWhatsAppPhoneDisplay,
  normalizeWhatsAppPhone,
} from '@/Lib/whatsapp'
import { glassAction, glassBtn } from '@/Lib/liquidGlass'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

type ProposalState = {
  proposal_token: string | null
  proposal_sent_at: string | null
  proposal_response: string
  quote_status: string | null
}

const SHARE_ICON =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center p-0'

export default function QuoteProposalSharePanel({
  quoteId,
  quoteNumber,
  customerName,
  customerPhone,
  customerEmail,
  eventDate,
  startTime,
  endTime,
  packageLabel,
  quoteTotal,
  reservationAmount,
  currencyCode,
  companyName,
  adultCount,
  childrenUnder3Count,
  children4To12Count,
  addressLine,
  city,
  addressState,
  language = 'pt',
  packageTotal,
  additionalTotal,
  packageHasGarnish,
  garnishIncludedTotal,
  garnishDescription,
  packageItemsDescription,
  packageUnitPrice,
  packageSelectionLines,
  additionalLines,
  mileageFee,
  chargedMiles,
  mileageFreeLimit,
  grillRentalTotal,
  grillRentalQty,
  discountAmount,
  baseSubtotal,
  holidaySurchargeAmount,
  minimumOrderAdjustment,
  minimumOrderAmount,
  commercialReason,
  initial,
}: {
  quoteId: string
  quoteNumber: string
  customerName?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
  eventDate?: string | null
  startTime?: string | null
  endTime?: string | null
  packageLabel?: string | null
  quoteTotal?: number | null
  reservationAmount?: number | null
  currencyCode?: string | null
  companyName?: string | null
  adultCount?: number | null
  childrenUnder3Count?: number | null
  children4To12Count?: number | null
  addressLine?: string | null
  city?: string | null
  addressState?: string | null
  language?: string | null
  packageTotal?: number | null
  additionalTotal?: number | null
  packageHasGarnish?: boolean | null
  garnishIncludedTotal?: number | null
  garnishDescription?: string | null
  packageItemsDescription?: string | null
  packageUnitPrice?: number | null
  packageSelectionLines?: Array<{
    groupTitle: string
    itemLabel: string
  }> | null
  additionalLines?: Array<{
    label: string
    amount: number
    isGarnish?: boolean
  }> | null
  mileageFee?: number | null
  chargedMiles?: number | null
  mileageFreeLimit?: number | null
  grillRentalTotal?: number | null
  grillRentalQty?: number | null
  discountAmount?: number | null
  baseSubtotal?: number | null
  holidaySurchargeAmount?: number | null
  minimumOrderAdjustment?: number | null
  minimumOrderAmount?: number | null
  commercialReason?:
    | 'weekday'
    | 'weekend'
    | 'dec_jan'
    | 'cdl_holiday'
    | 'us_holiday'
    | 'none'
    | null
  initial?: Partial<ProposalState> | null
}) {
  const uiLocale = useAuthLocaleFromMe()
  const [state, setState] = useState<ProposalState>({
    proposal_token: initial?.proposal_token ?? null,
    proposal_sent_at: initial?.proposal_sent_at ?? null,
    proposal_response: initial?.proposal_response ?? 'pending',
    quote_status: initial?.quote_status ?? null,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  const publicUrl = useMemo(
    () => resolveClientProposalShareUrl(state.proposal_token),
    [state.proposal_token],
  )

  const defaultMessage = useMemo(() => {
    if (!publicUrl) return ''
    return buildQuoteProposalShareText({
      quoteNumber,
      customerName,
      eventDate,
      startTime,
      endTime,
      packageLabel,
      quoteTotal,
      reservationAmount,
      currencyCode,
      proposalUrl: publicUrl,
      companyName,
      adultCount,
      childrenUnder3Count,
      children4To12Count,
      addressLine,
      city,
      state: addressState,
      language,
      packageTotal,
      additionalTotal,
      packageHasGarnish,
      garnishIncludedTotal,
      garnishDescription,
      packageItemsDescription,
      packageUnitPrice,
      packageSelectionLines,
      additionalLines,
      mileageFee,
      chargedMiles,
      mileageFreeLimit,
      grillRentalTotal,
      grillRentalQty,
      discountAmount,
      baseSubtotal,
      holidaySurchargeAmount,
      minimumOrderAdjustment,
      minimumOrderAmount,
      commercialReason,
    })
  }, [
    publicUrl,
    quoteNumber,
    customerName,
    eventDate,
    startTime,
    endTime,
    packageLabel,
    quoteTotal,
    reservationAmount,
    currencyCode,
    companyName,
    adultCount,
    childrenUnder3Count,
    children4To12Count,
    addressLine,
    city,
    addressState,
    language,
    packageTotal,
    additionalTotal,
    packageHasGarnish,
    garnishIncludedTotal,
    garnishDescription,
    packageItemsDescription,
    packageUnitPrice,
    packageSelectionLines,
    additionalLines,
    mileageFee,
    chargedMiles,
    mileageFreeLimit,
    grillRentalTotal,
    grillRentalQty,
    discountAmount,
    baseSubtotal,
    holidaySurchargeAmount,
    minimumOrderAdjustment,
    minimumOrderAmount,
    commercialReason,
  ])

  const [message, setMessage] = useState(defaultMessage)

  useEffect(() => {
    setMessage(defaultMessage)
  }, [defaultMessage])

  const phoneOk = Boolean(normalizeWhatsAppPhone(customerPhone))
  const phoneLabel = formatWhatsAppPhoneDisplay(customerPhone)
  const smsHref = buildSmsShareHref(customerPhone, message)
  const mailHref = buildMailtoHref({
    email: customerEmail,
    subject: buildQuoteProposalEmailSubject({
      quoteNumber,
      proposalUrl: publicUrl || '',
      language,
    }),
    body:
      message ||
      buildQuoteProposalEmailBody({
        quoteNumber,
        customerName,
        eventDate,
        startTime,
        endTime,
        packageLabel,
        quoteTotal,
        reservationAmount,
        currencyCode,
        proposalUrl: publicUrl || buildPublicProposalUrl('…'),
        companyName,
        adultCount,
        childrenUnder3Count,
        children4To12Count,
        addressLine,
        city,
        state: addressState,
        language,
        packageTotal,
        additionalTotal,
        packageHasGarnish,
        garnishIncludedTotal,
        garnishDescription,
        packageItemsDescription,
        packageUnitPrice,
        packageSelectionLines,
        additionalLines,
        mileageFee,
        chargedMiles,
        mileageFreeLimit,
        grillRentalTotal,
        grillRentalQty,
        discountAmount,
        baseSubtotal,
        holidaySurchargeAmount,
        minimumOrderAdjustment,
        minimumOrderAmount,
        commercialReason,
      }),
  })

  const markSent = useCallback(
    async (action: 'mark_sent' | 'follow_up' | 'ensure_token' = 'mark_sent') => {
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(`/api/quotes/${quoteId}/proposal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        })
        const json = (await res.json()) as {
          data?: {
            token?: string
            proposal_token?: string
            proposal_sent_at?: string | null
            proposal_response?: string
            quote_status?: string | null
          }
          error?: string
        }
        if (!res.ok) {
          throw new Error(json.error ?? tQuotesOrders(uiLocale, 'registerSendError'))
        }
        const token = json.data?.token || json.data?.proposal_token || null
        setState((s) => ({
          ...s,
          proposal_token: token,
          proposal_sent_at:
            json.data?.proposal_sent_at ??
            s.proposal_sent_at ??
            new Date().toISOString(),
          proposal_response: json.data?.proposal_response ?? s.proposal_response,
          quote_status: json.data?.quote_status ?? s.quote_status,
        }))
        setHint(
          action === 'mark_sent'
            ? tQuotesOrders(uiLocale, 'sendRegisteredHint')
            : tQuotesOrders(uiLocale, 'readyHint'),
        )
        return token
      } catch (e) {
        setError(
          e instanceof Error ? e.message : tQuotesOrders(uiLocale, 'registerSendError'),
        )
        return null
      } finally {
        setBusy(false)
      }
    },
    [quoteId, uiLocale],
  )

  async function ensureReady() {
    if (state.proposal_token && state.proposal_sent_at) {
      return state.proposal_token
    }
    return markSent('mark_sent')
  }

  async function copyLink() {
    const token = await ensureReady()
    if (!token) return
    const url = buildPublicProposalUrl(token)
    try {
      await navigator.clipboard.writeText(url)
      setHint(tQuotesOrders(uiLocale, 'linkCopied'))
    } catch {
      copyWhatsAppMessageSync(url)
      setHint(tQuotesOrders(uiLocale, 'linkCopiedFallback'))
    }
  }

  const responseLabel =
    state.proposal_response === 'accepted'
      ? tQuotesOrders(uiLocale, 'customerAccepted')
      : state.proposal_response === 'rejected'
        ? tQuotesOrders(uiLocale, 'customerRejected')
        : state.proposal_sent_at
          ? tQuotesOrders(uiLocale, 'awaitingCustomerAcceptance')
          : tQuotesOrders(uiLocale, 'notSentYet')

  return (
    <section className="no-print liquid-glass-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-cdl-fg">
            {tQuotesOrders(uiLocale, 'sendQuoteToCustomer')}
          </h2>
          <p className="mt-1 text-sm text-cdl-muted">
            {tQuotesOrders(uiLocale, 'shareSubtitlePrefix')}{' '}
            {(language || 'pt').toUpperCase()}.
          </p>
        </div>
        <span className="rounded-full border border-cdl-border bg-cdl-inset px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cdl-muted">
          {responseLabel}
        </span>
      </div>

      {publicUrl ? (
        <p className="break-all rounded-xl border border-cdl-border bg-cdl-inset px-3 py-2 text-xs text-cdl-fg">
          {publicUrl}
        </p>
      ) : (
        <p className="text-sm text-cdl-muted">
          {tQuotesOrders(uiLocale, 'clickRegisterSendPrefix')}{' '}
          <strong>{tQuotesOrders(uiLocale, 'registerSend')}</strong>{' '}
          {tQuotesOrders(uiLocale, 'clickRegisterSendSuffix')}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={glassBtn('primary')}
          disabled={busy}
          onClick={() => void markSent('mark_sent')}
        >
          {state.proposal_sent_at
            ? tQuotesOrders(uiLocale, 'resendUpdate')
            : tQuotesOrders(uiLocale, 'registerSend')}
        </button>
        <button
          type="button"
          className={glassBtn('secondary')}
          disabled={busy}
          onClick={() => void copyLink()}
        >
          {tQuotesOrders(uiLocale, 'copyPublicLink')}
        </button>
      </div>

      {publicUrl ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-cdl-muted">
            {tQuotesOrders(uiLocale, 'editableMessageLabel')} ·{' '}
            {phoneOk ? phoneLabel : tQuotesOrders(uiLocale, 'noPhoneLabel')}
          </span>
          <textarea
            className="min-h-[10rem] w-full rounded-lg border border-cdl-border bg-cdl-surface p-3 text-xs text-cdl-fg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            type="button"
            className={glassBtn('ghost')}
            onClick={() => setMessage(defaultMessage)}
          >
            {tQuotesOrders(uiLocale, 'restoreDefaultText')}
          </button>
        </label>
      ) : null}

      <div className="proposal-toolbar flex flex-wrap items-center gap-2">
        <WhatsAppButton
          phone={customerPhone}
          message={message}
          editable
          onMessageChange={setMessage}
          disabled={busy || !publicUrl}
          className={SHARE_ICON}
          title={
            phoneOk
              ? `WhatsApp · ${phoneLabel}`
              : tQuotesOrders(uiLocale, 'registerPhoneShort')
          }
          onOpenRequested={() => {
            void ensureReady()
          }}
          onInvalidPhone={() =>
            setHint(tQuotesOrders(uiLocale, 'registerPhoneShort'))
          }
        />

        {smsHref ? (
          <SmsShareAnchor
            href={smsHref}
            message={message}
            className={`${glassAction('sky', true)} ${SHARE_ICON}`}
            title={phoneOk ? `SMS · ${phoneLabel}` : 'SMS'}
            aria-label="Enviar por SMS"
            onOpen={() => {
              void ensureReady()
            }}
            onDesktopHint={() => setHint(tQuotesOrders(uiLocale, 'smsCopiedHint'))}
          >
            <SmsIcon className="h-5 w-5" />
          </SmsShareAnchor>
        ) : (
          <button
            type="button"
            disabled
            className={`${glassAction('sky', true)} ${SHARE_ICON} opacity-50`}
            title="Cadastre o telefone do cliente"
            aria-label="SMS indisponível"
          >
            <SmsIcon className="h-5 w-5" />
          </button>
        )}

        {mailHref ? (
          <a
            href={mailHref}
            className={`${glassAction('sky', true)} ${SHARE_ICON}`}
            title={
              customerEmail
                ? `E-mail · ${customerEmail}`
                : 'E-mail (escolha o destinatário no app)'
            }
            aria-label="Enviar por e-mail"
            onClick={() => {
              void ensureReady()
            }}
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
        )}
      </div>

      {!phoneOk ? (
        <p className="text-xs text-amber-700 dark:text-amber-200">
          {tQuotesOrders(uiLocale, 'registerPhoneHint')}
        </p>
      ) : null}

      {hint ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-200">{hint}</p>
      ) : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </section>
  )
}

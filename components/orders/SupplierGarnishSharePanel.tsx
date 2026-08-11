'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  computeGarnishKitsFromConfig,
  toSupplierGarnishCdlKitsInput,
  type SupplierGarnishKitConfig,
} from '@/Lib/supplierGarnishKitRule'
import {
  buildSupplierGarnishWhatsAppText,
  subtractHoursFromTime,
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
import { getCustomerDisplayName } from '@/Lib/getCustomerDisplayName'
import { glassAction, glassBtn, glassField } from '@/Lib/liquidGlass'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import { tCommon } from '@/Lib/i18n/common'
import { translateCdlItemList } from '@/Lib/cdlPackageItemI18n'
import { toBcp47Locale } from '@/Lib/i18n/locales'

const SUPPLIER_PHONE_STORAGE_KEY = 'catering.supplierWhatsAppPhones'
const LAST_SUPPLIER_STORAGE_KEY = 'catering.lastGarnishSupplierId'

const SHARE_ICON =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center p-0'

type SupplierRow = {
  id: string
  phone?: string | null
  preferred_language?: string | null
  ab_name?: string | null
  full_name?: string | null
  contact_name?: string | null
  company_name?: string | null
  is_supplier?: boolean | null
}

type GarnishState = {
  public_url: string | null
  supplier_garnish_response: string
  supplier_garnish_sent_at: string | null
  supplier_garnish_confirmed_at: string | null
  supplier_customer_id: string | null
  pickup_time: string | null
}

function loadStoredPhone(supplierId: string): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = localStorage.getItem(SUPPLIER_PHONE_STORAGE_KEY)
    if (!raw) return ''
    const map = JSON.parse(raw) as Record<string, string>
    return map[supplierId] ?? ''
  } catch {
    return ''
  }
}

function saveStoredPhone(supplierId: string, phone: string) {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(SUPPLIER_PHONE_STORAGE_KEY)
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, string>
    map[supplierId] = phone
    localStorage.setItem(SUPPLIER_PHONE_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export default function SupplierGarnishSharePanel({
  orderId,
  orderNumber,
  eventDate,
  eventStartTime,
  eventEndTime,
  teamName,
  garnishItems,
  guestCount,
  adultCount,
  hasGarnish = true,
  garnishKitConfig = null,
  companyName = 'BBQ At Home',
  language = 'pt',
}: {
  orderId: string
  orderNumber: string
  eventDate: string | null
  eventStartTime?: string | null
  eventEndTime?: string | null
  teamName?: string | null
  garnishItems: string[]
  guestCount?: number | null
  adultCount?: number | null
  hasGarnish?: boolean
  /** commercial_rules da empresa; null = sem packing de kits. */
  garnishKitConfig?: SupplierGarnishKitConfig | null
  companyName?: string | null
  language?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [phone, setPhone] = useState('')
  const [pickupTime, setPickupTime] = useState(
    () => subtractHoursFromTime(eventStartTime, 2) ?? '',
  )
  const [hint, setHint] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const uiLocale = useAuthLocaleFromMe()
  const [garnish, setGarnish] = useState<GarnishState | null>(null)

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId) ?? null,
    [suppliers, supplierId],
  )

  const supplierName = selectedSupplier
    ? getCustomerDisplayName(selectedSupplier)
    : null

  const confirmUrl = garnish?.public_url ?? null
  const messageLanguage = selectedSupplier?.preferred_language || language

  const cdlKits = useMemo(() => {
    const totalPeople = Number(guestCount ?? 0)
    if (!hasGarnish || !(totalPeople > 0) || !garnishKitConfig?.enabled) {
      return null
    }
    const result = computeGarnishKitsFromConfig(garnishKitConfig, {
      hasGarnish: true,
      totalPeople,
      adultCount,
    })
    if (result.items.length === 0) return null
    return toSupplierGarnishCdlKitsInput(result, messageLanguage)
  }, [hasGarnish, guestCount, adultCount, garnishKitConfig, messageLanguage])

  const defaultMessage = useMemo(
    () =>
      buildSupplierGarnishWhatsAppText({
        supplierName,
        orderNumber,
        eventDate: eventDate || new Date().toISOString().slice(0, 10),
        eventStartTime,
        eventEndTime,
        pickupTime: pickupTime || null,
        teamName,
        garnishItems: translateCdlItemList(garnishItems, messageLanguage),
        guestCount,
        adultCount,
        cdlKits,
        companyName,
        language: messageLanguage,
        confirmUrl,
      }),
    [
      supplierName,
      orderNumber,
      eventDate,
      eventStartTime,
      eventEndTime,
      pickupTime,
      teamName,
      garnishItems,
      guestCount,
      adultCount,
      cdlKits,
      companyName,
      messageLanguage,
      confirmUrl,
    ],
  )

  const [message, setMessage] = useState(defaultMessage)

  useEffect(() => {
    setMessage(defaultMessage)
  }, [defaultMessage])

  useEffect(() => {
    setPickupTime(subtractHoursFromTime(eventStartTime, 2) ?? '')
  }, [eventStartTime])

  const loadGarnish = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/supplier-garnish`, {
        cache: 'no-store',
      })
      const json = (await res.json()) as {
        data?: GarnishState
        error?: string
      }
      if (!res.ok) {
        if (json.error === 'migration_required') {
          setLoadError(
            tQuotesOrders(uiLocale, 'migrationPending'),
          )
          return
        }
        throw new Error(json.error ?? tQuotesOrders(uiLocale, 'loadStatusError'))
      }
      setGarnish(json.data ?? null)
      if (json.data?.pickup_time) {
        setPickupTime(json.data.pickup_time)
      }
      if (json.data?.supplier_customer_id) {
        setSupplierId(json.data.supplier_customer_id)
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : tCommon(uiLocale, 'error'))
    }
  }, [orderId, uiLocale])

  const loadSuppliers = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await fetch('/api/customers?role=supplier', {
        cache: 'no-store',
      })
      const json = (await res.json()) as {
        data?: SupplierRow[]
        error?: string
      }
      if (!res.ok) {
        throw new Error(json.error ?? tQuotesOrders(uiLocale, 'loadSuppliersError'))
      }
      const rows = (json.data ?? []).filter((row) => row.is_supplier !== false)
      setSuppliers(rows)
      const last =
        typeof window !== 'undefined'
          ? localStorage.getItem(LAST_SUPPLIER_STORAGE_KEY) ?? ''
          : ''
      setSupplierId((current) => {
        if (current && rows.some((r) => r.id === current)) return current
        return (
          (last && rows.some((r) => r.id === last) ? last : rows[0]?.id) ?? ''
        )
      })
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : tCommon(uiLocale, 'error'))
      setSuppliers([])
    }
  }, [uiLocale])

  useEffect(() => {
    if (!open) return
    void loadSuppliers()
    void loadGarnish()
  }, [open, loadSuppliers, loadGarnish])

  // Gera o link assim que houver fornecedor — para já entrar na mensagem.
  useEffect(() => {
    if (!open || !supplierId || garnish?.public_url || busy) return
    void postAction('ensure_token')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao escolher fornecedor
  }, [open, supplierId])

  useEffect(() => {
    if (!supplierId) {
      setPhone('')
      return
    }
    const fromCadastro = selectedSupplier?.phone?.trim()
    const stored = loadStoredPhone(supplierId)
    setPhone(fromCadastro || stored || '')
    try {
      localStorage.setItem(LAST_SUPPLIER_STORAGE_KEY, supplierId)
    } catch {
      /* ignore */
    }
  }, [supplierId, selectedSupplier?.phone])

  const phoneOk = Boolean(normalizeWhatsAppPhone(phone))

  async function postAction(
    action: 'ensure_token' | 'mark_sent' | 'mark_confirmed',
  ) {
    setBusy(true)
    setHint(null)
    setLoadError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/supplier-garnish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          supplier_customer_id: supplierId || null,
          pickup_time: pickupTime || null,
        }),
      })
      const json = (await res.json()) as {
        data?: GarnishState
        error?: string
      }
      if (!res.ok) {
        throw new Error(json.error ?? tQuotesOrders(uiLocale, 'updateOrderError'))
      }
      setGarnish(json.data ?? null)
      if (action === 'mark_sent') {
        setHint(tQuotesOrders(uiLocale, 'sentRegisteredHint'))
      } else if (action === 'mark_confirmed') {
        setHint(tQuotesOrders(uiLocale, 'receiptConfirmedHint'))
      } else {
        setHint(tQuotesOrders(uiLocale, 'confirmLinkReady'))
      }
      return json.data ?? null
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : tCommon(uiLocale, 'error'))
      return null
    } finally {
      setBusy(false)
    }
  }

  async function ensureReadyForSend() {
    if (supplierId && phone.trim()) {
      saveStoredPhone(supplierId, phone.trim())
    }
    const data = await postAction('mark_sent')
    return data?.public_url ?? confirmUrl
  }

  const responseLabel =
    garnish?.supplier_garnish_response === 'confirmed'
      ? tQuotesOrders(uiLocale, 'confirmedBySupplier')
      : garnish?.supplier_garnish_sent_at
        ? tQuotesOrders(uiLocale, 'awaitingConfirmation')
        : tQuotesOrders(uiLocale, 'notSent')

  return (
    <section className="liquid-glass-card space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-cdl-fg">
            {tQuotesOrders(uiLocale, 'supplierGarnishTitle')}
          </h2>
          <p className="text-xs text-cdl-muted">
            {tQuotesOrders(uiLocale, 'supplierGarnishSubtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-cdl-border bg-cdl-inset px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cdl-muted">
            {responseLabel}
          </span>
          <button
            type="button"
            className={
              open
                ? glassBtn('secondary')
                : glassAction('green')
            }
            onClick={() => {
              setOpen((v) => !v)
              setHint(null)
            }}
          >
            {open ? (
              tCommon(uiLocale, 'close')
            ) : (
              <span className="inline-flex items-center gap-2">
                <WhatsAppIcon className="h-5 w-5 text-white" />
                {tQuotesOrders(uiLocale, 'supplierWhatsApp')}
              </span>
            )}
          </button>
        </div>
      </div>

      {(garnish?.supplier_garnish_sent_at ||
        garnish?.supplier_garnish_confirmed_at) &&
      !open ? (
        <p className="text-xs text-cdl-muted">
          {garnish.supplier_garnish_sent_at
            ? tQuotesOrders(uiLocale, 'sentAt', {
                when: new Date(
                  garnish.supplier_garnish_sent_at,
                ).toLocaleString(toBcp47Locale(uiLocale), {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })
            : null}
          {garnish.supplier_garnish_sent_at &&
          garnish.supplier_garnish_confirmed_at
            ? ' · '
            : null}
          {garnish.supplier_garnish_confirmed_at
            ? tQuotesOrders(uiLocale, 'confirmedAt', {
                when: new Date(
                  garnish.supplier_garnish_confirmed_at,
                ).toLocaleString(toBcp47Locale(uiLocale), {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })
            : null}
        </p>
      ) : null}

      {open ? (
        <div className="space-y-3 rounded-xl border border-amber-300/40 bg-amber-50/70 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          {loadError ? (
            <p className="text-xs text-red-600">{loadError}</p>
          ) : null}
          {suppliers.length === 0 && !loadError ? (
            <p className="text-xs text-amber-800 dark:text-amber-100">
              {tQuotesOrders(uiLocale, 'noSuppliers')}
            </p>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-cdl-muted">
              {tCommon(uiLocale, 'supplier')}
            </span>
            <select
              className={glassField(false)}
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">
                {tQuotesOrders(uiLocale, 'selectPlaceholder')}
              </option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {getCustomerDisplayName(s)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-cdl-muted">
              {tQuotesOrders(uiLocale, 'pickupTimeLabel')}
            </span>
            <input
              type="time"
              className={glassField(false)}
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-cdl-muted">
              {tQuotesOrders(uiLocale, 'supplierWhatsAppPhone')}
            </span>
            <input
              className={glassField()}
              type="tel"
              placeholder="+55 11 …"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => {
                if (supplierId && phone.trim()) {
                  saveStoredPhone(supplierId, phone.trim())
                }
              }}
            />
          </label>

          {confirmUrl ? (
            <p className="break-all rounded-xl border border-cdl-border bg-cdl-inset px-3 py-2 text-xs text-cdl-fg">
              {confirmUrl}
            </p>
          ) : (
            <p className="text-xs text-cdl-muted">
              {tQuotesOrders(uiLocale, 'confirmLinkHint')}
            </p>
          )}

          <label className="block space-y-1">
            <span className="text-xs font-medium text-cdl-muted">
              {tQuotesOrders(uiLocale, 'editableMessageLabel')}
            </span>
            <textarea
              className="min-h-[12rem] w-full rounded-lg border border-cdl-border bg-cdl-surface p-3 text-xs text-cdl-fg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={glassBtn('ghost')}
              disabled={busy}
              onClick={() => setMessage(defaultMessage)}
            >
              {tQuotesOrders(uiLocale, 'restoreDefaultText')}
            </button>
            <button
              type="button"
              className={glassBtn('secondary')}
              disabled={busy || !supplierId}
              onClick={() => void postAction('ensure_token')}
            >
              {tQuotesOrders(uiLocale, 'generateLink')}
            </button>
          </div>

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
                  : tQuotesOrders(uiLocale, 'enterPhoneToSend')
              }
              onOpenRequested={() => {
                void ensureReadyForSend()
              }}
              onInvalidPhone={() =>
                setHint(tQuotesOrders(uiLocale, 'enterPhoneToSend'))
              }
            />
            {buildSmsShareHref(phone, message) ? (
              <SmsShareAnchor
                href={buildSmsShareHref(phone, message)!}
                message={message}
                className={`${glassAction('sky', true)} ${SHARE_ICON}`}
                title="Enviar por SMS"
                aria-label={tQuotesOrders(uiLocale, 'sendBySms')}
                onOpen={() => {
                  void ensureReadyForSend()
                }}
                onDesktopHint={() =>
                  setHint(
                    tQuotesOrders(uiLocale, 'smsCopiedHint'),
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
                title={tCommon(uiLocale, 'smsUnavailable')}
                aria-label={tCommon(uiLocale, 'smsUnavailable')}
              >
                <SmsIcon className="h-5 w-5" />
              </button>
            )}
            {(() => {
              const mailHref = buildMailtoHref({
                email: null,
                subject: tQuotesOrders(uiLocale, 'garnishEmailSubject', {
                  order: orderNumber,
                }),
                body: message,
              })
              return mailHref ? (
                <a
                  href={mailHref}
                  className={`${glassAction('sky', true)} ${SHARE_ICON}`}
                  title="E-mail"
                  aria-label={tQuotesOrders(uiLocale, 'emailLabel')}
                  onClick={() => {
                    void ensureReadyForSend()
                  }}
                >
                  <MailIcon className="h-5 w-5" />
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className={`${glassAction('sky', true)} ${SHARE_ICON} opacity-50`}
                  title={tCommon(uiLocale, 'emailUnavailable')}
                  aria-label={tCommon(uiLocale, 'emailUnavailable')}
                >
                  <MailIcon className="h-5 w-5" />
                </button>
              )
            })()}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={glassBtn('secondary')}
              disabled={busy}
              onClick={() => void postAction('mark_sent')}
            >
              {tQuotesOrders(uiLocale, 'markSent')}
            </button>
            <button
              type="button"
              className={glassBtn('primary')}
              disabled={busy}
              onClick={() => void postAction('mark_confirmed')}
            >
              {tQuotesOrders(uiLocale, 'confirmReceipt')}
            </button>
          </div>

          {phoneOk ? (
            <p className="text-xs text-cdl-muted">
              {tQuotesOrders(uiLocale, 'destinationLabel')}:{' '}
              {formatWhatsAppPhoneDisplay(phone)}
            </p>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-200">
              {tQuotesOrders(uiLocale, 'enterPhoneToSend')}
            </p>
          )}
          {hint ? (
            <p className="text-xs text-emerald-800 dark:text-emerald-100">
              {hint}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

'use client'

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { WhatsAppIcon } from '@/components/icons/ShareIcons'
import { glassAction, glassBtn } from '@/Lib/liquidGlass'
import { tCommon } from '@/Lib/i18n/common'
import { tShare } from '@/Lib/i18n/share'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import {
  copyWhatsAppMessageSync,
  formatWhatsAppPhoneDisplay,
  normalizeWhatsAppPhone,
  openWhatsApp,
  openWhatsAppWeb,
} from '@/Lib/whatsapp'

/**
 * Botão WhatsApp personalizado (padrão Logistics):
 * ícone glass verde → painel com mensagem + Desktop / Web / copiar.
 */
export default function WhatsAppButton({
  phone,
  message,
  className,
  wrapperClassName,
  title,
  'aria-label': ariaLabel,
  disabled,
  children,
  editable = false,
  onMessageChange,
  onOpenRequested,
  onInvalidPhone,
}: {
  phone: string | null | undefined
  message: string
  className?: string
  wrapperClassName?: string
  title?: string
  'aria-label'?: string
  disabled?: boolean
  children?: ReactNode
  /** Se true, permite editar a mensagem no painel (cotação BBQ). */
  editable?: boolean
  onMessageChange?: (value: string) => void
  onOpenRequested?: (meta?: { copied: boolean; mode: string }) => void
  onInvalidPhone?: () => void
}) {
  const locale = useAuthLocaleFromMe()
  const [busy, setBusy] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [copiedHint, setCopiedHint] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const openingRef = useRef(false)
  const phoneDigits = normalizeWhatsAppPhone(phone)
  const phoneOk = Boolean(phoneDigits)
  const phoneLabel =
    formatWhatsAppPhoneDisplay(phone) || phoneDigits || ''

  useEffect(() => {
    setMounted(true)
  }, [])

  const openPanel = () => {
    if (disabled || busy) return
    if (!phoneOk || !phoneDigits) {
      onInvalidPhone?.()
      return
    }
    const copied = message.trim() ? copyWhatsAppMessageSync(message) : false
    setCopiedHint(
      copied
        ? tCommon(locale, 'messageCopied')
        : tShare(locale, 'copyManual'),
    )
    setPanelOpen(true)
    onOpenRequested?.({ copied, mode: 'compose-panel' })
  }

  const handleDesktop = () => {
    if (!phoneOk || !phoneDigits || openingRef.current) return
    openingRef.current = true
    setBusy(true)
    const result = openWhatsApp({ phone: phoneDigits, message })
    setCopiedHint(
      result.copied
        ? tShare(locale, 'askedWindowsPaste')
        : tShare(locale, 'askedWindowsTaskbar'),
    )
    onOpenRequested?.({ copied: result.copied, mode: 'native' })
    window.setTimeout(() => {
      setBusy(false)
      openingRef.current = false
    }, 1500)
  }

  const handleWeb = () => {
    if (!phoneOk || !phoneDigits || openingRef.current) return
    openingRef.current = true
    setBusy(true)
    const result = openWhatsAppWeb({ phone: phoneDigits, message })
    if (result.ok) {
      onOpenRequested?.({ copied: result.copied, mode: 'web' })
    }
    window.setTimeout(() => {
      setBusy(false)
      openingRef.current = false
    }, 800)
  }

  const handleCopy = () => {
    const ok = copyWhatsAppMessageSync(message)
    setCopiedHint(
      ok ? tShare(locale, 'copiedAgain') : tShare(locale, 'copyFailed'),
    )
  }

  const panel =
    mounted && panelOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wa-compose-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPanelOpen(false)
            }}
          >
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <h2
                id="wa-compose-title"
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                {tShare(locale, 'sendTitle')}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {tShare(locale, 'destination')} <strong>{phoneLabel}</strong>
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {tShare(locale, 'windowsHint')}
              </p>

              <textarea
                readOnly={!editable}
                rows={8}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={message}
                onChange={(e) => onMessageChange?.(e.target.value)}
              />

              {copiedHint ? (
                <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100">
                  {copiedHint}
                </p>
              ) : null}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  disabled={busy}
                  className={glassAction('green')}
                  title={tShare(locale, 'openWaMe')}
                  onClick={handleWeb}
                >
                  <span className="inline-flex items-center gap-2">
                    <WhatsAppIcon className="h-4 w-4" />
                    {tCommon(locale, 'openWhatsApp')}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={glassBtn('secondary')}
                  onClick={handleCopy}
                >
                  {tCommon(locale, 'copyMessage')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={glassBtn('secondary')}
                  onClick={handleDesktop}
                >
                  {tShare(locale, 'openDesktop')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={glassBtn('ghost')}
                  onClick={() => setPanelOpen(false)}
                >
                  {tCommon(locale, 'close')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <span
        className={[
          'inline-flex flex-wrap items-center gap-2',
          children ? 'w-full' : '',
          wrapperClassName ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <button
          type="button"
          title={
            title ??
            (phoneOk
              ? tShare(locale, 'prepareSend')
              : tCommon(locale, 'registerPhone'))
          }
          aria-label={
            ariaLabel ??
            (phoneOk
              ? tCommon(locale, 'openWhatsApp')
              : tShare(locale, 'unavailable'))
          }
          disabled={disabled || busy}
          className={[
            glassAction('green', true),
            'inline-flex h-10 w-10 shrink-0 items-center justify-center p-0',
            children ? 'h-auto w-full sm:w-auto' : '',
            !phoneOk || disabled ? 'opacity-50' : '',
            className ?? '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={(e: MouseEvent<HTMLButtonElement>) => {
            e.preventDefault()
            e.stopPropagation()
            openPanel()
          }}
        >
          {children ?? (
            <WhatsAppIcon className="h-5 w-5 text-white" />
          )}
        </button>
      </span>
      {panel}
    </>
  )
}

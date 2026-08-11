'use client'

import type { SaveQuoteErrorInfo } from '@/Lib/supabaseSaveError'
import { tw } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

function ErrorField({ label, value }: { label: string; value: string | null }) {
  const display = value?.trim() ? value : '—'
  return (
    <div className="rounded-lg border border-cdl-border bg-cdl-inset px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-cdl-muted">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm break-all text-cdl-fg">{display}</dd>
    </div>
  )
}

export default function SaveQuoteTechnicalError({
  errorInfo,
  isEditMode = false,
  language = 'pt',
}: {
  errorInfo: SaveQuoteErrorInfo
  isEditMode?: boolean
  language?: QuoteLanguage | string | null
}) {
  const loc: QuoteLanguage =
    language === 'en' || language === 'es' ? language : 'pt'
  return (
    <div
      role="alert"
      className="rounded-2xl border border-cdl-action/50 bg-cdl-red-soft px-4 py-4 sm:px-5"
    >
      <p className="text-sm font-semibold text-cdl-action">
        {isEditMode ? tw(loc, 'saveFailed') : tw(loc, 'createFailed')}
      </p>
      <div className="mt-3 rounded-xl border border-cdl-border bg-cdl-surface px-3 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-cdl-action">
          {tw(loc, 'technicalError')}
        </p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <ErrorField label="code" value={errorInfo.code} />
          <ErrorField label="step" value={errorInfo.step} />
          <div className="sm:col-span-2">
            <ErrorField label="message" value={errorInfo.message} />
          </div>
          <div className="sm:col-span-2">
            <ErrorField label="details" value={errorInfo.details} />
          </div>
          <div className="sm:col-span-2">
            <ErrorField label="hint" value={errorInfo.hint} />
          </div>
        </dl>
        {errorInfo.rawError ? (
          <details className="mt-3" open>
            <summary className="cursor-pointer text-xs font-semibold text-cdl-action">
              {tw(loc, 'rawError')}
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-cdl-border bg-cdl-inset p-2 font-mono text-xs text-cdl-fg">
              {errorInfo.rawError}
            </pre>
          </details>
        ) : null}
        {errorInfo.quotePayload ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-semibold text-cdl-action">
              Payload quotes
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-cdl-border bg-cdl-inset p-2 font-mono text-xs text-cdl-fg">
              {JSON.stringify(errorInfo.quotePayload, null, 2)}
            </pre>
          </details>
        ) : null}
        {errorInfo.additionalItemsPayload?.length ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-semibold text-cdl-action">
              Payload quote_additional_items
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-cdl-border bg-cdl-inset p-2 font-mono text-xs text-cdl-fg">
              {JSON.stringify(errorInfo.additionalItemsPayload, null, 2)}
            </pre>
          </details>
        ) : null}
        {errorInfo.eventPayload ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-semibold text-cdl-action">
              Payload events
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-cdl-border bg-cdl-inset p-2 font-mono text-xs text-cdl-fg">
              {JSON.stringify(errorInfo.eventPayload, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  )
}

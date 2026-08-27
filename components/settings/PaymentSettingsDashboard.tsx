'use client'

import { FormEvent, useMemo, useState } from 'react'
import {
  BackofficeBtnPrimary,
  BackofficeBtnSecondary,
  BackofficeField,
  BackofficeFormCard,
  BackofficeInput,
} from '@/components/backoffice/BackofficeCardPrimitives'
import { tCommon } from '@/Lib/i18n/common'
import { tPaymentSettings } from '@/Lib/i18n/paymentSettings'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type { CompanyPaypalPublicSettings } from '@/Lib/payments/paypalSettingsTypes'

type OfflineMethods = {
  zelle: boolean
  bankTransfer: boolean
}

function statusLabel(
  locale: string,
  status: CompanyPaypalPublicSettings['connectionStatus'],
) {
  if (status === 'validated') return tPaymentSettings(locale, 'statusValidated')
  if (status === 'configured') return tPaymentSettings(locale, 'statusConfigured')
  if (status === 'error') return tPaymentSettings(locale, 'statusError')
  return tPaymentSettings(locale, 'statusUnconfigured')
}

function friendlyError(locale: string, code: string) {
  if (code === 'paypal_not_configured') return tPaymentSettings(locale, 'errorNotConfigured')
  if (code === 'paypal_live_blocked') return tPaymentSettings(locale, 'errorLiveBlocked')
  if (code === 'paypal_sandbox_auth_failed') return tPaymentSettings(locale, 'errorAuthFailed')
  if (code === 'paypal_test_required') return tPaymentSettings(locale, 'errorTestRequired')
  if (code === 'paypal_webhook_create_failed') {
    return tPaymentSettings(locale, 'errorWebhookFailed')
  }
  if (code === 'Forbidden' || code === 'company_context_required') {
    return tPaymentSettings(locale, 'errorForbidden')
  }
  return code || tCommon(locale, 'error')
}

export default function PaymentSettingsDashboard({
  companyName,
  initialPaypal,
  initialMethods,
}: {
  companyName: string
  initialPaypal: CompanyPaypalPublicSettings
  initialMethods: OfflineMethods
}) {
  const locale = useAuthLocaleFromMe()
  const [paypal, setPaypal] = useState(initialPaypal)
  const [methods] = useState(initialMethods)
  const [clientId, setClientId] = useState(initialPaypal.clientId ?? '')
  const [clientSecret, setClientSecret] = useState('')
  const [replacingSecret, setReplacingSecret] = useState(false)
  const [enabled, setEnabled] = useState(initialPaypal.enabled)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [webhookBusy, setWebhookBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canTest = Boolean(paypal.clientId && paypal.clientSecretConfigured)
  const canWebhook = paypal.connectionStatus === 'validated'

  const lastTest = useMemo(() => {
    if (!paypal.lastTestedAt) return tPaymentSettings(locale, 'never')
    return `${paypal.lastTestedAt} · ${paypal.lastTestStatus || '—'}`
  }, [locale, paypal.lastTestStatus, paypal.lastTestedAt])

  function applySettings(next: CompanyPaypalPublicSettings) {
    setPaypal(next)
    setClientId(next.clientId ?? '')
    setEnabled(next.enabled)
    setClientSecret('')
    setReplacingSecret(false)
  }

  async function onSave(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/company/payment-providers/paypal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment: 'sandbox',
          enabled,
          clientId,
          clientSecret: clientSecret.trim() || undefined,
        }),
      })
      const json = (await res.json()) as {
        error?: string
        data?: CompanyPaypalPublicSettings
      }
      if (!res.ok || !json.data) {
        throw new Error(json.error || tCommon(locale, 'error'))
      }
      applySettings(json.data)
      setMessage(tPaymentSettings(locale, 'saved'))
    } catch (err) {
      setError(friendlyError(locale, err instanceof Error ? err.message : ''))
    } finally {
      setSaving(false)
    }
  }

  async function onTest() {
    setTesting(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/company/payment-providers/paypal/test', {
        method: 'POST',
      })
      const json = (await res.json()) as {
        error?: string
        data?: { message?: string; connectionStatus?: string }
      }
      const refresh = await fetch('/api/company/payment-providers/paypal')
      const refreshed = (await refresh.json()) as {
        data?: CompanyPaypalPublicSettings
      }
      if (refreshed.data) applySettings(refreshed.data)
      if (!res.ok) throw new Error(json.error || tCommon(locale, 'error'))
      setMessage(json.data?.message || tPaymentSettings(locale, 'testOk'))
    } catch (err) {
      setError(friendlyError(locale, err instanceof Error ? err.message : ''))
    } finally {
      setTesting(false)
    }
  }

  async function onWebhook() {
    setWebhookBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/company/payment-providers/paypal/webhook', {
        method: 'POST',
      })
      const json = (await res.json()) as { error?: string }
      const refresh = await fetch('/api/company/payment-providers/paypal')
      const refreshed = (await refresh.json()) as {
        data?: CompanyPaypalPublicSettings
      }
      if (refreshed.data) applySettings(refreshed.data)
      if (!res.ok) throw new Error(json.error || tCommon(locale, 'error'))
      setMessage(tPaymentSettings(locale, 'webhookOk'))
    } catch (err) {
      setError(friendlyError(locale, err instanceof Error ? err.message : ''))
    } finally {
      setWebhookBusy(false)
    }
  }

  async function copyWebhook() {
    if (!paypal.webhookUrl) return
    await navigator.clipboard.writeText(paypal.webhookUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <main
      data-settings-payments
      data-paypal-live-blocked="true"
      data-paypal-public-checkout="off"
      data-payment-settings-permission="company.settings"
      data-paypal-company-scoped="true"
      className="p-4 sm:p-6"
    >
      <header className="mb-6">
        <p
          data-paypal-breadcrumb
          className="text-xs font-bold uppercase tracking-[0.2em] text-red-600"
        >
          {tPaymentSettings(locale, 'breadcrumbSettings')}
          {' → '}
          {tPaymentSettings(locale, 'breadcrumbPayments')}
          {' → '}
          {tPaymentSettings(locale, 'breadcrumbProviders')}
          {' → '}
          {tPaymentSettings(locale, 'breadcrumbPaypal')}
        </p>
        <h1 className="mt-1 text-2xl font-black text-neutral-900">
          {tPaymentSettings(locale, 'title')}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">
          {tPaymentSettings(locale, 'subtitle')}
        </p>
        {companyName ? (
          <p className="mt-2 text-sm font-semibold text-neutral-800">
            {companyName}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-neutral-500">
          {tPaymentSettings(locale, 'canonicalNote')}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {tPaymentSettings(locale, 'accessNote')}
        </p>
      </header>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <form onSubmit={onSave} className="space-y-5">
        <BackofficeFormCard
          title={tPaymentSettings(locale, 'paypal')}
          actions={
            <>
              <BackofficeBtnPrimary type="submit" disabled={saving}>
                {saving ? tCommon(locale, 'saving') : tPaymentSettings(locale, 'save')}
              </BackofficeBtnPrimary>
              <BackofficeBtnSecondary onClick={onTest} disabled={!canTest || testing}>
                {tPaymentSettings(locale, 'test')}
              </BackofficeBtnSecondary>
              <BackofficeBtnSecondary
                onClick={onWebhook}
                disabled={!canWebhook || webhookBusy}
              >
                {tPaymentSettings(locale, 'configureWebhook')}
              </BackofficeBtnSecondary>
            </>
          }
        >
          <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2">
            <span
              data-paypal-status={paypal.connectionStatus}
              className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700"
            >
              {statusLabel(locale, paypal.connectionStatus)}
            </span>
            <span
              data-paypal-environment="sandbox"
              className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200"
            >
              {tPaymentSettings(locale, 'environment')}: {tPaymentSettings(locale, 'sandbox')}
            </span>
            <span
              data-paypal-live-status="blocked"
              className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600"
            >
              {tPaymentSettings(locale, 'liveDisabled')}
            </span>
            <span
              data-public-checkout-off
              className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600"
            >
              {tPaymentSettings(locale, 'publicCheckoutOff')}
            </span>
          </div>

          <BackofficeField label={tPaymentSettings(locale, 'clientId')} className="sm:col-span-2">
            <BackofficeInput
              value={clientId}
              onChange={setClientId}
              placeholder="AY..."
            />
          </BackofficeField>

          <BackofficeField
            label={tPaymentSettings(locale, 'clientSecret')}
            className="sm:col-span-2"
          >
            <input
              data-paypal-secret-masked
              type="password"
              autoComplete="new-password"
              value={
                paypal.clientSecretConfigured && !replacingSecret
                  ? '••••••••••••'
                  : clientSecret
              }
              disabled={paypal.clientSecretConfigured && !replacingSecret}
              placeholder={
                paypal.clientSecretConfigured
                  ? '••••••••••••'
                  : tPaymentSettings(locale, 'secretPlaceholder')
              }
              onChange={(event) => setClientSecret(event.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100 disabled:text-neutral-400"
            />
            <span className="mt-1 flex items-center justify-between text-xs text-neutral-500">
              <span>
                {paypal.clientSecretConfigured
                  ? tPaymentSettings(locale, 'secretConfigured')
                  : tPaymentSettings(locale, 'secretPlaceholder')}
              </span>
              <button
                type="button"
                className="font-semibold text-red-600"
                onClick={() => {
                  setReplacingSecret(true)
                  setClientSecret('')
                }}
              >
                {tPaymentSettings(locale, 'replaceSecret')}
              </button>
            </span>
          </BackofficeField>

          <BackofficeField
            label={tPaymentSettings(locale, 'webhookUrl')}
            className="sm:col-span-2 lg:col-span-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={paypal.webhookUrl || ''}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-700"
              />
              <BackofficeBtnSecondary onClick={copyWebhook} disabled={!paypal.webhookUrl}>
                {copied
                  ? tPaymentSettings(locale, 'copied')
                  : tPaymentSettings(locale, 'copy')}
              </BackofficeBtnSecondary>
            </div>
          </BackofficeField>

          <BackofficeField label={tPaymentSettings(locale, 'webhookStatus')}>
            <p
              data-paypal-webhook-status={paypal.webhookConfigured ? 'configured' : 'missing'}
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-700"
            >
              {paypal.webhookConfigured
                ? tPaymentSettings(locale, 'webhookReady')
                : tPaymentSettings(locale, 'webhookMissing')}
            </p>
          </BackofficeField>

          <BackofficeField label={tPaymentSettings(locale, 'webhookId')}>
            <BackofficeInput value={paypal.webhookId || ''} onChange={() => undefined} disabled />
          </BackofficeField>

          <BackofficeField label={tPaymentSettings(locale, 'lastTest')}>
            <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-700">
              {lastTest}
            </p>
          </BackofficeField>

          <label className="sm:col-span-2 lg:col-span-3 flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-800">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            {tPaymentSettings(locale, 'enabled')}
          </label>
        </BackofficeFormCard>
      </form>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <article
          data-zelle-preserved={methods.zelle ? 'yes' : 'no'}
          className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-bold text-neutral-900">
            {tPaymentSettings(locale, 'zelle')}
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            {tPaymentSettings(locale, 'preserved')}
          </p>
        </article>
        <article
          data-bank-transfer-preserved={methods.bankTransfer ? 'yes' : 'no'}
          className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-bold text-neutral-900">
            {tPaymentSettings(locale, 'bank')}
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            {tPaymentSettings(locale, 'preserved')}
          </p>
        </article>
      </section>
    </main>
  )
}

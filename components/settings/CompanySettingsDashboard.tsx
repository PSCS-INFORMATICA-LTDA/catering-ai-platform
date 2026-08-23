'use client'

import { FormEvent, useEffect, useState } from 'react'
import {
  BackofficeBtnPrimary,
  BackofficeBtnSecondary,
  BackofficeField,
  BackofficeFormCard,
  BackofficeInput,
} from '@/components/backoffice/BackofficeCardPrimitives'
import { tCommon } from '@/Lib/i18n/common'
import { tCompanySettings } from '@/Lib/i18n/companySettings'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { fetchAddressByCep, formatCep } from '@/Lib/cep'
import { glassBtn } from '@/Lib/liquidGlass'

type CompanyRow = {
  id: string
  company_name?: string | null
  legal_name?: string | null
  trade_name?: string | null
  document?: string | null
  state_registration?: string | null
  postal_code?: string | null
  street?: string | null
  address_number?: string | null
  address_complement?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  address?: string | null
  phone?: string | null
  billing_email?: string | null
  website?: string | null
  logo_url?: string | null
  brand_logo_url?: string | null
}

type FormState = {
  legal_name: string
  trade_name: string
  company_name: string
  document: string
  state_registration: string
  postal_code: string
  street: string
  address_number: string
  address_complement: string
  neighborhood: string
  city: string
  state: string
  address: string
  phone: string
  billing_email: string
  website: string
}

function toForm(row: CompanyRow | null): FormState {
  return {
    legal_name: row?.legal_name ?? row?.company_name ?? '',
    trade_name: row?.trade_name ?? '',
    company_name: row?.company_name ?? '',
    document: row?.document ?? '',
    state_registration: row?.state_registration ?? '',
    postal_code: row?.postal_code ?? '',
    street: row?.street ?? '',
    address_number: row?.address_number ?? '',
    address_complement: row?.address_complement ?? '',
    neighborhood: row?.neighborhood ?? '',
    city: row?.city ?? '',
    state: row?.state ?? '',
    address: row?.address ?? '',
    phone: row?.phone ?? '',
    billing_email: row?.billing_email ?? '',
    website: row?.website ?? '',
  }
}

export default function CompanySettingsDashboard({
  initialCompany,
}: {
  initialCompany: CompanyRow | null
}) {
  const locale = useAuthLocaleFromMe()
  const [form, setForm] = useState<FormState>(() => toForm(initialCompany))
  const [logoUrl, setLogoUrl] = useState(
    initialCompany?.logo_url || initialCompany?.brand_logo_url || '',
  )
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm(toForm(initialCompany))
    setLogoUrl(initialCompany?.logo_url || initialCompany?.brand_logo_url || '')
  }, [initialCompany])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          company_name: form.company_name || form.legal_name || form.trade_name,
        }),
      })
      const json = (await res.json()) as { error?: string; data?: CompanyRow }
      if (!res.ok) throw new Error(json.error ?? tCompanySettings(locale, 'saveFailed'))
      setForm(toForm(json.data ?? null))
      setMessage(tCompanySettings(locale, 'saved'))
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon(locale, 'error'))
    } finally {
      setSaving(false)
    }
  }

  async function lookupCep() {
    setCepLoading(true)
    setError(null)
    try {
      const addr = await fetchAddressByCep(form.postal_code)
      setForm((f) => ({
        ...f,
        postal_code: addr.cep,
        street: addr.street || f.street,
        neighborhood: addr.neighborhood || f.neighborhood,
        city: addr.city || f.city,
        state: addr.state || f.state,
        address: addr.formatted,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : tCompanySettings(locale, 'invalidCep'))
    } finally {
      setCepLoading(false)
    }
  }

  async function onLogoChange(file: File | null) {
    if (!file) return
    setUploading(true)
    setError(null)
    setMessage(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/company/logo', { method: 'POST', body })
      const json = (await res.json()) as {
        error?: string
        data?: { logo_url?: string }
      }
      if (!res.ok) throw new Error(json.error ?? tCompanySettings(locale, 'uploadFailed'))
      setLogoUrl(json.data?.logo_url ?? '')
      setMessage(tCompanySettings(locale, 'logoUpdated'))
    } catch (err) {
      setError(err instanceof Error ? err.message : tCompanySettings(locale, 'logoError'))
    } finally {
      setUploading(false)
    }
  }

  async function removeLogo() {
    setUploading(true)
    setError(null)
    try {
      const res = await fetch('/api/company/logo', { method: 'DELETE' })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? tCompanySettings(locale, 'removeFailed'))
      setLogoUrl('')
      setMessage(tCompanySettings(locale, 'logoRemoved'))
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon(locale, 'error'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div>
        <h1 className="text-3xl font-bold text-red-600">
          {tCompanySettings(locale, 'title')}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {tCompanySettings(locale, 'subtitle')}
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <form onSubmit={onSave}>
        <BackofficeFormCard
          title={tCompanySettings(locale, 'registrationTitle')}
          actions={
            <BackofficeBtnPrimary type="submit" disabled={saving}>
              {saving
                ? tCommon(locale, 'saving')
                : tCompanySettings(locale, 'saveData')}
            </BackofficeBtnPrimary>
          }
        >
          <BackofficeField label={tCompanySettings(locale, 'legalName')}>
            <BackofficeInput
              value={form.legal_name}
              onChange={(v) => setForm((f) => ({ ...f, legal_name: v }))}
            />
          </BackofficeField>
          <BackofficeField label={tCompanySettings(locale, 'tradeName')}>
            <BackofficeInput
              value={form.trade_name}
              onChange={(v) => setForm((f) => ({ ...f, trade_name: v }))}
            />
          </BackofficeField>
          <BackofficeField label={tCompanySettings(locale, 'displayName')}>
            <BackofficeInput
              value={form.company_name}
              onChange={(v) => setForm((f) => ({ ...f, company_name: v }))}
            />
          </BackofficeField>
          <BackofficeField label={tCompanySettings(locale, 'document')}>
            <BackofficeInput
              value={form.document}
              onChange={(v) => setForm((f) => ({ ...f, document: v }))}
            />
          </BackofficeField>
          <BackofficeField label={tCompanySettings(locale, 'stateRegistration')}>
            <BackofficeInput
              value={form.state_registration}
              onChange={(v) =>
                setForm((f) => ({ ...f, state_registration: v }))
              }
            />
          </BackofficeField>
          <BackofficeField label={tCommon(locale, 'phone')}>
            <BackofficeInput
              value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            />
          </BackofficeField>
          <BackofficeField label={tCompanySettings(locale, 'billingEmail')}>
            <BackofficeInput
              value={form.billing_email}
              onChange={(v) => setForm((f) => ({ ...f, billing_email: v }))}
            />
          </BackofficeField>
          <BackofficeField label={tCompanySettings(locale, 'website')}>
            <BackofficeInput
              value={form.website}
              onChange={(v) => setForm((f) => ({ ...f, website: v }))}
            />
          </BackofficeField>
        </BackofficeFormCard>
      </form>

      <BackofficeFormCard
        title={tCommon(locale, 'address')}
        actions={
          <BackofficeBtnSecondary
            disabled={cepLoading}
            onClick={() => void lookupCep()}
          >
            {cepLoading
              ? tCompanySettings(locale, 'searchingCep')
              : tCompanySettings(locale, 'lookupCep')}
          </BackofficeBtnSecondary>
        }
      >
        <BackofficeField label={tCompanySettings(locale, 'postalCode')}>
          <BackofficeInput
            value={form.postal_code}
            onChange={(v) =>
              setForm((f) => ({ ...f, postal_code: formatCep(v) }))
            }
          />
        </BackofficeField>
        <BackofficeField label={tCompanySettings(locale, 'stateUf')}>
          <BackofficeInput
            value={form.state}
            onChange={(v) => setForm((f) => ({ ...f, state: v.toUpperCase() }))}
          />
        </BackofficeField>
        <BackofficeField label={tCompanySettings(locale, 'street')} className="sm:col-span-2">
          <BackofficeInput
            value={form.street}
            onChange={(v) => setForm((f) => ({ ...f, street: v }))}
          />
        </BackofficeField>
        <BackofficeField label={tCompanySettings(locale, 'number')}>
          <BackofficeInput
            value={form.address_number}
            onChange={(v) => setForm((f) => ({ ...f, address_number: v }))}
          />
        </BackofficeField>
        <BackofficeField label={tCompanySettings(locale, 'complement')}>
          <BackofficeInput
            value={form.address_complement}
            onChange={(v) => setForm((f) => ({ ...f, address_complement: v }))}
          />
        </BackofficeField>
        <BackofficeField label={tCompanySettings(locale, 'neighborhood')}>
          <BackofficeInput
            value={form.neighborhood}
            onChange={(v) => setForm((f) => ({ ...f, neighborhood: v }))}
          />
        </BackofficeField>
        <BackofficeField label={tCommon(locale, 'city')}>
          <BackofficeInput
            value={form.city}
            onChange={(v) => setForm((f) => ({ ...f, city: v }))}
          />
        </BackofficeField>
        <BackofficeField label={tCompanySettings(locale, 'fullAddress')} className="sm:col-span-2 lg:col-span-3">
          <BackofficeInput
            value={form.address}
            onChange={(v) => setForm((f) => ({ ...f, address: v }))}
          />
        </BackofficeField>
      </BackofficeFormCard>

      <div className="liquid-glass-card space-y-4 p-5">
        <h2 className="text-lg font-bold text-red-600">
          {tCompanySettings(locale, 'logoTitle')}
        </h2>
        <p className="text-sm text-neutral-500">
          {tCompanySettings(locale, 'logoHint')}
        </p>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={tCompanySettings(locale, 'logoAlt')}
            className="h-24 w-auto max-w-xs rounded-xl border border-neutral-200 bg-white object-contain p-2"
          />
        ) : (
          <p className="text-sm text-neutral-500">
            {tCompanySettings(locale, 'noLogo')}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <label className={glassBtn('primary', 'cursor-pointer')}>
            {uploading
              ? tCommon(locale, 'uploading')
              : tCompanySettings(locale, 'uploadLogo')}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                e.target.value = ''
                void onLogoChange(file)
              }}
            />
          </label>
          {logoUrl ? (
            <button
              type="button"
              className={glassBtn('secondary')}
              disabled={uploading}
              onClick={() => void removeLogo()}
            >
              {tCompanySettings(locale, 'removeLogo')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

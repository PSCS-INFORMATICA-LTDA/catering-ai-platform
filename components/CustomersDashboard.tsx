'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import BackofficeTableShell from '@/components/BackofficeTableShell'
import {
  BackofficeBtnDanger,
  BackofficeBtnPrimary,
  BackofficeBtnSecondary,
  BackofficeEmptyState,
  BackofficeField,
  BackofficeFormCard,
  BackofficeInput,
  BackofficeMetaRow,
  BackofficeOpenQuoteBadge,
} from '@/components/backoffice/BackofficeCardPrimitives'
import { glassBtn } from '@/Lib/liquidGlass'
import { getCustomerDisplayName } from '@/Lib/getCustomerDisplayName'
import type { CustomersUpdatePayload } from '@/Lib/customersTableSchema'
import { glassField } from '@/Lib/liquidGlass'
import { tCommon } from '@/Lib/i18n/common'
import { tCustomers } from '@/Lib/i18n/customers'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type { AuthLocale } from '@/Lib/i18n/authUsers'
import {
  dedupeCustomersList,
  filterCustomersBySearch,
  sortCustomersByRecency,
  type CustomerSearchRecord,
} from '@/Lib/searchCustomers'
import { isUsablePhone, normalizePhone } from '@/Lib/normalizePhone'

type CustomerRow = CustomerSearchRecord & { id: string }
type ActiveFilter = 'active' | 'all'
type RoleFilter = 'all' | 'customer' | 'supplier' | 'team'

type CustomerForm = CustomersUpdatePayload & {
  phone: string
  ab_name?: string | null
  is_customer?: boolean | null
  is_supplier?: boolean | null
  is_team?: boolean | null
  preferred_language?: string | null
  address_line?: string | null
}

const EMPTY_FORM: CustomerForm = {
  phone: '',
  ab_name: '',
  full_name: '',
  contact_name: '',
  company_name: '',
  email: '',
  address_line: '',
  city: '',
  state: '',
  postal_code: '',
  preferred_language: 'pt',
  is_customer: true,
  is_supplier: false,
  is_team: false,
  source: '',
  active: true,
}

function langLabel(
  code: string | null | undefined,
  locale: AuthLocale,
) {
  if (code === 'en') return tCommon(locale, 'english')
  if (code === 'es') return tCommon(locale, 'spanish')
  return tCommon(locale, 'portuguese')
}

function roleLabels(person: CustomerRow, locale: AuthLocale) {
  const labels: string[] = []
  if (person.is_customer) labels.push(tCommon(locale, 'customer'))
  if (person.is_supplier) labels.push(tCommon(locale, 'supplier'))
  if (person.is_team) labels.push(tCommon(locale, 'team'))
  if (labels.length === 0) labels.push(tCommon(locale, 'customer'))
  return labels
}

async function fetchCustomersFromApi(
  query: string,
  activeFilter: ActiveFilter,
): Promise<{ customers: CustomerRow[]; openQuoteCounts: Record<string, number> }> {
  const params = new URLSearchParams({ _: String(Date.now()) })
  if (query.trim()) params.set('q', query.trim())
  if (activeFilter === 'all') params.set('active', 'all')

  const response = await fetch(`/api/customers?${params.toString()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  })
  const result = (await response.json()) as {
    data?: CustomerRow[]
    openQuoteCounts?: Record<string, number>
    error?: string
  }
  if (!response.ok) {
    throw new Error(result.error ?? 'Não foi possível buscar clientes.')
  }
  return {
    customers: result.data ?? [],
    openQuoteCounts: result.openQuoteCounts ?? {},
  }
}

function CustomerEditFields({
  draft,
  setDraft,
  abNumber,
  locale,
}: {
  draft: CustomerForm
  setDraft: React.Dispatch<React.SetStateAction<CustomerForm>>
  abNumber?: string | null
  locale: AuthLocale
}) {
  return (
    <>
      <BackofficeField label="Nº AB">
        <BackofficeInput value={abNumber ?? 'auto'} onChange={() => {}} disabled />
      </BackofficeField>
      <BackofficeField label={tCommon(locale, 'displayName')}>
        <BackofficeInput
          value={draft.ab_name ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, ab_name: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tCustomers(locale, 'fullName')}>
        <BackofficeInput
          value={draft.full_name ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, full_name: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tCommon(locale, 'contact')}>
        <BackofficeInput
          value={draft.contact_name ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, contact_name: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tCommon(locale, 'company')}>
        <BackofficeInput
          value={draft.company_name ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, company_name: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tCustomers(locale, 'phoneRequired')}>
        <BackofficeInput
          value={draft.phone ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, phone: v }))}
          placeholder={tCommon(locale, 'phonePlaceholder')}
        />
        {normalizePhone(draft.phone).length >= 10 && !isUsablePhone(draft.phone) ? (
          <p className="mt-1 text-xs text-cdl-action">{tCommon(locale, 'invalidPhone')}</p>
        ) : null}
      </BackofficeField>
      <BackofficeField label={tCommon(locale, 'email')}>
        <BackofficeInput
          value={draft.email ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, email: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tCommon(locale, 'address')} className="sm:col-span-2">
        <BackofficeInput
          value={draft.address_line ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, address_line: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tCommon(locale, 'city')}>
        <BackofficeInput
          value={draft.city ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, city: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tCommon(locale, 'state')}>
        <BackofficeInput
          value={draft.state ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, state: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tCommon(locale, 'postalCode')}>
        <BackofficeInput
          value={draft.postal_code ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, postal_code: v }))}
        />
      </BackofficeField>
      <BackofficeField label={tCommon(locale, 'langMessages')}>
        <select
          className={glassField()}
          value={draft.preferred_language ?? 'pt'}
          onChange={(e) =>
            setDraft((c) => ({ ...c, preferred_language: e.target.value }))
          }
        >
          <option value="pt">{tCommon(locale, 'portuguese')}</option>
          <option value="en">{tCommon(locale, 'english')}</option>
          <option value="es">{tCommon(locale, 'spanish')}</option>
        </select>
      </BackofficeField>
      <BackofficeField label={tCustomers(locale, 'roles')} className="sm:col-span-2">
        <div className="flex flex-wrap gap-4 rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-800">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(draft.is_customer)}
              onChange={(e) =>
                setDraft((c) => ({ ...c, is_customer: e.target.checked }))
              }
            />
            {tCommon(locale, 'customer')}
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(draft.is_supplier)}
              onChange={(e) =>
                setDraft((c) => ({ ...c, is_supplier: e.target.checked }))
              }
            />
            {tCommon(locale, 'supplier')}
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(draft.is_team)}
              onChange={(e) =>
                setDraft((c) => ({ ...c, is_team: e.target.checked }))
              }
            />
            {tCommon(locale, 'team')}
          </label>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {tCustomers(locale, 'rolesHint')}
        </p>
      </BackofficeField>
      <BackofficeField label={tCommon(locale, 'source')}>
        <BackofficeInput
          value={draft.source ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, source: v }))}
        />
      </BackofficeField>
    </>
  )
}

export default function CustomersDashboard({
  initialCustomers,
}: {
  initialCustomers: CustomerRow[]
}) {
  const locale = useAuthLocaleFromMe()
  const [customers, setCustomers] = useState<CustomerRow[]>(() =>
    dedupeCustomersList(sortCustomersByRecency(initialCustomers)),
  )
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CustomerForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [openQuoteCounts, setOpenQuoteCounts] = useState<Record<string, number>>(
    {},
  )

  const filteredCustomers = useMemo(() => {
    let list = filterCustomersBySearch(customers, search)
    if (roleFilter === 'customer') {
      list = list.filter((p) => p.is_customer !== false)
    } else if (roleFilter === 'supplier') {
      list = list.filter((p) => Boolean(p.is_supplier))
    } else if (roleFilter === 'team') {
      list = list.filter((p) => Boolean(p.is_team))
    }
    return list
  }, [customers, search, roleFilter])

  const refreshCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { customers: next, openQuoteCounts: counts } =
        await fetchCustomersFromApi(search, activeFilter)
      setCustomers(dedupeCustomersList(sortCustomersByRecency(next)))
      setOpenQuoteCounts(counts)
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : tCustomers(locale, 'refreshError'),
      )
    } finally {
      setLoading(false)
    }
  }, [search, activeFilter, locale])

  useEffect(() => {
    void refreshCustomers()
  }, [activeFilter])

  function startNew() {
    setAnalyzingId(null)
    setEditingId('new')
    setDraft({ ...EMPTY_FORM })
  }

  function startEdit(customer: CustomerRow) {
    setAnalyzingId(null)
    setEditingId(customer.id)
    setDraft({
      phone: customer.phone ?? '',
      ab_name: customer.ab_name ?? '',
      full_name: customer.full_name ?? '',
      contact_name: customer.contact_name ?? '',
      company_name: customer.company_name ?? '',
      email: customer.email ?? '',
      address_line: customer.address_line ?? '',
      city: customer.city ?? '',
      state: customer.state ?? '',
      postal_code: customer.postal_code ?? '',
      preferred_language: customer.preferred_language ?? 'pt',
      is_customer: customer.is_customer !== false,
      is_supplier: Boolean(customer.is_supplier),
      is_team: Boolean(customer.is_team),
      source: customer.source ?? '',
      active: customer.active !== false,
    })
  }

  function toggleAnalyze(customerId: string) {
    setEditingId(null)
    setAnalyzingId((current) => (current === customerId ? null : customerId))
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft({ ...EMPTY_FORM })
  }

  async function saveRow() {
    setSaving(true)
    setError(null)
    try {
      if (!isUsablePhone(draft.phone)) {
        throw new Error(tCommon(locale, 'invalidPhone'))
      }
      const url =
        editingId && editingId !== 'new'
          ? `/api/customers/${editingId}`
          : '/api/customers'
      const method = editingId && editingId !== 'new' ? 'PATCH' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(result.error ?? tCustomers(locale, 'saveError'))
      }
      cancelEdit()
      await refreshCustomers()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : tCustomers(locale, 'saveError'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(customer: CustomerRow) {
    const openCount = openQuoteCounts[customer.id] ?? 0
    if (openCount > 0) {
      setError(
        tCustomers(locale, 'cannotDeleteOpenQuotes', { count: openCount }),
      )
      return
    }

    const label = getCustomerDisplayName(customer)
    if (
      !window.confirm(
        tCustomers(locale, 'deleteConfirm', { label }),
      )
    ) {
      return
    }

    setError(null)
    const response = await fetch(`/api/customers/${customer.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    })
    const result = (await response.json()) as {
      error?: string
      openQuoteCount?: number
    }
    if (!response.ok) {
      setError(
        result.error ??
          tCustomers(locale, 'cannotDeleteOpenQuotesGeneric'),
      )
      return
    }
    setCustomers((current) => current.filter((row) => row.id !== customer.id))
    setOpenQuoteCounts((current) => {
      const next = { ...current }
      delete next[customer.id]
      return next
    })
  }

  function renderPersonRow(customer: CustomerRow) {
    const isEditing = editingId === customer.id
    const isAnalyzing = analyzingId === customer.id
    const displayName = getCustomerDisplayName(customer)
    const openCount = openQuoteCounts[customer.id] ?? 0
    const location = [customer.city, customer.state].filter(Boolean).join(', ')
    const roles = roleLabels(customer, locale)

    if (isEditing) {
      return (
        <li key={customer.id} className="border-b border-neutral-100 last:border-b-0">
          <BackofficeFormCard
            title={`${tCustomers(locale, 'editPerson')} · ${displayName}`}
            actions={
              <>
                <button
                  type="button"
                  onClick={() => void saveRow()}
                  disabled={saving}
                  className={glassBtn('primary', '!min-h-[36px] !px-4 !text-xs')}
                >
                  {saving ? tCommon(locale, 'saving') : tCommon(locale, 'save')}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className={glassBtn('secondary', '!min-h-[36px] !px-4 !text-xs')}
                >
                  {tCommon(locale, 'cancel')}
                </button>
              </>
            }
          >
            <CustomerEditFields
              draft={draft}
              setDraft={setDraft}
              abNumber={customer.ab_number}
              locale={locale}
            />
          </BackofficeFormCard>
        </li>
      )
    }

    return (
      <li key={customer.id} className="border-b border-neutral-100 last:border-b-0">
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(9rem,0.9fr)_minmax(0,1.2fr)_auto] sm:items-center sm:gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-bold uppercase tracking-wide text-neutral-900">
                {displayName}
              </h3>
              <BackofficeOpenQuoteBadge count={openCount} />
            </div>
            {customer.ab_number ? (
              <p className="text-xs text-neutral-500">AB {customer.ab_number}</p>
            ) : null}
          </div>

          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 sm:hidden">
              {tCommon(locale, 'role')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {roles.map((role) => (
                <span
                  key={role}
                  className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-700"
                >
                  {role}
                </span>
              ))}
              {roles.length > 1 ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                  {tCustomers(locale, 'multipleRoles')}
                </span>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 text-sm text-neutral-600">
            <p className="truncate font-medium text-neutral-800">
              {customer.phone || '—'}
            </p>
            <p className="truncate">{customer.email || '—'}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end">
            <button
              type="button"
              onClick={() => startEdit(customer)}
              className={glassBtn(
                'secondary',
                '!min-h-[32px] !px-3 !py-1.5 !text-[11px] !font-bold uppercase tracking-wide',
              )}
            >
              {tCommon(locale, 'edit')}
            </button>
            <button
              type="button"
              onClick={() => toggleAnalyze(customer.id)}
              className={glassBtn(
                'secondary',
                '!min-h-[32px] !px-3 !py-1.5 !text-[11px] !font-bold uppercase tracking-wide',
              )}
            >
              {isAnalyzing ? tCommon(locale, 'close') : tCommon(locale, 'analyze')}
            </button>
            <button
              type="button"
              onClick={() => void handleDeactivate(customer)}
              className={glassBtn(
                'danger',
                '!min-h-[32px] !px-3 !py-1.5 !text-[11px] !font-bold uppercase tracking-wide',
              )}
            >
              {tCommon(locale, 'delete')}
            </button>
          </div>
        </div>

        {isAnalyzing ? (
          <div className="grid gap-2 border-t border-neutral-100 bg-neutral-50/70 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
            <BackofficeMetaRow label={tCustomers(locale, 'roles')} value={roles.join(', ')} />
            {customer.contact_name ? (
              <BackofficeMetaRow label={tCommon(locale, 'contact')} value={customer.contact_name} />
            ) : null}
            <BackofficeMetaRow label={tCommon(locale, 'phone')} value={customer.phone ?? '—'} />
            <BackofficeMetaRow label={tCommon(locale, 'email')} value={customer.email ?? '—'} />
            <BackofficeMetaRow
              label={tCommon(locale, 'address')}
              value={customer.address_line || location || '—'}
            />
            <BackofficeMetaRow
              label={tCommon(locale, 'language')}
              value={langLabel(customer.preferred_language, locale)}
            />
            <BackofficeMetaRow label={tCommon(locale, 'location')} value={location || '—'} />
            {customer.ab_number ? (
              <BackofficeMetaRow label="AB" value={customer.ab_number} />
            ) : null}
            {customer.company_name ? (
              <BackofficeMetaRow label={tCommon(locale, 'company')} value={customer.company_name} />
            ) : null}
            {customer.source ? (
              <BackofficeMetaRow label={tCommon(locale, 'source')} value={customer.source} />
            ) : null}
          </div>
        ) : null}
      </li>
    )
  }

  return (
    <BackofficeTableShell
      title={tCustomers(locale, 'title')}
      subtitle={tCustomers(locale, 'subtitle')}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={tCustomers(locale, 'searchPlaceholder')}
      activeFilter={activeFilter}
      onActiveFilterChange={setActiveFilter}
      onRefresh={() => void refreshCustomers()}
      loading={loading}
      error={error}
      actions={
        <>
          <select
            className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-800"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            aria-label={tCustomers(locale, 'filterRole')}
          >
            <option value="all">{tCustomers(locale, 'allRoles')}</option>
            <option value="customer">{tCustomers(locale, 'customers')}</option>
            <option value="supplier">{tCustomers(locale, 'suppliers')}</option>
            <option value="team">{tCommon(locale, 'team')}</option>
          </select>
          <button
            type="button"
            onClick={startNew}
            className={glassBtn('primary', 'min-h-[44px] px-5 py-3 text-sm font-bold')}
          >
            {tCustomers(locale, 'newPerson')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {editingId === 'new' ? (
          <BackofficeFormCard
            title={tCustomers(locale, 'newPerson')}
            actions={
              <>
                <button
                  type="button"
                  onClick={() => void saveRow()}
                  disabled={saving}
                  className={glassBtn('primary', '!min-h-[36px] !px-4 !text-xs')}
                >
                  {saving ? tCommon(locale, 'saving') : tCommon(locale, 'save')}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className={glassBtn('secondary', '!min-h-[36px] !px-4 !text-xs')}
                >
                  {tCommon(locale, 'cancel')}
                </button>
              </>
            }
          >
            <CustomerEditFields draft={draft} setDraft={setDraft} locale={locale} />
          </BackofficeFormCard>
        ) : null}

        {filteredCustomers.length === 0 && editingId !== 'new' ? (
          <BackofficeEmptyState
            loading={loading}
            message={tCustomers(locale, 'empty')}
          />
        ) : (
          <ul className="max-h-[min(70vh,52rem)] overflow-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <li className="sticky top-0 z-10 hidden border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(9rem,0.9fr)_minmax(0,1.2fr)_auto] sm:gap-4">
              <span>{tCommon(locale, 'person')}</span>
              <span>{tCommon(locale, 'role')}</span>
              <span>{tCommon(locale, 'contact')}</span>
              <span>{tCommon(locale, 'actions')}</span>
            </li>
            {filteredCustomers.map((customer) => renderPersonRow(customer))}
          </ul>
        )}
      </div>
    </BackofficeTableShell>
  )
}

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
import { getCustomerDisplayName } from '@/Lib/getCustomerDisplayName'
import type { CustomersUpdatePayload } from '@/Lib/customersTableSchema'
import { glassField } from '@/Lib/liquidGlass'
import {
  dedupeCustomersList,
  filterCustomersBySearch,
  personRoleLabels,
  sortCustomersByRecency,
  type CustomerSearchRecord,
} from '@/Lib/searchCustomers'

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

function langLabel(code: string | null | undefined) {
  if (code === 'en') return 'English'
  if (code === 'es') return 'Español'
  return 'Português'
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
}: {
  draft: CustomerForm
  setDraft: React.Dispatch<React.SetStateAction<CustomerForm>>
  abNumber?: string | null
}) {
  return (
    <>
      <BackofficeField label="Nº AB">
        <BackofficeInput value={abNumber ?? 'auto'} onChange={() => {}} disabled />
      </BackofficeField>
      <BackofficeField label="Nome de exibição">
        <BackofficeInput
          value={draft.ab_name ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, ab_name: v }))}
        />
      </BackofficeField>
      <BackofficeField label="Nome completo">
        <BackofficeInput
          value={draft.full_name ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, full_name: v }))}
        />
      </BackofficeField>
      <BackofficeField label="Contato">
        <BackofficeInput
          value={draft.contact_name ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, contact_name: v }))}
        />
      </BackofficeField>
      <BackofficeField label="Empresa">
        <BackofficeInput
          value={draft.company_name ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, company_name: v }))}
        />
      </BackofficeField>
      <BackofficeField label="Telefone *">
        <BackofficeInput
          value={draft.phone ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, phone: v }))}
        />
      </BackofficeField>
      <BackofficeField label="E-mail">
        <BackofficeInput
          value={draft.email ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, email: v }))}
        />
      </BackofficeField>
      <BackofficeField label="Endereço" className="sm:col-span-2">
        <BackofficeInput
          value={draft.address_line ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, address_line: v }))}
        />
      </BackofficeField>
      <BackofficeField label="Cidade">
        <BackofficeInput
          value={draft.city ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, city: v }))}
        />
      </BackofficeField>
      <BackofficeField label="Estado">
        <BackofficeInput
          value={draft.state ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, state: v }))}
        />
      </BackofficeField>
      <BackofficeField label="CEP / ZIP">
        <BackofficeInput
          value={draft.postal_code ?? ''}
          onChange={(v) => setDraft((c) => ({ ...c, postal_code: v }))}
        />
      </BackofficeField>
      <BackofficeField label="Idioma (WhatsApp / mensagens)">
        <select
          className={glassField()}
          value={draft.preferred_language ?? 'pt'}
          onChange={(e) =>
            setDraft((c) => ({ ...c, preferred_language: e.target.value }))
          }
        >
          <option value="pt">Português</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </BackofficeField>
      <BackofficeField label="Papéis" className="sm:col-span-2">
        <div className="flex flex-wrap gap-4 rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-800">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(draft.is_customer)}
              onChange={(e) =>
                setDraft((c) => ({ ...c, is_customer: e.target.checked }))
              }
            />
            Cliente
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(draft.is_supplier)}
              onChange={(e) =>
                setDraft((c) => ({ ...c, is_supplier: e.target.checked }))
              }
            />
            Fornecedor
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(draft.is_team)}
              onChange={(e) =>
                setDraft((c) => ({ ...c, is_team: e.target.checked }))
              }
            />
            Equipe
          </label>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Cadastro único: a mesma pessoa pode ser cliente, fornecedor e/ou
          contato de equipe.
        </p>
      </BackofficeField>
      <BackofficeField label="Origem">
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
          : 'Erro ao atualizar clientes.',
      )
    } finally {
      setLoading(false)
    }
  }, [search, activeFilter])

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
        throw new Error(result.error ?? 'Não foi possível salvar cadastro.')
      }
      cancelEdit()
      await refreshCustomers()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Erro ao salvar cadastro.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(customer: CustomerRow) {
    const openCount = openQuoteCounts[customer.id] ?? 0
    if (openCount > 0) {
      setError(
        `Não é possível excluir este cadastro porque existem ${openCount} cotação(ões) em aberto vinculadas a ele.`,
      )
      return
    }

    const label = getCustomerDisplayName(customer)
    if (
      !window.confirm(
        `Excluir cadastro de "${label}"?\n\nO cliente será desativado (soft delete).`,
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
          'Não é possível excluir este cadastro porque existem cotações em aberto vinculadas a ele.',
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
    const roles = personRoleLabels(customer)

    if (isEditing) {
      return (
        <li key={customer.id} className="border-b border-neutral-100 last:border-b-0">
          <BackofficeFormCard
            title={`Editar cadastro · ${displayName}`}
            actions={
              <>
                <BackofficeBtnPrimary
                  onClick={() => void saveRow()}
                  disabled={saving}
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </BackofficeBtnPrimary>
                <BackofficeBtnSecondary onClick={cancelEdit}>
                  Cancelar
                </BackofficeBtnSecondary>
              </>
            }
          >
            <CustomerEditFields
              draft={draft}
              setDraft={setDraft}
              abNumber={customer.ab_number}
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
              Papel
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
                  Múltiplos
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

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <BackofficeBtnSecondary onClick={() => startEdit(customer)}>
              Editar
            </BackofficeBtnSecondary>
            <BackofficeBtnSecondary onClick={() => toggleAnalyze(customer.id)}>
              {isAnalyzing ? 'Fechar' : 'Analisar'}
            </BackofficeBtnSecondary>
            <BackofficeBtnDanger onClick={() => void handleDeactivate(customer)}>
              Excluir
            </BackofficeBtnDanger>
          </div>
        </div>

        {isAnalyzing ? (
          <div className="grid gap-2 border-t border-neutral-100 bg-neutral-50/70 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
            <BackofficeMetaRow label="Papéis" value={roles.join(', ')} />
            {customer.contact_name ? (
              <BackofficeMetaRow label="Contato" value={customer.contact_name} />
            ) : null}
            <BackofficeMetaRow label="Telefone" value={customer.phone ?? '—'} />
            <BackofficeMetaRow label="E-mail" value={customer.email ?? '—'} />
            <BackofficeMetaRow
              label="Endereço"
              value={customer.address_line || location || '—'}
            />
            <BackofficeMetaRow
              label="Idioma"
              value={langLabel(customer.preferred_language)}
            />
            <BackofficeMetaRow label="Local" value={location || '—'} />
            {customer.ab_number ? (
              <BackofficeMetaRow label="AB" value={customer.ab_number} />
            ) : null}
            {customer.company_name ? (
              <BackofficeMetaRow label="Empresa" value={customer.company_name} />
            ) : null}
            {customer.source ? (
              <BackofficeMetaRow label="Origem" value={customer.source} />
            ) : null}
          </div>
        ) : null}
      </li>
    )
  }

  return (
    <BackofficeTableShell
      title="Pessoas"
      subtitle="Cadastro único (Address Book): cliente, fornecedor e equipe — o que muda é a flag de papel."
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Nome, telefone, e-mail ou AB number"
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
            aria-label="Filtrar por papel"
          >
            <option value="all">Todos os papéis</option>
            <option value="customer">Clientes</option>
            <option value="supplier">Fornecedores</option>
            <option value="team">Equipe</option>
          </select>
          <button
            type="button"
            onClick={startNew}
            className="cdl-btn-primary inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 py-3 text-sm font-bold"
          >
            Nova pessoa
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {editingId === 'new' ? (
          <BackofficeFormCard
            title="Nova pessoa"
            actions={
              <>
                <BackofficeBtnPrimary
                  onClick={() => void saveRow()}
                  disabled={saving}
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </BackofficeBtnPrimary>
                <BackofficeBtnSecondary onClick={cancelEdit}>
                  Cancelar
                </BackofficeBtnSecondary>
              </>
            }
          >
            <CustomerEditFields draft={draft} setDraft={setDraft} />
          </BackofficeFormCard>
        ) : null}

        {filteredCustomers.length === 0 && editingId !== 'new' ? (
          <BackofficeEmptyState
            loading={loading}
            message="Nenhuma pessoa encontrada."
          />
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <li className="hidden border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500 sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(9rem,0.9fr)_minmax(0,1.2fr)_auto] sm:gap-4">
              <span>Pessoa</span>
              <span>Papel</span>
              <span>Contato</span>
              <span className="text-right">Ações</span>
            </li>
            {filteredCustomers.map((customer) => renderPersonRow(customer))}
          </ul>
        )}
      </div>
    </BackofficeTableShell>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

type Coupon = {
  id: string
  code: string
  campaign_name: string
  description: string | null
  status: 'draft' | 'active' | 'paused' | 'archived'
  discount_type: 'fixed' | 'percent'
  discount_value: number
  max_discount_amount: number | null
  min_eligible_amount: number
  valid_from: string | null
  valid_to: string | null
  eligible_weekdays: number[]
  all_packages: boolean
  eligible_package_ids: string[]
  include_additionals: boolean
  include_grill: boolean
  include_additional_cuts: boolean
  include_mileage: boolean
  new_customer_only: boolean
  max_uses_per_customer: number | null
  max_uses_per_quote: number
  stackable: boolean
  apply_to_deposit: boolean
  apply_to_balance: boolean
  allow_post_event_adjustment: boolean
  manual_approval_required: boolean
  distribution_channel: string | null
  minimum_final_mon_thu: number | null
  minimum_final_fri_sun: number | null
}

type Package = {
  id: string
  package_key: string | null
  package_name: string | null
  label_pt: string | null
}

type Pending = {
  id: string
  quote_number: string | null
  customer_name: string | null
  coupon_code_snapshot: string
  campaign_name_snapshot: string
  eligible_amount: number
  potential_discount_amount: number
}

type Form = Omit<Coupon, 'id'> & { id?: string }

const DAYS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
]

const EMPTY: Form = {
  code: '',
  campaign_name: '',
  description: '',
  status: 'draft',
  discount_type: 'percent',
  discount_value: 5,
  max_discount_amount: null,
  min_eligible_amount: 0,
  valid_from: null,
  valid_to: null,
  eligible_weekdays: [0, 1, 2, 3, 4, 5, 6],
  all_packages: true,
  eligible_package_ids: [],
  include_additionals: true,
  include_grill: false,
  include_additional_cuts: false,
  include_mileage: false,
  new_customer_only: false,
  max_uses_per_customer: null,
  max_uses_per_quote: 1,
  stackable: false,
  apply_to_deposit: false,
  apply_to_balance: true,
  allow_post_event_adjustment: false,
  manual_approval_required: false,
  distribution_channel: '',
  minimum_final_mon_thu: null,
  minimum_final_fri_sun: null,
}

const INPUT =
  'min-h-11 w-full rounded-xl border border-cdl-border bg-cdl-surface px-3 text-sm font-semibold text-cdl-title outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200/40'

function money(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(value ?? 0))
}

function formatDate(value: string | null) {
  if (!value) return 'Sem limite'
  const [year, month, day] = value.split('-')
  return `${month}/${day}/${year}`
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-cdl-muted">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-[11px] leading-4 text-cdl-muted">
          {hint}
        </span>
      ) : null}
    </label>
  )
}

function NumberField({
  value,
  onChange,
  min = 0,
  step = '0.01',
  placeholder,
}: {
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  step?: string
  placeholder?: string
}) {
  return (
    <input
      type="number"
      min={min}
      step={step}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(event) =>
        onChange(event.target.value === '' ? null : Number(event.target.value))
      }
      className={INPUT}
    />
  )
}

function Toggle({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label
      className={`flex items-start justify-between gap-4 rounded-xl border border-cdl-border bg-cdl-bg p-3 ${
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
      }`}
    >
      <span>
        <span className="block text-sm font-bold text-cdl-title">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-5 text-cdl-muted">
            {description}
          </span>
        ) : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-amber-500"
      />
    </label>
  )
}

function Editor({
  initial,
  packages,
  saving,
  onCancel,
  onSave,
}: {
  initial: Form
  packages: Package[]
  saving: boolean
  onCancel: () => void
  onSave: (form: Form) => Promise<void>
}) {
  const [form, setForm] = useState<Form>(initial)
  useEffect(() => setForm(initial), [initial])
  const patch = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-5">
      <div className="max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl border border-cdl-border bg-cdl-surface shadow-2xl sm:rounded-3xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-cdl-border bg-cdl-surface/95 px-5 py-4 backdrop-blur sm:px-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-600">
              Configuração comercial
            </p>
            <h2 className="mt-1 text-2xl font-black text-cdl-title">
              {form.id ? `Editar ${form.code}` : 'Novo cupom'}
            </h2>
            <p className="mt-1 text-xs text-cdl-muted">
              A regra é revalidada no servidor antes da cotação ser criada.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-cdl-border px-3 py-1.5 text-sm font-bold text-cdl-muted"
          >
            Fechar
          </button>
        </header>

        <div className="space-y-7 p-5 sm:p-7">
          <section className="grid gap-4 rounded-2xl border border-cdl-border bg-cdl-bg p-4 sm:grid-cols-2">
            <Field label="Código">
              <input
                value={form.code}
                maxLength={32}
                placeholder="CDL10"
                onChange={(event) =>
                  patch(
                    'code',
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9_-]/g, ''),
                  )
                }
                className={`${INPUT} font-mono font-black uppercase tracking-wider`}
              />
            </Field>
            <Field label="Campanha">
              <input
                value={form.campaign_name}
                placeholder="CDL Barbecue Comercial"
                onChange={(event) => patch('campaign_name', event.target.value)}
                className={INPUT}
              />
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(event) =>
                  patch('status', event.target.value as Form['status'])
                }
                className={INPUT}
              >
                <option value="draft">Rascunho</option>
                <option value="active">Ativo</option>
                <option value="paused">Pausado</option>
                <option value="archived">Arquivado</option>
              </select>
            </Field>
            <Field label="Divulgação / canal">
              <input
                value={form.distribution_channel ?? ''}
                placeholder="Caio e parceiros comerciais"
                onChange={(event) =>
                  patch('distribution_channel', event.target.value)
                }
                className={INPUT}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Descrição">
                <textarea
                  rows={3}
                  value={form.description ?? ''}
                  onChange={(event) => patch('description', event.target.value)}
                  className={`${INPUT} py-2.5`}
                />
              </Field>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-black text-cdl-title">
              Benefício, mínimos e validade
            </h3>
            <div className="mt-3 grid gap-4 rounded-2xl border border-cdl-border bg-cdl-bg p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Tipo">
                <select
                  value={form.discount_type}
                  onChange={(event) =>
                    patch(
                      'discount_type',
                      event.target.value as Form['discount_type'],
                    )
                  }
                  className={INPUT}
                >
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor fixo (US$)</option>
                </select>
              </Field>
              <Field
                label={form.discount_type === 'percent' ? 'Percentual' : 'Valor fixo'}
              >
                <NumberField
                  value={form.discount_value}
                  onChange={(value) => patch('discount_value', value ?? 0)}
                />
              </Field>
              <Field label="Desconto máximo" hint="Opcional para limitar percentuais.">
                <NumberField
                  value={form.max_discount_amount}
                  placeholder="Sem teto"
                  onChange={(value) => patch('max_discount_amount', value)}
                />
              </Field>
              <Field label="Pedido mínimo elegível">
                <NumberField
                  value={form.min_eligible_amount}
                  onChange={(value) => patch('min_eligible_amount', value ?? 0)}
                />
              </Field>
              <Field label="Mínimo final Seg–Qui">
                <NumberField
                  value={form.minimum_final_mon_thu}
                  placeholder="Sem piso"
                  onChange={(value) => patch('minimum_final_mon_thu', value)}
                />
              </Field>
              <Field label="Mínimo final Sex–Dom">
                <NumberField
                  value={form.minimum_final_fri_sun}
                  placeholder="Sem piso"
                  onChange={(value) => patch('minimum_final_fri_sun', value)}
                />
              </Field>
              <Field label="Validade inicial">
                <input
                  type="date"
                  value={form.valid_from ?? ''}
                  onChange={(event) =>
                    patch('valid_from', event.target.value || null)
                  }
                  className={INPUT}
                />
              </Field>
              <Field label="Validade final">
                <input
                  type="date"
                  value={form.valid_to ?? ''}
                  onChange={(event) => patch('valid_to', event.target.value || null)}
                  className={INPUT}
                />
              </Field>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-black text-cdl-title">Elegibilidade</h3>
            <div className="mt-3 rounded-2xl border border-cdl-border bg-cdl-bg p-4">
              <p className="text-xs font-black uppercase tracking-wide text-cdl-muted">
                Dias do evento
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DAYS.map((day) => {
                  const active = form.eligible_weekdays.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() =>
                        patch(
                          'eligible_weekdays',
                          active
                            ? form.eligible_weekdays.filter(
                                (value) => value !== day.value,
                              )
                            : [...form.eligible_weekdays, day.value],
                        )
                      }
                      className={`rounded-full border px-3 py-2 text-xs font-black ${
                        active
                          ? 'border-amber-400 bg-amber-100 text-amber-900'
                          : 'border-cdl-border bg-cdl-surface text-cdl-muted'
                      }`}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Toggle
                  checked={form.all_packages}
                  onChange={(value) => patch('all_packages', value)}
                  label="Todos os pacotes"
                  description="Desligue para escolher pacotes específicos."
                />
                <Toggle
                  checked={form.new_customer_only}
                  onChange={(value) => patch('new_customer_only', value)}
                  label="Somente cliente novo"
                  description="A validação usa o telefone normalizado do cliente."
                />
              </div>
              {!form.all_packages ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {packages.map((item) => {
                    const selected = form.eligible_package_ids.includes(item.id)
                    return (
                      <label
                        key={item.id}
                        className="flex items-center gap-2 rounded-xl border border-cdl-border bg-cdl-surface p-3 text-sm font-semibold text-cdl-title"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            patch(
                              'eligible_package_ids',
                              selected
                                ? form.eligible_package_ids.filter(
                                    (id) => id !== item.id,
                                  )
                                : [...form.eligible_package_ids, item.id],
                            )
                          }
                          className="h-4 w-4 accent-amber-500"
                        />
                        {item.label_pt || item.package_name || item.package_key || 'Pacote'}
                      </label>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-black text-cdl-title">
              O que entra no desconto
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Toggle
                checked={form.include_additionals}
                onChange={(value) => patch('include_additionals', value)}
                label="Adicionais"
              />
              <Toggle
                checked={form.include_additional_cuts}
                onChange={(value) => patch('include_additional_cuts', value)}
                label="Cortes adicionais"
              />
              <Toggle
                checked={form.include_grill}
                onChange={(value) => patch('include_grill', value)}
                label="Churrasqueira"
              />
              <Toggle
                checked={form.include_mileage}
                onChange={(value) => patch('include_mileage', value)}
                label="Milhagem"
              />
            </div>
          </section>

          <section>
            <h3 className="text-lg font-black text-cdl-title">
              Controle e aprovação
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Toggle
                checked={form.stackable}
                onChange={(value) => patch('stackable', value)}
                label="Combina com outros descontos"
              />
              <Toggle
                checked={false}
                onChange={() => undefined}
                disabled
                label="Aplicar no sinal"
                description="Protegido no V1: o cupom atua somente no saldo."
              />
              <Toggle
                checked={form.apply_to_balance}
                onChange={(value) => patch('apply_to_balance', value)}
                label="Aplicar no saldo"
              />
              <Toggle
                checked={form.allow_post_event_adjustment}
                onChange={(value) =>
                  patch('allow_post_event_adjustment', value)
                }
                label="Ajuste pós-evento"
              />
              <Toggle
                checked={form.manual_approval_required}
                onChange={(value) => patch('manual_approval_required', value)}
                label="Aprovação manual"
                description="O cliente solicita; o desconto só entra após aprovação."
              />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Máx. usos por cliente">
                <NumberField
                  value={form.max_uses_per_customer}
                  min={1}
                  step="1"
                  onChange={(value) => patch('max_uses_per_customer', value)}
                />
              </Field>
              <Field label="Máx. aplicações por pedido">
                <NumberField
                  value={form.max_uses_per_quote}
                  min={1}
                  step="1"
                  onChange={(value) =>
                    patch('max_uses_per_quote', Math.max(1, Math.floor(value ?? 1)))
                  }
                />
              </Field>
            </div>
          </section>
        </div>

        <footer className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-cdl-border bg-cdl-surface/95 px-5 py-4 backdrop-blur sm:flex-row sm:justify-end sm:px-7">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="min-h-11 rounded-xl border border-cdl-border px-5 text-sm font-bold text-cdl-title"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void onSave(form)}
            disabled={saving || !form.code || !form.campaign_name}
            className="min-h-11 rounded-xl bg-amber-400 px-6 text-sm font-black text-black shadow-sm hover:bg-amber-300 disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar cupom'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function statusClass(status: Coupon['status']) {
  if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (status === 'paused') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

export default function CouponsDashboard() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editor, setEditor] = useState<Form | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/coupons', { cache: 'no-store' })
      const result = (await response.json()) as {
        coupons?: Coupon[]
        packages?: Package[]
        canManage?: boolean
        error?: string
      }
      if (!response.ok) throw new Error(result.error || 'Falha ao carregar cupons.')
      setCoupons(result.coupons ?? [])
      setPackages(result.packages ?? [])
      setCanManage(Boolean(result.canManage))
      if (result.canManage) {
        const pendingResponse = await fetch('/api/coupons/applications', {
          cache: 'no-store',
        })
        const pendingResult = (await pendingResponse.json().catch(() => ({}))) as {
          applications?: Pending[]
        }
        if (pendingResponse.ok) setPending(pendingResult.applications ?? [])
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Falha ao carregar cupons.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const summary = useMemo(
    () => ({
      active: coupons.filter((coupon) => coupon.status === 'active').length,
      draft: coupons.filter((coupon) => coupon.status === 'draft').length,
      manual: coupons.filter((coupon) => coupon.manual_approval_required).length,
    }),
    [coupons],
  )

  async function save(form: Form) {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/coupons', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      if (!response.ok) {
        throw new Error(result.error || 'Não foi possível salvar o cupom.')
      }
      setEditor(null)
      await load()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível salvar o cupom.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function decide(id: string, action: 'approve' | 'reject') {
    const label = action === 'approve' ? 'Aprovar este desconto?' : 'Rejeitar esta solicitação?'
    if (!window.confirm(label)) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/coupons/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      if (!response.ok) {
        throw new Error(result.error || 'Não foi possível concluir a decisão.')
      }
      await load()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível concluir a decisão.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border border-cdl-border bg-cdl-surface shadow-cdl">
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.28),transparent_38%),linear-gradient(135deg,#111827,#050505)] px-5 py-7 text-white sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">
                Parâmetros comerciais
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Cupons e campanhas
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                Desconto, elegibilidade, mínimos, saldo e aprovação manual em um só lugar.
              </p>
            </div>
            {canManage ? (
              <button
                type="button"
                onClick={() =>
                  setEditor({
                    ...EMPTY,
                    eligible_weekdays: [...EMPTY.eligible_weekdays],
                    eligible_package_ids: [],
                  })
                }
                className="min-h-12 rounded-xl bg-amber-400 px-5 text-sm font-black text-black shadow-lg shadow-amber-500/20 hover:bg-amber-300"
              >
                + Novo cupom
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-px bg-cdl-border sm:grid-cols-4">
          {[
            ['Ativos', summary.active],
            ['Rascunhos', summary.draft],
            ['Aprovação manual', summary.manual],
            ['Pendentes', pending.length],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-cdl-surface p-4 sm:p-5">
              <p className="text-xs font-black uppercase tracking-wide text-cdl-muted">
                {label}
              </p>
              <p className="mt-1 text-2xl font-black text-cdl-title">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      ) : null}

      {canManage && pending.length ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
            Ação necessária
          </p>
          <h2 className="mt-1 text-xl font-black text-cdl-title">
            Cupons aguardando aprovação
          </h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {pending.map((application) => (
              <article key={application.id} className="rounded-2xl border border-amber-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-lg bg-black px-2.5 py-1 font-mono text-xs font-black text-amber-300">
                      {application.coupon_code_snapshot}
                    </span>
                    <p className="mt-2 text-sm font-black text-cdl-title">
                      {application.customer_name || 'Cliente'} ·{' '}
                      {application.quote_number || 'Cotação'}
                    </p>
                    <p className="mt-1 text-xs text-cdl-muted">
                      {application.campaign_name_snapshot}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-cdl-muted">Desconto solicitado</p>
                    <p className="text-lg font-black text-emerald-700">
                      −{money(application.potential_discount_amount)}
                    </p>
                    <p className="text-[10px] text-cdl-muted">
                      Base {money(application.eligible_amount)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void decide(application.id, 'reject')}
                    className="min-h-10 flex-1 rounded-xl border border-red-200 bg-red-50 text-xs font-black text-red-700 disabled:opacity-50"
                  >
                    Rejeitar
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void decide(application.id, 'approve')}
                    className="min-h-10 flex-1 rounded-xl bg-emerald-600 text-xs font-black text-white disabled:opacity-50"
                  >
                    Aprovar desconto
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cdl-muted">
              Campanhas configuradas
            </p>
            <h2 className="mt-1 text-2xl font-black text-cdl-title">Central de cupons</h2>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-xl border border-cdl-border px-4 py-2 text-xs font-bold text-cdl-muted"
          >
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-64 animate-pulse rounded-3xl border border-cdl-border bg-cdl-surface" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {coupons.map((coupon) => (
              <article
                key={coupon.id}
                className="flex min-h-[300px] flex-col overflow-hidden rounded-3xl border border-cdl-border bg-cdl-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="border-b border-cdl-border p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-lg bg-black px-2.5 py-1 font-mono text-xs font-black tracking-wider text-amber-300">
                          {coupon.code}
                        </span>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${statusClass(coupon.status)}`}>
                          {coupon.status}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-black text-cdl-title">
                        {coupon.campaign_name}
                      </h3>
                    </div>
                    <div className="rounded-2xl bg-amber-50 px-3 py-2 text-right">
                      <p className="text-[10px] font-black uppercase text-amber-700">
                        Desconto
                      </p>
                      <p className="text-xl font-black text-amber-900">
                        {coupon.discount_type === 'percent'
                          ? `${Number(coupon.discount_value)}%`
                          : money(coupon.discount_value)}
                      </p>
                    </div>
                  </div>
                  {coupon.description ? (
                    <p className="mt-3 text-xs leading-5 text-cdl-muted">
                      {coupon.description}
                    </p>
                  ) : null}
                </div>
                <div className="grid flex-1 grid-cols-2 gap-2 p-4 text-xs">
                  <div className="rounded-xl bg-cdl-bg p-3">
                    <p className="text-cdl-muted">Validade</p>
                    <p className="mt-1 font-black text-cdl-title">
                      {formatDate(coupon.valid_from)} → {formatDate(coupon.valid_to)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-cdl-bg p-3">
                    <p className="text-cdl-muted">Mínimo elegível</p>
                    <p className="mt-1 font-black text-cdl-title">
                      {money(coupon.min_eligible_amount)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-cdl-bg p-3">
                    <p className="text-cdl-muted">Aplicação</p>
                    <p className="mt-1 font-black text-cdl-title">Saldo</p>
                  </div>
                  <div className="rounded-xl bg-cdl-bg p-3">
                    <p className="text-cdl-muted">Aprovação</p>
                    <p className="mt-1 font-black text-cdl-title">
                      {coupon.manual_approval_required ? 'Manual' : 'Automática'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 px-4 pb-4">
                  {coupon.include_additionals ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">Adicionais</span> : null}
                  {coupon.include_additional_cuts ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">Cortes</span> : null}
                  {coupon.include_grill ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">Churrasqueira</span> : null}
                  {coupon.include_mileage ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">Milhagem</span> : null}
                  {coupon.allow_post_event_adjustment ? <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold text-violet-700">Pós-evento</span> : null}
                </div>
                {canManage ? (
                  <div className="border-t border-cdl-border p-3">
                    <button
                      type="button"
                      onClick={() =>
                        setEditor({
                          ...coupon,
                          eligible_weekdays: [...coupon.eligible_weekdays],
                          eligible_package_ids: [...coupon.eligible_package_ids],
                        })
                      }
                      className="min-h-10 w-full rounded-xl border border-cdl-border bg-cdl-bg text-xs font-black text-cdl-title hover:border-amber-300 hover:bg-amber-50"
                    >
                      Editar configuração
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {editor ? (
        <Editor
          initial={editor}
          packages={packages}
          saving={saving}
          onCancel={() => setEditor(null)}
          onSave={save}
        />
      ) : null}
    </main>
  )
}

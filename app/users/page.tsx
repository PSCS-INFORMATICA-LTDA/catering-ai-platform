'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { resolveAuthLocale, tAuth } from '@/Lib/i18n/authUsers'
import { useAuthLocale } from '@/Lib/i18n/useAuthLocale'

type Row = {
  id: string
  userId: string
  role: string
  status: string
  email: string | null
  name: string | null
  isPlatformAdmin?: boolean
}

function UsersPageInner() {
  const { locale, setLocale } = useAuthLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [rows, setRows] = useState<Row[]>([])
  const [canManage, setCanManage] = useState(false)
  const [canInvite, setCanInvite] = useState(false)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('operator')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [supportCompanyId, setSupportCompanyId] = useState('')
  const [supportReason, setSupportReason] = useState('')
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [page, setPage] = useState(Number(searchParams.get('page') || 1) || 1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [qInput, setQInput] = useState(searchParams.get('q') || '')
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(qInput.trim())
      setPage(1)
    }, 350)
    return () => window.clearTimeout(t)
  }, [qInput])

  useEffect(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (roleFilter) params.set('role', roleFilter)
    if (statusFilter) params.set('status', statusFilter)
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [q, roleFilter, statusFilter, page, pathname, router])

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (me) => {
        if (!me.ok || cancelled) return
        const mj = await me.json()
        if (cancelled) return
        setIsPlatformAdmin(Boolean(mj.isPlatformAdmin))
        setMyUserId(mj.userId ?? null)
        if (mj.locale) setLocale(resolveAuthLocale(mj.locale))
      })
      .catch(() => null)
    return () => {
      cancelled = true
    }
  }, [setLocale])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (roleFilter) params.set('role', roleFilter)
    if (statusFilter) params.set('status', statusFilter)
    params.set('page', String(page))
    params.set('pageSize', '10')

    void (async () => {
      if (!cancelled) setLoading(true)
      try {
        const res = await fetch(`/api/users?${params.toString()}`, {
          cache: 'no-store',
        })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(json.error || 'Erro')
          setRows([])
          return
        }
        setError(null)
        setRows(json.data || [])
        setCanManage(Boolean(json.canManage))
        setCanInvite(Boolean(json.canInvite))
        setTotal(Number(json.total) || 0)
        setTotalPages(Number(json.totalPages) || 1)
      } catch {
        if (!cancelled) setError('Erro')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [reloadToken, q, roleFilter, statusFilter, page])

  useEffect(() => {
    if (!isPlatformAdmin) return
    let cancelled = false
    fetch('/api/platform/companies', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok || cancelled) return
        const json = await res.json()
        if (!cancelled) setCompanies(json.data || [])
      })
      .catch(() => null)
    return () => {
      cancelled = true
    }
  }, [isPlatformAdmin])

  function clearFilters() {
    setQInput('')
    setQ('')
    setRoleFilter('')
    setStatusFilter('')
    setPage(1)
  }

  async function load() {
    setReloadToken((n) => n + 1)
  }

  async function invite(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Falha ao convidar')
      return
    }
    setEmail('')
    await load()
  }

  async function updateRow(id: string, patch: { role?: string; status?: string }) {
    setError(null)
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(
        json.error === 'last_owner_protected'
          ? tAuth(locale, 'lastOwnerBlocked')
          : json.error === 'self_role_change_blocked'
            ? tAuth(locale, 'selfDeleteBlocked')
            : json.error || 'Erro',
      )
      return
    }
    await load()
  }

  async function removeRow(id: string) {
    const reason = window.prompt(tAuth(locale, 'reason'))
    if (!reason || reason.trim().length < 8) return
    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(
        json.error === 'last_owner_protected'
          ? tAuth(locale, 'lastOwnerBlocked')
          : json.error === 'self_delete_blocked'
            ? tAuth(locale, 'selfDeleteBlocked')
            : json.error || 'Erro',
      )
      return
    }
    await load()
  }

  return (
    <main className="mx-auto w-full max-w-5xl">
      <h1 className="text-2xl font-bold">{tAuth(locale, 'users')}</h1>

      {isPlatformAdmin ? (
        <section className="mt-4 rounded-2xl border border-cdl-border bg-cdl-surface p-4">
          <h2 className="font-semibold">{tAuth(locale, 'startSupport')}</h2>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault()
              const res = await fetch('/api/auth/support/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  companyId: supportCompanyId,
                  reason: supportReason,
                }),
              })
              const json = await res.json()
              if (!res.ok) {
                setError(json.error || 'Erro suporte')
                return
              }
              window.location.reload()
            }}
          >
            <select
              required
              value={supportCompanyId}
              onChange={(e) => setSupportCompanyId(e.target.value)}
              className="rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2"
            >
              <option value="">Empresa…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              required
              minLength={8}
              placeholder={tAuth(locale, 'reason')}
              value={supportReason}
              onChange={(e) => setSupportReason(e.target.value)}
              className="rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2"
            />
            <button type="submit" className="cdl-btn-primary sm:col-span-2">
              {tAuth(locale, 'startSupport')}
            </button>
          </form>
        </section>
      ) : null}

      {canInvite ? (
        <form
          onSubmit={invite}
          className="mt-4 grid gap-3 rounded-2xl border border-cdl-border bg-cdl-surface p-4 sm:grid-cols-3"
        >
          <input
            type="email"
            required
            placeholder={tAuth(locale, 'email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2"
          >
            {['admin', 'manager', 'sales', 'operator', 'kitchen', 'finance', 'viewer'].map(
              (r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ),
            )}
          </select>
          <button type="submit" className="cdl-btn-primary">
            {tAuth(locale, 'inviteUser')}
          </button>
        </form>
      ) : null}

      <section className="mt-4 grid gap-3 rounded-2xl border border-cdl-border bg-cdl-surface p-4 sm:grid-cols-4">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-cdl-muted">{tAuth(locale, 'search')}</span>
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder={tAuth(locale, 'searchPlaceholder')}
            className="w-full rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-cdl-muted">{tAuth(locale, 'filterRole')}</span>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2"
          >
            <option value="">{tAuth(locale, 'allRoles')}</option>
            {['owner', 'admin', 'manager', 'sales', 'operator', 'kitchen', 'finance', 'viewer'].map(
              (r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-cdl-muted">{tAuth(locale, 'filterStatus')}</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2"
          >
            <option value="">{tAuth(locale, 'allStatuses')}</option>
            <option value="active">{tAuth(locale, 'active')}</option>
            <option value="inactive">{tAuth(locale, 'inactive')}</option>
            <option value="suspended">{tAuth(locale, 'suspended')}</option>
          </select>
        </label>
        <button
          type="button"
          onClick={clearFilters}
          className="rounded-xl border border-cdl-border px-3 py-2 text-sm sm:col-span-4"
        >
          {tAuth(locale, 'clearFilters')}
        </button>
      </section>

      {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
      {loading ? <p className="mt-3 text-sm text-cdl-muted">…</p> : null}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-cdl-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-cdl-surface text-cdl-muted">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">{tAuth(locale, 'email')}</th>
              <th className="px-3 py-2">{tAuth(locale, 'role')}</th>
              <th className="px-3 py-2">{tAuth(locale, 'status')}</th>
              {canManage ? <th className="px-3 py-2">Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-cdl-muted" colSpan={canManage ? 5 : 4}>
                  {tAuth(locale, 'emptyUsers')}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const isSelf = Boolean(myUserId && row.userId === myUserId)
              return (
                <tr key={row.id} className="border-t border-cdl-border">
                  <td className="px-3 py-2">{row.name || '—'}</td>
                  <td className="px-3 py-2">{row.email || '—'}</td>
                  <td className="px-3 py-2">
                    {canManage && !isSelf ? (
                      <select
                        value={row.role}
                        onChange={(e) => void updateRow(row.id, { role: e.target.value })}
                        className="rounded-lg border border-cdl-border bg-cdl-bg px-2 py-1"
                      >
                        {[
                          'owner',
                          'admin',
                          'manager',
                          'sales',
                          'operator',
                          'kitchen',
                          'finance',
                          'viewer',
                        ].map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      row.role
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canManage && !isSelf ? (
                      <select
                        value={row.status}
                        onChange={(e) => void updateRow(row.id, { status: e.target.value })}
                        className="rounded-lg border border-cdl-border bg-cdl-bg px-2 py-1"
                      >
                        <option value="active">{tAuth(locale, 'active')}</option>
                        <option value="inactive">{tAuth(locale, 'inactive')}</option>
                        <option value="suspended">{tAuth(locale, 'suspended')}</option>
                      </select>
                    ) : (
                      row.status
                    )}
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      {!isSelf ? (
                        <button
                          type="button"
                          className="underline"
                          onClick={() => void removeRow(row.id)}
                        >
                          {tAuth(locale, 'removeMembership')}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-cdl-muted">
          {tAuth(locale, 'page')} {page}/{totalPages} · {total}
        </span>
        <button
          type="button"
          disabled={page <= 1}
          className="rounded-lg border border-cdl-border px-3 py-1 disabled:opacity-40"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ←
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          className="rounded-lg border border-cdl-border px-3 py-1 disabled:opacity-40"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          →
        </button>
      </div>
    </main>
  )
}

export default function UsersPage() {
  return (
    <Suspense fallback={<main className="p-8 text-center">…</main>}>
      <UsersPageInner />
    </Suspense>
  )
}

'use client'

import { FormEvent, useEffect, useState } from 'react'
import AppMainNav from '@/components/AppMainNav'
import { tAuth } from '@/Lib/i18n/authUsers'

type Row = {
  id: string
  userId: string
  role: string
  status: string
  email: string | null
  name: string | null
  isPlatformAdmin?: boolean
}

export default function UsersPage() {
  const locale = 'pt'
  const [rows, setRows] = useState<Row[]>([])
  const [canManage, setCanManage] = useState(false)
  const [canInvite, setCanInvite] = useState(false)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('operator')
  const [error, setError] = useState<string | null>(null)
  const [supportCompanyId, setSupportCompanyId] = useState('')
  const [supportReason, setSupportReason] = useState('')
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])

  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (me) => {
        if (!me.ok || cancelled) return
        const mj = await me.json()
        if (!cancelled) setIsPlatformAdmin(Boolean(mj.isPlatformAdmin))
      })
      .catch(() => null)

    fetch('/api/users', { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(json.error || 'Erro')
          return
        }
        setRows(json.data || [])
        setCanManage(Boolean(json.canManage))
        setCanInvite(Boolean(json.canInvite))
      })
      .catch(() => null)

    return () => {
      cancelled = true
    }
  }, [reloadToken])

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
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <AppMainNav />
      <h1 className="mt-4 text-2xl font-bold">{tAuth(locale, 'users')}</h1>

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
        <form onSubmit={invite} className="mt-4 grid gap-3 rounded-2xl border border-cdl-border bg-cdl-surface p-4 sm:grid-cols-3">
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
            {['admin', 'manager', 'sales', 'operator', 'kitchen', 'finance', 'viewer'].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button type="submit" className="cdl-btn-primary">
            {tAuth(locale, 'inviteUser')}
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}

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
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-cdl-border">
                <td className="px-3 py-2">{row.name || '—'}</td>
                <td className="px-3 py-2">{row.email || '—'}</td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <select
                      value={row.role}
                      onChange={(e) => void updateRow(row.id, { role: e.target.value })}
                      className="rounded-lg border border-cdl-border bg-cdl-bg px-2 py-1"
                    >
                      {['owner', 'admin', 'manager', 'sales', 'operator', 'kitchen', 'finance', 'viewer'].map(
                        (r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ),
                      )}
                    </select>
                  ) : (
                    row.role
                  )}
                </td>
                <td className="px-3 py-2">
                  {canManage ? (
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
                    <button
                      type="button"
                      className="underline"
                      onClick={() => void removeRow(row.id)}
                    >
                      {tAuth(locale, 'removeMembership')}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

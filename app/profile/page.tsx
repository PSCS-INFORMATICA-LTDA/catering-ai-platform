'use client'

import { FormEvent, useEffect, useState } from 'react'
import AppMainNav from '@/components/AppMainNav'
import { tAuth } from '@/Lib/i18n/authUsers'

export default function ProfilePage() {
  const locale = 'pt'
  const [displayName, setDisplayName] = useState('')
  const [language, setLanguage] = useState('pt')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const res = await fetch('/api/profile', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setDisplayName(json.appUser?.display_name || json.appUser?.full_name || '')
      setLanguage(json.appUser?.preferred_language || 'pt')
    })()
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (newPassword && newPassword !== confirm) {
      setError('Senhas não conferem')
      return
    }
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName,
        preferredLanguage: language,
        newPassword: newPassword || undefined,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Erro')
      return
    }
    setNewPassword('')
    setConfirm('')
    setMessage(tAuth(locale, 'passwordUpdated'))
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <AppMainNav />
      <h1 className="mt-4 text-2xl font-bold">{tAuth(locale, 'profile')}</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-2xl border border-cdl-border bg-cdl-surface p-4 sm:p-6">
        <label className="block text-sm">
          <span className="mb-1 block text-cdl-muted">{tAuth(locale, 'displayName')}</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2.5"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-cdl-muted">{tAuth(locale, 'language')}</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2.5"
          >
            <option value="pt">Português</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
        <fieldset className="space-y-3 border-t border-cdl-border pt-4">
          <legend className="text-sm font-semibold">{tAuth(locale, 'changePassword')}</legend>
          <input
            type="password"
            placeholder={tAuth(locale, 'newPassword')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2.5"
          />
          <input
            type="password"
            placeholder={tAuth(locale, 'confirmPassword')}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2.5"
          />
        </fieldset>
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-500">{message}</p> : null}
        <button type="submit" className="cdl-btn-primary">
          {tAuth(locale, 'save')}
        </button>
      </form>
    </main>
  )
}

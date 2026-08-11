'use client'

import { FormEvent, useEffect, useState } from 'react'
import { resolveAuthLocale, tAuth } from '@/Lib/i18n/authUsers'
import { tCommon } from '@/Lib/i18n/common'
import { useAuthLocale } from '@/Lib/i18n/useAuthLocale'

export default function ProfilePage() {
  const { locale, setLocale } = useAuthLocale()
  const [displayName, setDisplayName] = useState('')
  const [language, setLanguage] = useState('pt')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch('/api/profile', { cache: 'no-store' })
      if (!res.ok || cancelled) return
      const json = await res.json()
      if (cancelled) return
      setDisplayName(
        (json.appUser?.display_name || json.appUser?.full_name || '').trim(),
      )
      const lang = json.appUser?.preferred_language || 'pt'
      setLanguage(lang)
      setLocale(resolveAuthLocale(lang))
    })()
    return () => {
      cancelled = true
    }
    // Carrega uma vez ao montar — não repor o nome a cada re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    const nextName = displayName.trim()
    if (!nextName) {
      setError(tAuth(locale, 'displayNameRequired'))
      return
    }
    if (newPassword && newPassword !== confirm) {
      setError(tAuth(locale, 'passwordsDoNotMatch'))
      return
    }
    if (newPassword && !currentPassword) {
      setError(tAuth(locale, 'currentPassword'))
      return
    }
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: nextName,
        preferredLanguage: language,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || tCommon(locale, 'error'))
      return
    }
    setDisplayName(nextName)
    setCurrentPassword('')
    setNewPassword('')
    setConfirm('')
    setLocale(resolveAuthLocale(language))
    setMessage(
      newPassword
        ? tAuth(locale, 'passwordUpdated')
        : tAuth(locale, 'profileSaved'),
    )
  }

  return (
    <main className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-bold">{tAuth(locale, 'profile')}</h1>
      <form
        onSubmit={onSubmit}
        className="mt-6 space-y-4 rounded-2xl border border-cdl-border bg-cdl-surface p-4 sm:p-6"
      >
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
            onChange={(e) => {
              setLanguage(e.target.value)
              setLocale(resolveAuthLocale(e.target.value))
            }}
            className="w-full rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2.5"
          >
            <option value="pt">{tCommon(locale, 'portuguese')}</option>
            <option value="en">{tCommon(locale, 'english')}</option>
            <option value="es">{tCommon(locale, 'spanish')}</option>
          </select>
        </label>
        <fieldset className="space-y-3 border-t border-cdl-border pt-4">
          <legend className="text-sm font-semibold">{tAuth(locale, 'changePassword')}</legend>
          <input
            type="password"
            placeholder={tAuth(locale, 'currentPassword')}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2.5"
            autoComplete="current-password"
          />
          <input
            type="password"
            placeholder={tAuth(locale, 'newPassword')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2.5"
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder={tAuth(locale, 'confirmPassword')}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2.5"
            autoComplete="new-password"
          />
        </fieldset>
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-500">{message}</p> : null}
        <button
          type="submit"
          className="liquid-glass-btn liquid-glass-btn--primary"
        >
          {tAuth(locale, 'save')}
        </button>
      </form>
    </main>
  )
}

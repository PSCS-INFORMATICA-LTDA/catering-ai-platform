'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/Lib/supabase/client'
import { resolveAuthLocale, tAuth } from '@/Lib/i18n/authUsers'
import { useAuthLocale } from '@/Lib/i18n/useAuthLocale'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { locale, setLocale } = useAuthLocale()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError(tAuth(locale, 'required'))
      return
    }
    if (password !== confirm) {
      setError(
        locale === 'en'
          ? 'Passwords do not match'
          : locale === 'es'
            ? 'Las contraseñas no coinciden'
            : 'Senhas não conferem',
      )
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: updError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updError) {
      setError(updError.message)
      return
    }
    router.replace('/login')
  }

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-cdl-border bg-cdl-surface p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{tAuth(locale, 'resetTitle')}</h1>
          <select
            value={locale}
            onChange={(e) => setLocale(resolveAuthLocale(e.target.value))}
            className="rounded-lg border border-cdl-border bg-cdl-bg px-2 py-1 text-xs"
            aria-label={tAuth(locale, 'language')}
          >
            <option value="pt">PT</option>
            <option value="en">EN</option>
            <option value="es">ES</option>
          </select>
        </div>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="mb-1 block text-cdl-muted">{tAuth(locale, 'newPassword')}</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2.5"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-cdl-muted">{tAuth(locale, 'confirmPassword')}</span>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2.5"
            />
          </label>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <button type="submit" disabled={loading} className="cdl-btn-primary w-full">
            {tAuth(locale, 'save')}
          </button>
        </form>
      </div>
    </main>
  )
}

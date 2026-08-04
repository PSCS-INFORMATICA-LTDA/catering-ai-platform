'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGlassShell } from '@/components/auth/AuthGlassShell'
import { createClient } from '@/Lib/supabase/client'
import { glassField } from '@/Lib/liquidGlass'
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
    <AuthGlassShell
      toolbar={
        <select
          value={locale}
          onChange={(e) => setLocale(resolveAuthLocale(e.target.value))}
          className="auth-glass-lang"
          aria-label={tAuth(locale, 'language')}
        >
          <option value="pt">PT</option>
          <option value="en">EN</option>
          <option value="es">ES</option>
        </select>
      }
    >
      <h1 className="text-xl font-bold text-cdl-fg sm:text-2xl">
        {tAuth(locale, 'resetTitle')}
      </h1>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm">
          <span className="mb-1.5 block text-cdl-muted">{tAuth(locale, 'newPassword')}</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={glassField(true)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-cdl-muted">
            {tAuth(locale, 'confirmPassword')}
          </span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={glassField(true)}
          />
        </label>
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        <button type="submit" disabled={loading} className="cdl-btn-primary w-full">
          {tAuth(locale, 'save')}
        </button>
      </form>
    </AuthGlassShell>
  )
}

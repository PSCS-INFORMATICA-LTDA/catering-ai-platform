'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { AuthGlassShell } from '@/components/auth/AuthGlassShell'
import { createClient } from '@/Lib/supabase/client'
import { glassField } from '@/Lib/liquidGlass'
import { resolveAuthLocale, tAuth } from '@/Lib/i18n/authUsers'
import { useAuthLocale } from '@/Lib/i18n/useAuthLocale'

export default function ForgotPasswordPage() {
  const { locale, setLocale } = useAuthLocale()
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const origin = window.location.origin
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
    })
    setLoading(false)
    setDone(true)
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
        {tAuth(locale, 'forgotTitle')}
      </h1>
      {done ? (
        <p className="mt-4 text-sm text-cdl-muted">{tAuth(locale, 'resetSent')}</p>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="mb-1.5 block text-cdl-muted">{tAuth(locale, 'email')}</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={glassField(true)}
            />
          </label>
          <button type="submit" disabled={loading} className="cdl-btn-primary w-full">
            {tAuth(locale, 'sendReset')}
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="underline">
          {tAuth(locale, 'loginTitle')}
        </Link>
      </p>
    </AuthGlassShell>
  )
}

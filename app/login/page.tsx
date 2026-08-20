'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, Suspense, useState } from 'react'
import { AuthGlassShell } from '@/components/auth/AuthGlassShell'
import { safeInternalNext } from '@/Lib/auth/safeNext'
import { glassField } from '@/Lib/liquidGlass'
import { createClient } from '@/Lib/supabase/client'
import { resolveAuthLocale, tAuth, type AuthLocale } from '@/Lib/i18n/authUsers'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeInternalNext(params.get('next'), '/quotes')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [locale, setLocale] = useState<AuthLocale>('pt')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (signError) {
      setError(tAuth(locale, 'invalidCredentials'))
      return
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('catering.auth.locale', locale)
    }
    router.replace(next)
    router.refresh()
  }

  return (
    <AuthGlassShell
      toolbar={
        <label className="text-xs text-cdl-muted">
          <span className="sr-only">{tAuth(locale, 'language')}</span>
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
        </label>
      }
    >
      <h1 className="text-xl font-bold text-cdl-fg sm:text-2xl">
        {tAuth(locale, 'loginTitle')}
      </h1>
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
        <label className="block text-sm">
          <span className="mb-1.5 block text-cdl-muted">{tAuth(locale, 'password')}</span>
          <div className="flex gap-2">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={glassField(true)}
            />
            <button
              type="button"
              className="auth-glass-toggle shrink-0"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword
                ? tAuth(locale, 'hidePassword')
                : tAuth(locale, 'showPassword')}
            </button>
          </div>
        </label>
        {error ? (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="cdl-btn-primary w-full disabled:opacity-60"
        >
          {loading ? tAuth(locale, 'signingIn') : tAuth(locale, 'signIn')}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link href="/auth/forgot-password" className="text-[var(--brand-primary)] underline">
          {tAuth(locale, 'forgotPassword')}
        </Link>
      </p>
    </AuthGlassShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="p-8 text-center">…</main>}>
      <LoginForm />
    </Suspense>
  )
}

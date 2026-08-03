'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, Suspense, useState } from 'react'
import { createClient } from '@/Lib/supabase/client'
import { tAuth } from '@/Lib/i18n/authUsers'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/quotes'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const locale = 'pt'

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
    router.replace(next.startsWith('/') ? next : '/quotes')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-cdl-border bg-cdl-surface p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cdl-muted">
          {tAuth(locale, 'loginSubtitle')}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-cdl-fg sm:text-3xl">
          {tAuth(locale, 'loginTitle')}
        </h1>
        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="mb-1 block text-cdl-muted">{tAuth(locale, 'email')}</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2.5 text-cdl-fg outline-none focus:border-[var(--brand-primary)]"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-cdl-muted">{tAuth(locale, 'password')}</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2.5 text-cdl-fg outline-none focus:border-[var(--brand-primary)]"
            />
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
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="p-8 text-center">…</main>}>
      <LoginForm />
    </Suspense>
  )
}

'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { createClient } from '@/Lib/supabase/client'
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
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-cdl-border bg-cdl-surface p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{tAuth(locale, 'forgotTitle')}</h1>
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
        {done ? (
          <p className="mt-4 text-sm text-cdl-muted">{tAuth(locale, 'resetSent')}</p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <label className="block text-sm">
              <span className="mb-1 block text-cdl-muted">{tAuth(locale, 'email')}</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2.5"
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
      </div>
    </main>
  )
}

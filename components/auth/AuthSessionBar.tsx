'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/Lib/supabase/client'
import { tAuth } from '@/Lib/i18n/authUsers'

type MeResponse = {
  email?: string | null
  displayName?: string | null
  isPlatformAdmin?: boolean
  supportSession?: { reason: string } | null
  locale?: string
}

export default function AuthSessionBar() {
  const router = useRouter()
  const [me, setMe] = useState<MeResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as MeResponse
      if (!cancelled) setMe(data)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null)
    router.replace('/login')
    router.refresh()
  }

  if (!me) return null
  const locale = me.locale ?? 'pt'

  return (
    <div className="mb-3 space-y-2">
      {me.supportSession ? (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <strong>{tAuth(locale, 'supportBanner')}</strong>
          <span className="ml-2 opacity-80">— {me.supportSession.reason}</span>
          <button
            type="button"
            className="ml-3 underline"
            onClick={async () => {
              await fetch('/api/auth/support/end', { method: 'POST' })
              router.refresh()
              window.location.reload()
            }}
          >
            {tAuth(locale, 'endSupport')}
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-cdl-muted">
          {me.displayName || me.email}
          {me.isPlatformAdmin ? ` · ${tAuth(locale, 'platformAdmin')}` : ''}
        </span>
        <Link href="/profile" className="rounded-lg border border-cdl-border px-2 py-1">
          {tAuth(locale, 'profile')}
        </Link>
        <Link href="/users" className="rounded-lg border border-cdl-border px-2 py-1">
          {tAuth(locale, 'users')}
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-lg border border-cdl-border px-2 py-1"
        >
          {tAuth(locale, 'logout')}
        </button>
      </div>
    </div>
  )
}

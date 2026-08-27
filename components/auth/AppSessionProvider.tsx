'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { SafeAppSession } from '@/Lib/auth/safeSession'

type AppSessionValue = {
  session: SafeAppSession | null
  refresh: () => Promise<void>
}

const AppSessionCtx = createContext<AppSessionValue | null>(null)

export function AppSessionProvider({
  initialSession,
  children,
}: {
  initialSession?: SafeAppSession | null
  children: ReactNode
}) {
  const [session, setSession] = useState<SafeAppSession | null>(
    initialSession ?? null,
  )

  const refresh = useCallback(async () => {
    const response = await fetch('/api/auth/me', { cache: 'no-store' })
    if (!response.ok) {
      setSession(null)
      return
    }
    const payload = (await response.json()) as SafeAppSession & {
      displayName?: string | null
      locale?: string
    }
    setSession({
      userId: payload.userId,
      email: payload.email ?? null,
      displayName: payload.displayName ?? payload.email ?? null,
      locale: payload.locale ?? 'pt',
      isPlatformAdmin: Boolean(payload.isPlatformAdmin),
      permissions: payload.permissions ?? [],
      memberships: payload.memberships ?? [],
      activeMembership: payload.activeMembership ?? null,
      supportSession: payload.supportSession ?? null,
    })
  }, [])

  const value = useMemo<AppSessionValue>(
    () => ({ session, refresh }),
    [session, refresh],
  )

  return (
    <AppSessionCtx.Provider value={value}>{children}</AppSessionCtx.Provider>
  )
}

export function useAppSession(): AppSessionValue {
  const ctx = useContext(AppSessionCtx)
  if (!ctx) {
    throw new Error('useAppSession must be used within AppSessionProvider')
  }
  return ctx
}

export function useOptionalAppSession(): SafeAppSession | null {
  return useContext(AppSessionCtx)?.session ?? null
}

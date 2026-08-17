'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { tCommon } from '@/Lib/i18n/common'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type { Branch, Company, CompanyRole, TenantContext } from '@/Lib/tenant/types'
import { usePathname } from 'next/navigation'
import { isPublicRoutePathname } from '@/Lib/publicRoutes'

const BRANCH_STORAGE_KEY = 'catering-ai.active-branch-id'

type TenantContextValue = TenantContext & {
  loading: boolean
  setBranchId: (branchId: string | null) => void
  refresh: () => Promise<void>
}

const TenantCtx = createContext<TenantContextValue | null>(null)

export function TenantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/'
  const publicRoute = isPublicRoutePathname(pathname)
  const locale = useAuthLocaleFromMe(undefined, { disabled: publicRoute })
  const localeRef = useRef(locale)
  const [loading, setLoading] = useState(() => !publicRoute)
  const [companyId, setCompanyId] = useState('')
  const [company, setCompany] = useState<Company | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchIdState] = useState<string | null>(null)
  const [role, setRole] = useState<CompanyRole | null>(null)
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({})

  const refresh = useCallback(async () => {
    if (publicRoute) return
    setLoading(true)
    try {
      const response = await fetch('/api/tenant/context', { cache: 'no-store' })
      const result = (await response.json()) as {
        data?: TenantContext
        error?: string
      }
      if (!response.ok || !result.data) {
        throw new Error(
          result.error ?? tCommon(localeRef.current, 'tenantLoadError'),
        )
      }

      const data = result.data
      setCompanyId(data.companyId)
      setCompany(data.company)
      setBranches(data.branches)
      setRole(data.role)
      setFeatureFlags(data.featureFlags)

      const stored =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(BRANCH_STORAGE_KEY)
          : null
      const resolvedBranchId =
        stored && data.branches.some((b) => b.id === stored)
          ? stored
          : data.branchId

      setBranchIdState(resolvedBranchId)
    } finally {
      setLoading(false)
    }
  }, [publicRoute])

  useEffect(() => {
    localeRef.current = locale
  }, [locale])

  useEffect(() => {
    if (publicRoute) return
    const timer = window.setTimeout(() => {
      void refresh()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [publicRoute, refresh])

  const setBranchId = useCallback((next: string | null) => {
    setBranchIdState(next)
    if (typeof window !== 'undefined') {
      if (next) {
        window.localStorage.setItem(BRANCH_STORAGE_KEY, next)
      } else {
        window.localStorage.removeItem(BRANCH_STORAGE_KEY)
      }
    }
  }, [])

  const branch = useMemo(
    () => branches.find((row) => row.id === branchId) ?? null,
    [branches, branchId],
  )

  const value = useMemo<TenantContextValue>(
    () => ({
      companyId,
      company,
      branchId,
      branch,
      branches,
      role,
      featureFlags,
      loading,
      setBranchId,
      refresh,
    }),
    [
      companyId,
      company,
      branchId,
      branch,
      branches,
      role,
      featureFlags,
      loading,
      setBranchId,
      refresh,
    ],
  )

  return <TenantCtx.Provider value={value}>{children}</TenantCtx.Provider>
}

export function useTenant() {
  const ctx = useContext(TenantCtx)
  if (!ctx) {
    throw new Error('useTenant must be used within TenantProvider')
  }
  return ctx
}

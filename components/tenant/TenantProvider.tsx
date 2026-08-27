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

function applyStoredBranch(
  data: TenantContext,
): Pick<TenantContext, 'branchId' | 'branch'> {
  const stored =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(BRANCH_STORAGE_KEY)
      : null
  const resolvedBranchId =
    stored && data.branches.some((branch) => branch.id === stored)
      ? stored
      : data.branchId
  return {
    branchId: resolvedBranchId,
    branch: data.branches.find((row) => row.id === resolvedBranchId) ?? null,
  }
}

export function TenantProvider({
  children,
  initialTenantContext = null,
}: {
  children: ReactNode
  initialTenantContext?: TenantContext | null
}) {
  const pathname = usePathname() ?? '/'
  const publicRoute = isPublicRoutePathname(pathname)
  const locale = useAuthLocaleFromMe(undefined, { disabled: publicRoute })
  const localeRef = useRef(locale)
  const [loading, setLoading] = useState(
    () => !publicRoute && !initialTenantContext,
  )
  const [companyId, setCompanyId] = useState(initialTenantContext?.companyId ?? '')
  const [company, setCompany] = useState<Company | null>(
    initialTenantContext?.company ?? null,
  )
  const [branches, setBranches] = useState<Branch[]>(
    initialTenantContext?.branches ?? [],
  )
  const [branchId, setBranchIdState] = useState<string | null>(
    initialTenantContext?.branchId ?? null,
  )
  const [role, setRole] = useState<CompanyRole | null>(
    initialTenantContext?.role ?? null,
  )
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>(
    initialTenantContext?.featureFlags ?? {},
  )

  const applyContext = useCallback((data: TenantContext) => {
    const resolved = applyStoredBranch(data)
    setCompanyId(data.companyId)
    setCompany(data.company)
    setBranches(data.branches)
    setRole(data.role)
    setFeatureFlags(data.featureFlags)
    setBranchIdState(resolved.branchId)
  }, [])

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
      applyContext(result.data)
    } finally {
      setLoading(false)
    }
  }, [applyContext, publicRoute])

  useEffect(() => {
    localeRef.current = locale
  }, [locale])

  useEffect(() => {
    if (publicRoute || !initialTenantContext) return
    const resolved = applyStoredBranch(initialTenantContext)
    setBranchIdState(resolved.branchId)
  }, [publicRoute, initialTenantContext])

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

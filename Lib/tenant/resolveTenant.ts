import type { CompanyRole } from './types'

/**
 * Explicit DEV override only. Never a silent CDL UUID fallback.
 * Authenticated traffic must resolve membership/session company_id.
 */
export function getConfiguredDevCompanyId(): string | null {
  return (
    process.env.NEXT_PUBLIC_CDL_COMPANY_ID?.trim() ||
    process.env.CDL_COMPANY_ID?.trim() ||
    null
  )
}

/**
 * Active company ID for scripts / single-tenant DEV when env is set.
 * Fail closed when no explicit company context exists.
 */
export function getActiveCompanyId(): string {
  const configured = getConfiguredDevCompanyId()
  if (configured) return configured
  throw new Error('company_context_required')
}

/**
 * Optional branch override via env (single-branch deployments).
 * Future: cookie/session from TenantProvider.
 */
export function getActiveBranchIdFromEnv(): string | null {
  return (
    process.env.NEXT_PUBLIC_CDL_BRANCH_ID?.trim() ||
    process.env.CDL_BRANCH_ID?.trim() ||
    null
  )
}

export function getActiveRoleFromEnv(): CompanyRole | null {
  const raw = process.env.NEXT_PUBLIC_CDL_USER_ROLE?.trim()
  if (!raw) return null
  return raw as CompanyRole
}

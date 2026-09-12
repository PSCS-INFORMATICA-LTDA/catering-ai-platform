import 'server-only'

import { hasPermission } from '@/Lib/auth/permissions'
import {
  rejectSpoofedCompanyId,
  requireApiPermission,
  requireAnyApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import type { AuthSessionContext } from '@/Lib/auth/types'

export const FINANCE_OBSERVABILITY_PERMISSION = 'finance.invoices.view'

export function canViewFinanceObservability(session: AuthSessionContext): boolean {
  return (
    session.isPlatformAdmin ||
    hasPermission(session.permissions, FINANCE_OBSERVABILITY_PERMISSION)
  )
}

export async function requireInvoiceControlApi() {
  return requireAnyApiPermission(FINANCE_OBSERVABILITY_PERMISSION, 'orders.financial.view')
}

export async function requirePaypalControlApi() {
  return requireApiPermission(FINANCE_OBSERVABILITY_PERMISSION)
}

export function authorizedFinanceCompanyId(
  session: AuthSessionContext,
  requestedCompanyId?: string | null,
): { ok: true; companyId: string } | { ok: false; response: Response } {
  const spoof = rejectSpoofedCompanyId(session, requestedCompanyId)
  if (spoof) return { ok: false, response: spoof }
  return { ok: true, companyId: resolveAuthorizedCompanyId(session) }
}

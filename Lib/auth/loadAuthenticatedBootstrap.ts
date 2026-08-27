import { cache } from 'react'
import { resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { toSafeAppSession, type SafeAppSession } from '@/Lib/auth/safeSession'
import { getAuthSession } from '@/Lib/auth/session'
import { logDevServerTiming } from '@/Lib/observability/serverTiming'
import { fetchTenantContext } from '@/Lib/tenant/fetchTenantContext'
import type { TenantContext } from '@/Lib/tenant/types'

export type AuthenticatedAppBootstrap = {
  session: SafeAppSession
  tenant: TenantContext
}

export const loadAuthenticatedAppBootstrap = cache(
  async function loadAuthenticatedAppBootstrap(): Promise<AuthenticatedAppBootstrap | null> {
    const started = Date.now()
    const session = await getAuthSession()
    const authMs = Date.now() - started
    if (!session) {
      logDevServerTiming('bootstrap', { authMs, tenantMs: 0, hit: false })
      return null
    }

    const tenantStarted = Date.now()
    const companyId = resolveAuthorizedCompanyId(session)
    const tenant = await fetchTenantContext({
      companyId,
      branchId: session.activeMembership?.branch_id ?? null,
      role: session.activeMembership?.role ?? null,
    })
    logDevServerTiming('bootstrap', {
      authMs,
      tenantMs: Date.now() - tenantStarted,
      hit: true,
    })

    return {
      session: toSafeAppSession(session),
      tenant,
    }
  },
)

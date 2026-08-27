import type { AuthSessionContext } from '@/Lib/auth/types'

/** Safe client bootstrap — never includes tokens, secrets, or service-role material. */
export type SafeAppSession = {
  userId: string
  email: string | null
  displayName: string | null
  locale: string
  isPlatformAdmin: boolean
  permissions: string[]
  memberships: Array<{
    id: string
    companyId: string
    companyName: string | null
    role: string
    status: string
  }>
  activeMembership: {
    id: string
    companyId: string
    role: string
    status: string
  } | null
  supportSession: {
    id: string
    companyId: string
    reason: string
    startedAt: string
  } | null
}

export function toSafeAppSession(session: AuthSessionContext): SafeAppSession {
  return {
    userId: session.userId,
    email: session.email,
    displayName:
      session.appUser?.display_name ||
      session.appUser?.full_name ||
      session.email,
    locale: session.appUser?.preferred_language ?? 'pt',
    isPlatformAdmin: session.isPlatformAdmin,
    permissions: session.permissions,
    memberships: session.memberships.map((membership) => ({
      id: membership.id,
      companyId: membership.company_id,
      companyName: membership.company_name ?? null,
      role: membership.role,
      status: membership.status,
    })),
    activeMembership: session.activeMembership
      ? {
          id: session.activeMembership.id,
          companyId: session.activeMembership.company_id,
          role: session.activeMembership.role,
          status: session.activeMembership.status,
        }
      : null,
    supportSession: session.supportSession
      ? {
          id: session.supportSession.id,
          companyId: session.supportSession.target_company_id,
          reason: session.supportSession.reason,
          startedAt: session.supportSession.started_at,
        }
      : null,
  }
}

import { getAuthSession } from '@/Lib/auth/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAuthSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return Response.json({
    userId: session.userId,
    email: session.email,
    displayName:
      session.appUser?.display_name ||
      session.appUser?.full_name ||
      session.email,
    locale: session.appUser?.preferred_language ?? 'pt',
    isPlatformAdmin: session.isPlatformAdmin,
    permissions: session.permissions,
    memberships: session.memberships.map((m) => ({
      id: m.id,
      companyId: m.company_id,
      companyName: m.company_name,
      role: m.role,
      status: m.status,
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
  })
}

import { hasPermission } from '@/Lib/auth/permissions'
import { getAuthSession } from '@/Lib/auth/session'
import type { AuthSessionContext } from '@/Lib/auth/types'
import { getCdlCompanyId } from '@/Lib/cdlCompany'

export type ApiAuthOk = { ok: true; session: AuthSessionContext }
export type ApiAuthErr = { ok: false; response: Response }
export type ApiAuthResult = ApiAuthOk | ApiAuthErr

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status })
}

export function resolveAuthorizedCompanyId(session: AuthSessionContext): string {
  return (
    session.supportSession?.target_company_id ||
    session.activeMembership?.company_id ||
    getCdlCompanyId()
  )
}

export async function requireApiAuth(): Promise<ApiAuthResult> {
  const session = await getAuthSession()
  if (!session) {
    return { ok: false, response: jsonError(401, 'Unauthorized') }
  }
  return { ok: true, session }
}

export async function requireApiPermission(
  permission: string,
): Promise<ApiAuthResult> {
  const auth = await requireApiAuth()
  if (!auth.ok) return auth

  if (auth.session.isPlatformAdmin) {
    return auth
  }

  if (!hasPermission(auth.session.permissions, permission)) {
    return { ok: false, response: jsonError(403, 'Forbidden') }
  }

  return auth
}

export async function requirePlatformAdminApi(): Promise<ApiAuthResult> {
  const auth = await requireApiAuth()
  if (!auth.ok) return auth
  if (!auth.session.isPlatformAdmin) {
    return { ok: false, response: jsonError(403, 'Forbidden') }
  }
  return auth
}

/**
 * Reject client-supplied company_id that does not match authorized context.
 * Platform Admin may only target another company when an active support session
 * points to that company — never via arbitrary query/body company_id alone.
 */
export function rejectSpoofedCompanyId(
  session: AuthSessionContext,
  bodyCompanyId: unknown,
): Response | null {
  if (bodyCompanyId === undefined || bodyCompanyId === null || bodyCompanyId === '') {
    return null
  }
  if (typeof bodyCompanyId !== 'string') {
    return jsonError(400, 'company_id inválido')
  }
  const authorized = resolveAuthorizedCompanyId(session)
  if (bodyCompanyId === authorized) return null
  if (
    session.isPlatformAdmin &&
    session.supportSession?.target_company_id === bodyCompanyId
  ) {
    return null
  }
  return jsonError(403, 'Forbidden')
}

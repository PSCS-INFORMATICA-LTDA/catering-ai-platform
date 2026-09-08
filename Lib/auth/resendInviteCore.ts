import type { UserInviteRow } from './acceptInviteCore'
import type { CompanyRole } from '@/Lib/tenant/types'

const ALLOWED_RESEND_ROLES: CompanyRole[] = [
  'owner',
  'admin',
  'manager',
  'sales',
  'operator',
  'kitchen',
  'finance',
  'viewer',
]

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isAllowedInviteRole(role: string): role is CompanyRole {
  return (ALLOWED_RESEND_ROLES as string[]).includes(role)
}

export function pendingInviteAuthFailureRevokeFields(nowIso: string): {
  status: 'revoked'
  revoked_at: string
  updated_at: string
} {
  return {
    status: 'revoked',
    revoked_at: nowIso,
    updated_at: nowIso,
  }
}

export type ExistingAuthUser = {
  id: string
  email: string
  emailConfirmedAt: string | null
}

export type ActiveMembershipSnapshot = {
  id: string
  role: string
  status: string
  active?: boolean
}

export type AuthReissueStrategy = 'invite_user_by_email' | 'generate_invite_link'

export type DirectoryInviteRow = {
  id: string
  kind: 'invite'
  userId: string
  inviteId: string
  role: string
  status: 'invited' | 'invite_expired'
  email: string
  name: null
  active: false
  isPlatformAdmin: false
  canResend: true
  createdAt: string
}

export type ResendInvitePlan =
  | { status: 'already_member'; email: string; role: CompanyRole }
  | { status: 'forbidden_tenant' }
  | { status: 'not_found' }
  | {
      status: 'resend'
      email: string
      role: CompanyRole
      companyId: string
      keepInviteId: string | null
      createNewInvite: boolean
      revokeInviteIds: string[]
      previousInvites: Array<{ id: string; status: string }>
      authStrategy: AuthReissueStrategy
      authUserReused: boolean
    }

export function revokePendingInviteFields(nowIso: string) {
  return pendingInviteAuthFailureRevokeFields(nowIso)
}

export function isMembershipActive(membership: ActiveMembershipSnapshot | null): boolean {
  if (!membership) return false
  const status = membership.status || (membership.active ? 'active' : 'inactive')
  return status === 'active'
}

export function isInviteNotRevoked(invite: UserInviteRow): boolean {
  return !invite.revoked_at && invite.status !== 'revoked'
}

export function isInviteStillValid(invite: UserInviteRow, now: Date): boolean {
  return (
    invite.status === 'pending' &&
    isInviteNotRevoked(invite) &&
    new Date(invite.expires_at) > now
  )
}

export function canShowResendAction(input: {
  hasActiveMembership: boolean
  hasInviteRecord: boolean
}): boolean {
  if (input.hasActiveMembership) return false
  return input.hasInviteRecord
}

export function resolveAuthReissueStrategy(
  authUser: ExistingAuthUser | null,
): { strategy: AuthReissueStrategy; reused: boolean } {
  if (!authUser) {
    return { strategy: 'invite_user_by_email', reused: false }
  }
  return { strategy: 'generate_invite_link', reused: true }
}

export function resolveRoleFromServerInvite(invite: UserInviteRow): CompanyRole | null {
  return isAllowedInviteRole(invite.role) ? invite.role : null
}

function sortInvites(invites: UserInviteRow[]): UserInviteRow[] {
  return [...invites].sort((a, b) => {
    const byExpiry =
      new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime()
    if (byExpiry !== 0) return byExpiry
    return a.id.localeCompare(b.id)
  })
}

export function selectReusableActiveInvite(
  invites: UserInviteRow[],
  now: Date,
): UserInviteRow | null {
  const active = sortInvites(invites.filter((invite) => isInviteStillValid(invite, now)))
  return active[0] ?? null
}

export function selectInvitesToRevoke(
  invites: UserInviteRow[],
  keepInviteId: string | null,
): UserInviteRow[] {
  return invites.filter(
    (invite) =>
      invite.id !== keepInviteId &&
      invite.status === 'pending' &&
      isInviteNotRevoked(invite),
  )
}

export function reconcileActivePendingInvites(
  invites: UserInviteRow[],
  now: Date,
): { keepId: string | null; revokeIds: string[] } {
  const active = sortInvites(invites.filter((invite) => isInviteStillValid(invite, now)))
  if (active.length <= 1) {
    return { keepId: active[0]?.id ?? null, revokeIds: [] }
  }
  const keep = active[0]
  return {
    keepId: keep.id,
    revokeIds: active.slice(1).map((invite) => invite.id),
  }
}

export function planResendInvite(input: {
  sourceInvite: UserInviteRow | null
  actorCompanyId: string
  isPlatformAdmin: boolean
  companyEmailInvites: UserInviteRow[]
  activeMembership: ActiveMembershipSnapshot | null
  authUser: ExistingAuthUser | null
  now?: Date
}): ResendInvitePlan {
  if (!input.sourceInvite) return { status: 'not_found' }

  const source = input.sourceInvite
  if (source.company_id !== input.actorCompanyId && !input.isPlatformAdmin) {
    return { status: 'forbidden_tenant' }
  }

  const email = normalizeInviteEmail(source.email)
  const role = resolveRoleFromServerInvite(source)
  if (!role) return { status: 'not_found' }

  if (isMembershipActive(input.activeMembership)) {
    return { status: 'already_member', email, role }
  }

  const now = input.now ?? new Date()
  const sameEmailInvites = input.companyEmailInvites.filter(
    (invite) =>
      invite.company_id === source.company_id &&
      normalizeInviteEmail(invite.email) === email,
  )
  const reusable = selectReusableActiveInvite(sameEmailInvites, now)
  const revokeInviteIds = selectInvitesToRevoke(sameEmailInvites, reusable?.id ?? null).map(
    (invite) => invite.id,
  )
  const auth = resolveAuthReissueStrategy(input.authUser)

  return {
    status: 'resend',
    email,
    role,
    companyId: source.company_id,
    keepInviteId: reusable?.id ?? null,
    createNewInvite: !reusable,
    revokeInviteIds,
    previousInvites: sameEmailInvites.map((invite) => ({
      id: invite.id,
      status: invite.status,
    })),
    authStrategy: auth.strategy,
    authUserReused: auth.reused,
  }
}

export function buildInviteDirectoryRows(input: {
  membershipEmails: Iterable<string>
  invites: UserInviteRow[]
  now?: Date
}): DirectoryInviteRow[] {
  const now = input.now ?? new Date()
  const memberEmails = new Set(
    [...input.membershipEmails].map((email) => normalizeInviteEmail(email)).filter(Boolean),
  )
  const byEmail = new Map<string, UserInviteRow[]>()

  for (const invite of input.invites) {
    if (!isInviteNotRevoked(invite)) continue
    if (invite.status !== 'pending' && invite.status !== 'expired') continue
    const email = normalizeInviteEmail(invite.email)
    if (!email || memberEmails.has(email)) continue
    const current = byEmail.get(email) ?? []
    current.push(invite)
    byEmail.set(email, current)
  }

  const rows: DirectoryInviteRow[] = []
  for (const [email, invites] of byEmail) {
    const representative = sortInvites(invites)[0]
    if (!representative) continue
    const valid = isInviteStillValid(representative, now)
    rows.push({
      id: representative.id,
      kind: 'invite',
      userId: '',
      inviteId: representative.id,
      role: representative.role,
      status: valid ? 'invited' : 'invite_expired',
      email,
      name: null,
      active: false,
      isPlatformAdmin: false,
      canResend: true,
      createdAt: representative.expires_at,
    })
  }

  return rows.sort((a, b) => a.email.localeCompare(b.email))
}

export function sanitizeResendAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const blocked = [
    'token',
    'action_link',
    'hashed_token',
    'email_otp',
    'password',
    'access_token',
    'refresh_token',
  ]
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (blocked.includes(key)) continue
    sanitized[key] = value
  }
  return sanitized
}

export function expectedActiveInviteCountAfterResend(): 1 {
  return 1
}

export type ResendInviteCommand = {
  inviteId: string
  actorUserId: string
  actorCompanyId: string
  isPlatformAdmin: boolean
  redirectTo: string
  now?: Date
}

export type ResendInviteOutcome =
  | {
      status: 'resent'
      httpStatus: 200
      inviteId: string
      email: string
      role: CompanyRole
      companyId: string
      authUserReused: boolean
      authUserDeleted: false
      createdNewInvite: boolean
      revokedInviteIds: string[]
      strategy: AuthReissueStrategy
    }
  | {
      status: 'already_member'
      httpStatus: 409
      email: string
      role: CompanyRole
    }
  | { status: 'forbidden_tenant'; httpStatus: 403 }
  | { status: 'not_found'; httpStatus: 404 }
  | {
      status: 'auth_failed'
      httpStatus: 502
      inviteId: string
      email: string
      role: CompanyRole
      message: string
    }

export type ResendInviteDeps = {
  loadInviteById: (id: string) => Promise<UserInviteRow | null>
  loadInvitesForCompanyEmail: (
    companyId: string,
    email: string,
  ) => Promise<UserInviteRow[]>
  loadActiveMembership: (
    companyId: string,
    email: string,
    authUserId: string | null,
  ) => Promise<ActiveMembershipSnapshot | null>
  findAuthUserByEmail: (email: string) => Promise<ExistingAuthUser | null>
  revokeInvites: (ids: string[], nowIso: string) => Promise<void>
  insertInvite: (input: {
    companyId: string
    email: string
    role: CompanyRole
    invitedBy: string
  }) => Promise<UserInviteRow>
  reissueAuthAccess: (input: {
    email: string
    role: CompanyRole
    companyId: string
    redirectTo: string
    strategy: 'invite_user_by_email' | 'generate_invite_link'
  }) => Promise<{ error: string | null; reused: boolean; deleted: false }>
  writeAudit: (event: {
    companyId: string
    actorUserId: string
    action: string
    entityType: string
    entityId: string
    metadata: Record<string, unknown>
  }) => Promise<void>
}

export async function executeResendInvite(
  command: ResendInviteCommand,
  deps: ResendInviteDeps,
): Promise<ResendInviteOutcome> {
  const now = command.now ?? new Date()
  const nowIso = now.toISOString()
  const source = await deps.loadInviteById(command.inviteId)
  const email = source ? normalizeInviteEmail(source.email) : ''
  const authUser = email ? await deps.findAuthUserByEmail(email) : null
  const companyInvites =
    source && email
      ? [...(await deps.loadInvitesForCompanyEmail(source.company_id, email))]
      : []
  const membership =
    source && email
      ? await deps.loadActiveMembership(source.company_id, email, authUser?.id ?? null)
      : null

  const plan = planResendInvite({
    sourceInvite: source,
    actorCompanyId: command.actorCompanyId,
    isPlatformAdmin: command.isPlatformAdmin,
    companyEmailInvites: companyInvites,
    activeMembership: membership,
    authUser,
    now,
  })

  if (plan.status === 'not_found') {
    return { status: 'not_found', httpStatus: 404 }
  }
  if (plan.status === 'forbidden_tenant') {
    return { status: 'forbidden_tenant', httpStatus: 403 }
  }
  if (plan.status === 'already_member') {
    await deps.writeAudit({
      companyId: source!.company_id,
      actorUserId: command.actorUserId,
      action: 'users.invite.resend',
      entityType: 'user_invites',
      entityId: command.inviteId,
      metadata: sanitizeResendAuditMetadata({
        result: 'already_member',
        email: plan.email,
        role: plan.role,
        previousInviteIds: companyInvites.map((invite) => invite.id),
      }),
    })
    return {
      status: 'already_member',
      httpStatus: 409,
      email: plan.email,
      role: plan.role,
    }
  }

  const extraValidIds = companyInvites
    .filter(
      (invite) =>
        plan.revokeInviteIds.includes(invite.id) && isInviteStillValid(invite, now),
    )
    .map((invite) => invite.id)
  const staleInviteIds = plan.revokeInviteIds.filter((id) => !extraValidIds.includes(id))

  if (extraValidIds.length > 0) {
    await deps.revokeInvites(extraValidIds, nowIso)
  }

  let currentInviteId = plan.keepInviteId
  let createdNewInvite = false
  if (plan.createNewInvite) {
    const created = await deps.insertInvite({
      companyId: plan.companyId,
      email: plan.email,
      role: plan.role,
      invitedBy: command.actorUserId,
    })
    currentInviteId = created.id
    createdNewInvite = true
    companyInvites.push(created)
  }

  const afterExtraRevoke = companyInvites.map((invite) =>
    extraValidIds.includes(invite.id)
      ? { ...invite, status: 'revoked', revoked_at: nowIso }
      : invite,
  )
  const reconcile = reconcileActivePendingInvites(afterExtraRevoke, now)
  if (reconcile.revokeIds.length > 0) {
    await deps.revokeInvites(reconcile.revokeIds, nowIso)
  }
  if (reconcile.keepId) currentInviteId = reconcile.keepId

  if (!currentInviteId) {
    return { status: 'not_found', httpStatus: 404 }
  }

  const auth = await deps.reissueAuthAccess({
    email: plan.email,
    role: plan.role,
    companyId: plan.companyId,
    redirectTo: command.redirectTo,
    strategy: plan.authStrategy,
  })

  if (auth.error) {
    if (createdNewInvite) {
      await deps.revokeInvites([currentInviteId], nowIso)
    }
    await deps.writeAudit({
      companyId: plan.companyId,
      actorUserId: command.actorUserId,
      action: 'users.invite.resend',
      entityType: 'user_invites',
      entityId: currentInviteId,
      metadata: sanitizeResendAuditMetadata({
        result: 'auth_failed',
        email: plan.email,
        role: plan.role,
        redirectTo: command.redirectTo,
        authUserReused: plan.authUserReused,
        authStrategy: plan.authStrategy,
        previousInviteIds: plan.previousInvites.map((invite) => invite.id),
        previousStatuses: plan.previousInvites.map((invite) => invite.status),
        newInviteId: createdNewInvite ? currentInviteId : null,
        inviteError: auth.error,
        inviteRevoked: createdNewInvite,
        authUserDeleted: false,
        expectedActiveInviteCount: expectedActiveInviteCountAfterResend(),
      }),
    })
    return {
      status: 'auth_failed',
      httpStatus: 502,
      inviteId: currentInviteId,
      email: plan.email,
      role: plan.role,
      message: auth.error,
    }
  }

  const revokedOnSuccess = [...new Set([...staleInviteIds, ...reconcile.revokeIds])]
  if (revokedOnSuccess.length > 0) {
    await deps.revokeInvites(revokedOnSuccess, nowIso)
  }

  await deps.writeAudit({
    companyId: plan.companyId,
    actorUserId: command.actorUserId,
    action: 'users.invite.resend',
    entityType: 'user_invites',
    entityId: currentInviteId,
    metadata: sanitizeResendAuditMetadata({
      result: 'resent',
      email: plan.email,
      role: plan.role,
      redirectTo: command.redirectTo,
      authUserReused: plan.authUserReused,
      authStrategy: plan.authStrategy,
      previousInviteIds: plan.previousInvites.map((invite) => invite.id),
      previousStatuses: plan.previousInvites.map((invite) => invite.status),
      newInviteId: createdNewInvite ? currentInviteId : null,
      reusedInviteId: createdNewInvite ? null : currentInviteId,
      revokedInviteIds: [...extraValidIds, ...revokedOnSuccess],
      authUserDeleted: false,
      expectedActiveInviteCount: expectedActiveInviteCountAfterResend(),
    }),
  })

  return {
    status: 'resent',
    httpStatus: 200,
    inviteId: currentInviteId,
    email: plan.email,
    role: plan.role,
    companyId: plan.companyId,
    authUserReused: plan.authUserReused,
    authUserDeleted: false,
    createdNewInvite,
    revokedInviteIds: [...extraValidIds, ...revokedOnSuccess],
    strategy: plan.authStrategy,
  }
}

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { REPORT_FILE, STATE_FILE } from './constants'

export type GateResult = 'PASS' | 'FAIL' | 'SKIP'

export type E2eReport = {
  canonicalBranch: string
  canonicalSha: string
  qaBranch: string
  qaHead: string
  pr: string

  qaUser1: string
  qaUser1Role: string
  qaUser2: string
  qaUser2Role: string

  inviteFlowQa1: GateResult
  inviteFlowQa2: GateResult
  emailDeliveryQa1: GateResult
  emailDeliveryQa2: GateResult
  inviteLinkQa1: GateResult
  inviteLinkQa2: GateResult
  authCallbackQa1: GateResult
  authCallbackQa2: GateResult

  authUserAssertionQa1: GateResult
  authUserAssertionQa2: GateResult
  appUserAssertionQa1: GateResult
  appUserAssertionQa2: GateResult
  membershipAssertionQa1: GateResult
  membershipAssertionQa2: GateResult
  roleAssertionQa1: GateResult
  roleAssertionQa2: GateResult

  logoutQa1: GateResult
  logoutQa2: GateResult
  reloginQa1: GateResult
  reloginQa2: GateResult
  protectedRouteGuardQa1: GateResult
  protectedRouteGuardQa2: GateResult
  companyContextQa1: GateResult
  companyContextQa2: GateResult
  roleContextQa1: GateResult
  roleContextQa2: GateResult

  forgotPasswordQa1: GateResult
  forgotPasswordQa2: GateResult
  resetEmailQa1: GateResult
  resetEmailQa2: GateResult
  passwordResetQa1: GateResult
  passwordResetQa2: GateResult
  oldPasswordRejectedQa1: GateResult
  oldPasswordRejectedQa2: GateResult
  newPasswordLoginQa1: GateResult
  newPasswordLoginQa2: GateResult

  resendInvite: GateResult
  actionablePendingCount: number | null
  staleInvitesReconciled: GateResult
  authUserReused: GateResult
  rolePreserved: GateResult

  emailHumanGateRequired: 'YES' | 'NO'
  humanGateRequired: 'YES' | 'NO'

  caioEmailSent: 'NO'
  daniEmailSent: 'NO'
  juninhoEmailSent: 'NO'
  caioDataTouched: 'NO'
  daniDataTouched: 'NO'
  juninhoDataTouched: 'NO'
  prodTouched: 'NO'

  findingsBlocker: string[]
  findingsHigh: string[]
  findingsMedium: string[]
  findingsLow: string[]
  findingsInfo: string[]

  readyForIndependentReview: 'YES' | 'NO'
}

export type RuntimeState = {
  runId: string
  adminSession?: {
    accessToken: string
    refreshToken: string
    userId: string
    cookieHeader: string
  }
  mailboxAvailable: boolean
  mailboxReason: string
  qaUser1?: {
    email: string
    role: string
    password: string
    newPassword?: string
    inviteId?: string
    inviteSince?: string
    resetSince?: string
  }
  qaUser2?: {
    email: string
    role: string
    password: string
    newPassword?: string
    inviteId?: string
    inviteSince?: string
    resetSince?: string
  }
  qaUserResend?: {
    email: string
    role: string
    password: string
    inviteId?: string
    inviteSince?: string
  }
  emailEvents: Array<{
    recipient: string
    purpose: string
    sentAt: string
    subject: string
    linkHost: string | null
    callbackPath: string | null
    deliveryEvidence: string
  }>
}

export function loadState(): RuntimeState {
  if (!existsSync(STATE_FILE)) {
    throw new Error(`Runtime state missing: ${STATE_FILE}`)
  }
  return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as RuntimeState
}

export function saveState(state: RuntimeState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

export function loadReport(): Partial<E2eReport> {
  if (!existsSync(REPORT_FILE)) return {}
  return JSON.parse(readFileSync(REPORT_FILE, 'utf8')) as Partial<E2eReport>
}

export function saveReport(report: Partial<E2eReport>): void {
  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2))
}

export function mergeReport(patch: Partial<E2eReport>): E2eReport {
  const current = loadReport()
  const merged = { ...current, ...patch } as E2eReport
  saveReport(merged)
  return merged
}

export function gate(pass: boolean): GateResult {
  return pass ? 'PASS' : 'FAIL'
}

export function formatFinalReport(report: E2eReport): string {
  const lines = [
    `CANONICAL_BRANCH=${report.canonicalBranch}`,
    `CANONICAL_SHA=${report.canonicalSha}`,
    '',
    `QA_BRANCH=${report.qaBranch}`,
    `QA_HEAD=${report.qaHead}`,
    `PR=${report.pr}`,
    '',
    `QA_USER_1=${report.qaUser1}`,
    `QA_USER_1_ROLE=${report.qaUser1Role}`,
    `QA_USER_2=${report.qaUser2}`,
    `QA_USER_2_ROLE=${report.qaUser2Role}`,
    '',
    `INVITE_FLOW_QA1=${report.inviteFlowQa1}`,
    `INVITE_FLOW_QA2=${report.inviteFlowQa2}`,
    '',
    `EMAIL_DELIVERY_QA1=${report.emailDeliveryQa1}`,
    `EMAIL_DELIVERY_QA2=${report.emailDeliveryQa2}`,
    '',
    `INVITE_LINK_QA1=${report.inviteLinkQa1}`,
    `INVITE_LINK_QA2=${report.inviteLinkQa2}`,
    '',
    `AUTH_CALLBACK_QA1=${report.authCallbackQa1}`,
    `AUTH_CALLBACK_QA2=${report.authCallbackQa2}`,
    '',
    `AUTH_USER_ASSERTION_QA1=${report.authUserAssertionQa1}`,
    `AUTH_USER_ASSERTION_QA2=${report.authUserAssertionQa2}`,
    '',
    `APP_USER_ASSERTION_QA1=${report.appUserAssertionQa1}`,
    `APP_USER_ASSERTION_QA2=${report.appUserAssertionQa2}`,
    '',
    `MEMBERSHIP_ASSERTION_QA1=${report.membershipAssertionQa1}`,
    `MEMBERSHIP_ASSERTION_QA2=${report.membershipAssertionQa2}`,
    '',
    `ROLE_ASSERTION_QA1=${report.roleAssertionQa1}`,
    `ROLE_ASSERTION_QA2=${report.roleAssertionQa2}`,
    '',
    `LOGOUT_QA1=${report.logoutQa1}`,
    `LOGOUT_QA2=${report.logoutQa2}`,
    '',
    `RELOGIN_QA1=${report.reloginQa1}`,
    `RELOGIN_QA2=${report.reloginQa2}`,
    '',
    `FORGOT_PASSWORD_QA1=${report.forgotPasswordQa1}`,
    `FORGOT_PASSWORD_QA2=${report.forgotPasswordQa2}`,
    '',
    `RESET_EMAIL_QA1=${report.resetEmailQa1}`,
    `RESET_EMAIL_QA2=${report.resetEmailQa2}`,
    '',
    `PASSWORD_RESET_QA1=${report.passwordResetQa1}`,
    `PASSWORD_RESET_QA2=${report.passwordResetQa2}`,
    '',
    `OLD_PASSWORD_REJECTED_QA1=${report.oldPasswordRejectedQa1}`,
    `OLD_PASSWORD_REJECTED_QA2=${report.oldPasswordRejectedQa2}`,
    '',
    `NEW_PASSWORD_LOGIN_QA1=${report.newPasswordLoginQa1}`,
    `NEW_PASSWORD_LOGIN_QA2=${report.newPasswordLoginQa2}`,
    '',
    `RESEND_INVITE=${report.resendInvite}`,
    `ACTIONABLE_PENDING_COUNT=${report.actionablePendingCount ?? ''}`,
    `STALE_INVITES_RECONCILED=${report.staleInvitesReconciled}`,
    `AUTH_USER_REUSED=${report.authUserReused}`,
    `ROLE_PRESERVED=${report.rolePreserved}`,
    '',
    `CAIO_EMAIL_SENT=${report.caioEmailSent}`,
    `DANI_EMAIL_SENT=${report.daniEmailSent}`,
    `JUNINHO_EMAIL_SENT=${report.juninhoEmailSent}`,
    '',
    `CAIO_DATA_TOUCHED=${report.caioDataTouched}`,
    `DANI_DATA_TOUCHED=${report.daniDataTouched}`,
    `JUNINHO_DATA_TOUCHED=${report.juninhoDataTouched}`,
    '',
    `PROD_TOUCHED=${report.prodTouched}`,
    '',
    `HUMAN_GATE_REQUIRED=${report.humanGateRequired}`,
    `EMAIL_HUMAN_GATE_REQUIRED=${report.emailHumanGateRequired}`,
    '',
    `FINDINGS_BLOCKER=${report.findingsBlocker.join('; ') || '(none)'}`,
    `FINDINGS_HIGH=${report.findingsHigh.join('; ') || '(none)'}`,
    `FINDINGS_MEDIUM=${report.findingsMedium.join('; ') || '(none)'}`,
    `FINDINGS_LOW=${report.findingsLow.join('; ') || '(none)'}`,
    `FINDINGS_INFO=${report.findingsInfo.join('; ') || '(none)'}`,
    '',
    `READY_FOR_INDEPENDENT_REVIEW=${report.readyForIndependentReview}`,
  ]
  return lines.join('\n')
}

export function computeReady(report: Partial<E2eReport>): 'YES' | 'NO' {
  const required: Array<GateResult | undefined> = [
    report.inviteFlowQa1,
    report.inviteFlowQa2,
    report.emailDeliveryQa1,
    report.emailDeliveryQa2,
    report.inviteLinkQa1,
    report.inviteLinkQa2,
    report.authCallbackQa1,
    report.authCallbackQa2,
    report.appUserAssertionQa1,
    report.appUserAssertionQa2,
    report.membershipAssertionQa1,
    report.membershipAssertionQa2,
    report.roleAssertionQa1,
    report.roleAssertionQa2,
    report.logoutQa1,
    report.logoutQa2,
    report.reloginQa1,
    report.reloginQa2,
    report.forgotPasswordQa1,
    report.forgotPasswordQa2,
    report.resetEmailQa1,
    report.resetEmailQa2,
    report.passwordResetQa1,
    report.passwordResetQa2,
    report.oldPasswordRejectedQa1,
    report.oldPasswordRejectedQa2,
    report.newPasswordLoginQa1,
    report.newPasswordLoginQa2,
    report.resendInvite,
  ]
  if (required.some((v) => v !== 'PASS')) return 'NO'
  if (report.emailHumanGateRequired === 'YES') return 'NO'
  return 'YES'
}

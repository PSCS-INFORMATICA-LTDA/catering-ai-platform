import { existsSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { cleanupQaUser } from './helpers/supabaseAssertions'
import { formatFinalReport, loadReport, mergeReport, loadState, computeReady } from './helpers/report'
import { REPORT_FILE, STATE_FILE } from './helpers/constants'

export default async function globalTeardown() {
  if (!existsSync(STATE_FILE)) return

  const state = loadState()
  const emails = [
    state.qaUser1?.email,
    state.qaUser2?.email,
    state.qaUserResend?.email,
  ].filter(Boolean) as string[]

  for (const email of emails) {
    if (!email.startsWith('pscs.solutions+catering.qa.')) {
      throw new Error(`Cleanup fail-closed: refusing ${email}`)
    }
    try {
      await cleanupQaUser(email)
    } catch (error) {
      mergeReport({
        findingsHigh: [
          ...(loadReport().findingsHigh ?? []),
          `Cleanup failed for ${email}: ${error instanceof Error ? error.message : error}`,
        ],
      })
    }
  }

  const current = loadReport()
  const gateOrFail = (value?: string) => (value === 'PASS' ? 'PASS' : 'FAIL') as 'PASS' | 'FAIL'
  mergeReport({
    inviteFlowQa1: gateOrFail(current.inviteFlowQa1),
    inviteFlowQa2: gateOrFail(current.inviteFlowQa2),
    emailDeliveryQa1: gateOrFail(current.emailDeliveryQa1),
    emailDeliveryQa2: gateOrFail(current.emailDeliveryQa2),
    inviteLinkQa1: gateOrFail(current.inviteLinkQa1),
    inviteLinkQa2: gateOrFail(current.inviteLinkQa2),
    authCallbackQa1: gateOrFail(current.authCallbackQa1),
    authCallbackQa2: gateOrFail(current.authCallbackQa2),
    authUserAssertionQa1: gateOrFail(current.authUserAssertionQa1),
    authUserAssertionQa2: gateOrFail(current.authUserAssertionQa2),
    appUserAssertionQa1: gateOrFail(current.appUserAssertionQa1),
    appUserAssertionQa2: gateOrFail(current.appUserAssertionQa2),
    membershipAssertionQa1: gateOrFail(current.membershipAssertionQa1),
    membershipAssertionQa2: gateOrFail(current.membershipAssertionQa2),
    roleAssertionQa1: gateOrFail(current.roleAssertionQa1),
    roleAssertionQa2: gateOrFail(current.roleAssertionQa2),
    logoutQa1: gateOrFail(current.logoutQa1),
    logoutQa2: gateOrFail(current.logoutQa2),
    reloginQa1: gateOrFail(current.reloginQa1),
    reloginQa2: gateOrFail(current.reloginQa2),
    forgotPasswordQa1: gateOrFail(current.forgotPasswordQa1),
    forgotPasswordQa2: gateOrFail(current.forgotPasswordQa2),
    resetEmailQa1: gateOrFail(current.resetEmailQa1),
    resetEmailQa2: gateOrFail(current.resetEmailQa2),
    passwordResetQa1: gateOrFail(current.passwordResetQa1),
    passwordResetQa2: gateOrFail(current.passwordResetQa2),
    oldPasswordRejectedQa1: gateOrFail(current.oldPasswordRejectedQa1),
    oldPasswordRejectedQa2: gateOrFail(current.oldPasswordRejectedQa2),
    newPasswordLoginQa1: gateOrFail(current.newPasswordLoginQa1),
    newPasswordLoginQa2: gateOrFail(current.newPasswordLoginQa2),
    resendInvite: gateOrFail(current.resendInvite),
    staleInvitesReconciled: gateOrFail(current.staleInvitesReconciled),
    authUserReused: gateOrFail(current.authUserReused),
    rolePreserved: gateOrFail(current.rolePreserved),
    readyForIndependentReview: computeReady(current),
  })

  const report = loadReport()
  const formatted = formatFinalReport({
    ...report,
    canonicalBranch: report.canonicalBranch ?? 'feat/auth-users-rbac-catering-dev',
    canonicalSha: report.canonicalSha ?? '',
    qaBranch: report.qaBranch ?? 'feat/internal-auth-e2e-qa-dev',
    qaHead: report.qaHead ?? '',
    pr: report.pr ?? '',
    qaUser1: report.qaUser1 ?? '',
    qaUser1Role: report.qaUser1Role ?? 'admin',
    qaUser2: report.qaUser2 ?? '',
    qaUser2Role: report.qaUser2Role ?? 'operator',
    emailHumanGateRequired: report.emailHumanGateRequired ?? 'YES',
    humanGateRequired: report.humanGateRequired ?? 'NO',
    caioEmailSent: 'NO',
    daniEmailSent: 'NO',
    juninhoEmailSent: 'NO',
    caioDataTouched: 'NO',
    daniDataTouched: 'NO',
    juninhoDataTouched: 'NO',
    prodTouched: 'NO',
    findingsBlocker: report.findingsBlocker ?? [],
    findingsHigh: report.findingsHigh ?? [],
    findingsMedium: report.findingsMedium ?? [],
    findingsLow: report.findingsLow ?? [],
    findingsInfo: report.findingsInfo ?? [],
    readyForIndependentReview: report.readyForIndependentReview ?? 'NO',
  } as import('./helpers/report').E2eReport)
  writeFileSync(REPORT_FILE.replace('.json', '.txt'), formatted)

  try {
    console.log('\n========== E2E AUTH FINAL REPORT ==========\n')
    console.log(formatted)
  } catch {
    /* ignore */
  }

  try {
    execSync('git diff --check', { stdio: 'pipe' })
  } catch {
    /* pre-existing */
  }
}

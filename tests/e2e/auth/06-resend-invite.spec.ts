import { test, expect } from '@playwright/test'
import { createInviteViaApi, resendInviteViaApi } from './helpers/authFlow'
import { assertResendInviteState } from './helpers/supabaseAssertions'
import { loadState, mergeReport, saveState, gate } from './helpers/report'

test.describe.serial('resend-invite', () => {
  test('resend invite reconciliation for QA_USER_RESEND', async ({ request }) => {
    const state = loadState()
    if (!state.mailboxAvailable) {
      mergeReport({
        resendInvite: 'FAIL',
        staleInvitesReconciled: 'FAIL',
        authUserReused: 'FAIL',
        rolePreserved: 'FAIL',
      })
      test.skip(true, 'email gate')
    }

    const since = new Date()
    const invite = await createInviteViaApi(
      request,
      state.adminSession!,
      state.qaUserResend!.email,
      state.qaUserResend!.role,
    )
    expect(invite.ok).toBeTruthy()
    state.qaUserResend!.inviteId = invite.inviteId
    state.qaUserResend!.inviteSince = since.toISOString()
    saveState(state)

    const resend = await resendInviteViaApi(
      request,
      state.adminSession!,
      invite.inviteId!,
    )
    expect(resend.ok, resend.error).toBeTruthy()

    const post = await assertResendInviteState(state.qaUserResend!.email)

    mergeReport({
      resendInvite: gate(resend.ok && post.actionablePendingCount === 1),
      actionablePendingCount: post.actionablePendingCount,
      staleInvitesReconciled: gate(post.staleReconciled && post.actionablePendingCount === 1),
      authUserReused: gate(post.authUserReused),
      rolePreserved: gate(post.rolePreserved),
    })

    expect(post.actionablePendingCount).toBe(1)
    expect(post.rolePreserved).toBeTruthy()
  })
})

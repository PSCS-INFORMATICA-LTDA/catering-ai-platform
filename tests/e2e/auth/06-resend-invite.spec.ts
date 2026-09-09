import { test, expect } from '@playwright/test'
import { createInviteViaApi, resendInviteViaApi } from './helpers/authFlow'
import { assertResendInviteState } from './helpers/supabaseAssertions'
import { loadReport, loadState, mergeReport, saveState, gate } from './helpers/report'

function addBlocker(message: string) {
  mergeReport({ findingsBlocker: [...(loadReport().findingsBlocker ?? []), message] })
}

test.describe.serial('resend-invite', () => {
  test('resend invite reconciliation for QA_USER_RESEND', async ({ request }) => {
    const state = loadState()
    const resume = process.env.QA_E2E_RESUME === '1'

    let inviteId = state.qaUserResend!.inviteId
    if (!(resume && inviteId)) {
      const since = new Date()
      const invite = await createInviteViaApi(
        request,
        state.adminSession!,
        state.qaUserResend!.email,
        state.qaUserResend!.role,
      )

      if (invite.smtpRateLimitBlocked) {
        mergeReport({
          smtpRateLimitBlocked: 'YES',
          humanGateRequired: 'YES',
          resendInvite: 'SKIP',
          staleInvitesReconciled: 'SKIP',
          authUserReused: 'SKIP',
          rolePreserved: 'SKIP',
        })
        addBlocker('Resend fixture invite blocked by Supabase Auth email rate limit; no retry performed')
        test.skip(true, 'Supabase Auth email rate limit')
      }

      expect(invite.ok, invite.error).toBeTruthy()
      if (!invite.inviteId) throw new Error('resend fixture invite succeeded without inviteId')
      inviteId = invite.inviteId
      state.qaUserResend!.inviteId = inviteId
      state.qaUserResend!.inviteSince = since.toISOString()
      saveState(state)
    }

    const resend = await resendInviteViaApi(request, state.adminSession!, inviteId!)
    if (resend.smtpRateLimitBlocked) {
      mergeReport({
        smtpRateLimitBlocked: 'YES',
        humanGateRequired: 'YES',
        resendInvite: 'SKIP',
        staleInvitesReconciled: 'SKIP',
        authUserReused: 'SKIP',
        rolePreserved: 'SKIP',
      })
      addBlocker('Resend action blocked by Supabase Auth email rate limit; no aggressive retry performed')
      test.skip(true, 'Supabase Auth email rate limit')
    }

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

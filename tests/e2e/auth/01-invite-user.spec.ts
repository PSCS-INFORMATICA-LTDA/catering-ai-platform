import { test, expect } from '@playwright/test'
import { createInviteViaApi, verifyInviteEmailSent } from './helpers/authFlow'
import { assertPreInvite } from './helpers/supabaseAssertions'
import { loadReport, loadState, mergeReport, saveState, gate } from './helpers/report'

test.describe.serial('invite-user', () => {
  test('QA_USER_1 admin invite via /api/users', async ({ request }) => {
    const state = loadState()
    expect(state.adminSession).toBeTruthy()
    expect(state.qaUser1).toBeTruthy()

    const since = new Date()
    const result = await createInviteViaApi(
      request,
      state.adminSession!,
      state.qaUser1!.email,
      state.qaUser1!.role,
    )

    const pre = await assertPreInvite(state.qaUser1!.email, state.qaUser1!.role)
    const emailSent = result.ok ? await verifyInviteEmailSent(state.qaUser1!.email) : false

    if (result.inviteId) {
      state.qaUser1!.inviteId = result.inviteId
      state.qaUser1!.inviteSince = since.toISOString()
      saveState(state)
    }

    const blockers = [...(loadReport().findingsBlocker ?? [])]
    if (!result.ok) {
      blockers.push(`QA1 invite API ${result.status}: ${result.error ?? 'unknown'}`)
    }

    mergeReport({
      inviteFlowQa1: gate(result.ok),
      emailDeliveryQa1: gate(result.ok && emailSent),
      findingsBlocker: blockers,
    })

    expect(result.ok, `invite failed: ${result.error} status=${result.status}`).toBeTruthy()
    expect(pre.inviteRole).toBe('admin')
  })

  test('QA_USER_2 operator invite via /api/users', async ({ request }) => {
    const state = loadState()
    const since = new Date()
    const result = await createInviteViaApi(
      request,
      state.adminSession!,
      state.qaUser2!.email,
      state.qaUser2!.role,
    )

    const pre = await assertPreInvite(state.qaUser2!.email, state.qaUser2!.role)
    const emailSent = result.ok ? await verifyInviteEmailSent(state.qaUser2!.email) : false

    if (result.inviteId) {
      state.qaUser2!.inviteId = result.inviteId
      state.qaUser2!.inviteSince = since.toISOString()
      saveState(state)
    }

    const blockers = [...(loadReport().findingsBlocker ?? [])]
    if (!result.ok) {
      blockers.push(`QA2 invite API ${result.status}: ${result.error ?? 'unknown'}`)
    }

    mergeReport({
      inviteFlowQa2: gate(result.ok),
      emailDeliveryQa2: gate(result.ok && emailSent),
      findingsBlocker: blockers,
    })

    expect(result.ok, `invite failed: ${result.error}`).toBeTruthy()
    expect(pre.inviteRole).toBe('operator')
  })
})

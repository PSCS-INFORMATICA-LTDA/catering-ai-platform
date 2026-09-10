import { test, expect } from '@playwright/test'
import { completeInviteFromEmail } from './helpers/authFlow'
import { assertPostInviteAcceptance } from './helpers/supabaseAssertions'
import { loadState, mergeReport, saveState, gate } from './helpers/report'

function requireMailboxOrSkip(
  state: ReturnType<typeof loadState>,
  user: 'qa1' | 'qa2',
) {
  if (state.mailboxAvailable) return
  mergeReport(
    user === 'qa1'
      ? {
          inviteLinkQa1: 'SKIP',
          authCallbackQa1: 'SKIP',
          authUserAssertionQa1: 'SKIP',
          appUserAssertionQa1: 'SKIP',
          membershipAssertionQa1: 'SKIP',
          roleAssertionQa1: 'SKIP',
          emailDeliveryQa1: 'SKIP',
          emailHumanGateRequired: 'YES',
          humanGateRequired: 'YES',
          emailGateResumable: 'YES',
        }
      : {
          inviteLinkQa2: 'SKIP',
          authCallbackQa2: 'SKIP',
          authUserAssertionQa2: 'SKIP',
          appUserAssertionQa2: 'SKIP',
          membershipAssertionQa2: 'SKIP',
          roleAssertionQa2: 'SKIP',
          emailDeliveryQa2: 'SKIP',
          emailHumanGateRequired: 'YES',
          humanGateRequired: 'YES',
          emailGateResumable: 'YES',
        },
  )
  test.skip(true, `${state.mailboxReason}. Supply real links, set QA_E2E_RESUME=1, and rerun without recreating invites.`)
}

function captureEmailEvent(state: ReturnType<typeof loadState>, event: NonNullable<Awaited<ReturnType<typeof completeInviteFromEmail>>['emailEvent']>) {
  state.emailEvents.push({
    recipient: event.recipient,
    purpose: event.purpose,
    sentAt: event.sentAt,
    subject: event.subject,
    linkHost: event.linkHost,
    callbackPath: event.callbackPath,
    deliveryEvidence: event.deliveryEvidence,
  })
  saveState(state)
}

test.describe.serial('accept-invite', () => {
  test('QA_USER_1 accepts invite via real email link', async ({ page }) => {
    const state = loadState()
    requireMailboxOrSkip(state, 'qa1')

    const since = new Date(state.qaUser1!.inviteSince ?? Date.now() - 300_000)
    const result = await completeInviteFromEmail(
      page,
      state.qaUser1!.email,
      state.qaUser1!.password,
      since,
    )

    if (result.emailEvent) captureEmailEvent(state, result.emailEvent)

    const assertions = await assertPostInviteAcceptance({
      key: 'QA_USER_1',
      email: state.qaUser1!.email,
      role: 'admin',
      password: state.qaUser1!.password,
    })

    mergeReport({
      inviteLinkQa1: gate(result.ok),
      authCallbackQa1: gate(result.ok && !page.url().includes('error=auth_callback')),
      emailDeliveryQa1: gate(Boolean(result.emailEvent)),
      authUserAssertionQa1: assertions.authUser,
      appUserAssertionQa1: assertions.appUser,
      membershipAssertionQa1: assertions.membership,
      roleAssertionQa1: assertions.role,
      emailHumanGateRequired: result.ok ? 'NO' : 'YES',
    })

    expect(result.ok, result.error).toBeTruthy()
    expect(assertions.authUser).toBe('PASS')
    expect(assertions.role).toBe('PASS')
  })

  test('QA_USER_2 accepts invite via real email link', async ({ page }) => {
    const state = loadState()
    requireMailboxOrSkip(state, 'qa2')

    const since = new Date(state.qaUser2!.inviteSince ?? Date.now() - 300_000)
    const result = await completeInviteFromEmail(
      page,
      state.qaUser2!.email,
      state.qaUser2!.password,
      since,
    )

    if (result.emailEvent) captureEmailEvent(state, result.emailEvent)

    const assertions = await assertPostInviteAcceptance({
      key: 'QA_USER_2',
      email: state.qaUser2!.email,
      role: 'operator',
      password: state.qaUser2!.password,
    })

    mergeReport({
      inviteLinkQa2: gate(result.ok),
      authCallbackQa2: gate(result.ok && !page.url().includes('error=auth_callback')),
      emailDeliveryQa2: gate(Boolean(result.emailEvent)),
      authUserAssertionQa2: assertions.authUser,
      appUserAssertionQa2: assertions.appUser,
      membershipAssertionQa2: assertions.membership,
      roleAssertionQa2: assertions.role,
      emailHumanGateRequired: result.ok ? 'NO' : 'YES',
    })

    expect(result.ok, result.error).toBeTruthy()
    expect(assertions.role).toBe('PASS')
  })
})

import { test, expect } from '@playwright/test'
import { completeInviteFromEmail } from './helpers/authFlow'
import { assertPostInviteAcceptance } from './helpers/supabaseAssertions'
import { loadState, mergeReport, saveState, gate } from './helpers/report'

test.describe.serial('accept-invite', () => {
  test('QA_USER_1 accepts invite via real email link', async ({ page }) => {
    const state = loadState()
    if (!state.mailboxAvailable) {
      mergeReport({
        inviteLinkQa1: 'FAIL',
        authCallbackQa1: 'FAIL',
        authUserAssertionQa1: 'FAIL',
        appUserAssertionQa1: 'FAIL',
        membershipAssertionQa1: 'FAIL',
        roleAssertionQa1: 'FAIL',
        emailDeliveryQa1: 'FAIL',
      })
      test.skip(true, state.mailboxReason)
    }

    const since = new Date(state.qaUser1!.inviteSince ?? Date.now() - 300_000)
    const result = await completeInviteFromEmail(
      page,
      state.qaUser1!.email,
      state.qaUser1!.password,
      since,
    )

    if (result.emailEvent) {
      state.emailEvents.push({
        recipient: result.emailEvent.recipient,
        purpose: result.emailEvent.purpose,
        sentAt: result.emailEvent.sentAt,
        subject: result.emailEvent.subject,
        linkHost: result.emailEvent.linkHost,
        callbackPath: result.emailEvent.callbackPath,
        deliveryEvidence: result.emailEvent.deliveryEvidence,
      })
      saveState(state)
    }

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
    })

    expect(result.ok, result.error).toBeTruthy()
    expect(assertions.authUser).toBe('PASS')
    expect(assertions.role).toBe('PASS')
  })

  test('QA_USER_2 accepts invite via real email link', async ({ page }) => {
    const state = loadState()
    if (!state.mailboxAvailable) {
      mergeReport({
        inviteLinkQa2: 'FAIL',
        authCallbackQa2: 'FAIL',
        authUserAssertionQa2: 'FAIL',
        appUserAssertionQa2: 'FAIL',
        membershipAssertionQa2: 'FAIL',
        roleAssertionQa2: 'FAIL',
        emailDeliveryQa2: 'FAIL',
      })
      test.skip(true, state.mailboxReason)
    }

    const since = new Date(state.qaUser2!.inviteSince ?? Date.now() - 300_000)
    const result = await completeInviteFromEmail(
      page,
      state.qaUser2!.email,
      state.qaUser2!.password,
      since,
    )

    if (result.emailEvent) {
      state.emailEvents.push({
        recipient: result.emailEvent.recipient,
        purpose: result.emailEvent.purpose,
        sentAt: result.emailEvent.sentAt,
        subject: result.emailEvent.subject,
        linkHost: result.emailEvent.linkHost,
        callbackPath: result.emailEvent.callbackPath,
        deliveryEvidence: result.emailEvent.deliveryEvidence,
      })
      saveState(state)
    }

    const assertions = await assertPostInviteAcceptance({
      key: 'QA_USER_2',
      email: state.qaUser2!.email,
      role: 'operator',
      password: state.qaUser2!.password,
    })

    mergeReport({
      inviteLinkQa2: gate(result.ok),
      authCallbackQa2: gate(result.ok),
      emailDeliveryQa2: gate(Boolean(result.emailEvent)),
      authUserAssertionQa2: assertions.authUser,
      appUserAssertionQa2: assertions.appUser,
      membershipAssertionQa2: assertions.membership,
      roleAssertionQa2: assertions.role,
    })

    expect(result.ok, result.error).toBeTruthy()
    expect(assertions.role).toBe('PASS')
  })
})

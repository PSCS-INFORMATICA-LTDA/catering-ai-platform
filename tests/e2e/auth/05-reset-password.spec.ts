import { test, expect } from '@playwright/test'
import {
  completePasswordResetFromEmail,
  loginViaUi,
  tryPasswordLogin,
} from './helpers/authFlow'
import { loadState, mergeReport, saveState, gate } from './helpers/report'

test.describe.serial('reset-password', () => {
  test('QA_USER_1 reset via email and password assertion', async ({ page }) => {
    const state = loadState()
    if (!state.mailboxAvailable) {
      mergeReport({
        passwordResetQa1: 'FAIL',
        oldPasswordRejectedQa1: 'FAIL',
        newPasswordLoginQa1: 'FAIL',
        resetEmailQa1: 'FAIL',
      })
      test.skip(true, 'email gate')
    }

    const since = new Date(state.qaUser1!.resetSince ?? Date.now() - 300_000)
    const newPassword = state.qaUser1!.newPassword!
    const result = await completePasswordResetFromEmail(
      page,
      state.qaUser1!.email,
      newPassword,
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

    const oldRejected = !(await tryPasswordLogin(state.qaUser1!.email, state.qaUser1!.password))
    const newWorks = await tryPasswordLogin(state.qaUser1!.email, newPassword)

    mergeReport({
      resetEmailQa1: gate(Boolean(result.emailEvent)),
      passwordResetQa1: gate(result.ok),
      oldPasswordRejectedQa1: gate(oldRejected),
      newPasswordLoginQa1: gate(newWorks),
    })

    expect(result.ok).toBeTruthy()
    expect(oldRejected).toBeTruthy()
    expect(newWorks).toBeTruthy()

    await loginViaUi(page, state.qaUser1!.email, newPassword)
    state.qaUser1!.password = newPassword
    saveState(state)
  })

  test('QA_USER_2 reset via email and password assertion', async ({ page }) => {
    const state = loadState()
    if (!state.mailboxAvailable) {
      mergeReport({
        passwordResetQa2: 'FAIL',
        oldPasswordRejectedQa2: 'FAIL',
        newPasswordLoginQa2: 'FAIL',
        resetEmailQa2: 'FAIL',
      })
      test.skip(true, 'email gate')
    }

    const since = new Date(state.qaUser2!.resetSince ?? Date.now() - 300_000)
    const newPassword = state.qaUser2!.newPassword!
    const result = await completePasswordResetFromEmail(
      page,
      state.qaUser2!.email,
      newPassword,
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

    const oldRejected = !(await tryPasswordLogin(state.qaUser2!.email, state.qaUser2!.password))
    const newWorks = await tryPasswordLogin(state.qaUser2!.email, newPassword)

    mergeReport({
      resetEmailQa2: gate(Boolean(result.emailEvent)),
      passwordResetQa2: gate(result.ok),
      oldPasswordRejectedQa2: gate(oldRejected),
      newPasswordLoginQa2: gate(newWorks),
    })

    expect(result.ok).toBeTruthy()
    expect(oldRejected).toBeTruthy()
    expect(newWorks).toBeTruthy()
  })
})

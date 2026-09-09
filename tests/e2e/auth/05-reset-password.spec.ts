import { test, expect } from '@playwright/test'
import {
  completePasswordResetFromEmail,
  loginViaUi,
  tryPasswordLogin,
} from './helpers/authFlow'
import { loadState, mergeReport, saveState, gate } from './helpers/report'

function skipForEmailGate(user: 'qa1' | 'qa2', reason: string) {
  mergeReport(
    user === 'qa1'
      ? {
          passwordResetQa1: 'SKIP',
          oldPasswordRejectedQa1: 'SKIP',
          newPasswordLoginQa1: 'SKIP',
          resetEmailQa1: 'SKIP',
          emailHumanGateRequired: 'YES',
          humanGateRequired: 'YES',
          emailGateResumable: 'YES',
        }
      : {
          passwordResetQa2: 'SKIP',
          oldPasswordRejectedQa2: 'SKIP',
          newPasswordLoginQa2: 'SKIP',
          resetEmailQa2: 'SKIP',
          emailHumanGateRequired: 'YES',
          humanGateRequired: 'YES',
          emailGateResumable: 'YES',
        },
  )
  test.skip(true, `${reason}. Supply the real reset link and rerun with QA_E2E_RESUME=1.`)
}

function recordEvent(state: ReturnType<typeof loadState>, event: NonNullable<Awaited<ReturnType<typeof completePasswordResetFromEmail>>['emailEvent']>) {
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

test.describe.serial('reset-password', () => {
  test('QA_USER_1 reset via email and password assertion', async ({ page }) => {
    const state = loadState()
    if (!state.mailboxAvailable) skipForEmailGate('qa1', state.mailboxReason)

    const since = new Date(state.qaUser1!.resetSince ?? Date.now() - 300_000)
    const newPassword = state.qaUser1!.newPassword!
    const result = await completePasswordResetFromEmail(
      page,
      state.qaUser1!.email,
      newPassword,
      since,
    )

    if (result.emailEvent) recordEvent(state, result.emailEvent)

    const oldRejected = result.ok
      ? !(await tryPasswordLogin(state.qaUser1!.email, state.qaUser1!.password))
      : false
    const newWorks = result.ok
      ? await tryPasswordLogin(state.qaUser1!.email, newPassword)
      : false

    mergeReport({
      resetEmailQa1: gate(Boolean(result.emailEvent)),
      passwordResetQa1: gate(result.ok),
      oldPasswordRejectedQa1: gate(oldRejected),
      newPasswordLoginQa1: gate(newWorks),
      emailHumanGateRequired: result.ok ? 'NO' : 'YES',
    })

    expect(result.ok, result.error).toBeTruthy()
    expect(oldRejected).toBeTruthy()
    expect(newWorks).toBeTruthy()

    await loginViaUi(page, state.qaUser1!.email, newPassword)
    state.qaUser1!.password = newPassword
    saveState(state)
  })

  test('QA_USER_2 reset via email and password assertion', async ({ page }) => {
    const state = loadState()
    if (!state.mailboxAvailable) skipForEmailGate('qa2', state.mailboxReason)

    const since = new Date(state.qaUser2!.resetSince ?? Date.now() - 300_000)
    const newPassword = state.qaUser2!.newPassword!
    const result = await completePasswordResetFromEmail(
      page,
      state.qaUser2!.email,
      newPassword,
      since,
    )

    if (result.emailEvent) recordEvent(state, result.emailEvent)

    const oldRejected = result.ok
      ? !(await tryPasswordLogin(state.qaUser2!.email, state.qaUser2!.password))
      : false
    const newWorks = result.ok
      ? await tryPasswordLogin(state.qaUser2!.email, newPassword)
      : false

    mergeReport({
      resetEmailQa2: gate(Boolean(result.emailEvent)),
      passwordResetQa2: gate(result.ok),
      oldPasswordRejectedQa2: gate(oldRejected),
      newPasswordLoginQa2: gate(newWorks),
      emailHumanGateRequired: result.ok ? 'NO' : 'YES',
    })

    expect(result.ok, result.error).toBeTruthy()
    expect(oldRejected).toBeTruthy()
    expect(newWorks).toBeTruthy()
  })
})

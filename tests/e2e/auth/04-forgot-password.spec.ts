import { test } from '@playwright/test'
import { logoutViaUi, triggerForgotPassword } from './helpers/authFlow'
import { loadState, mergeReport, saveState } from './helpers/report'

test.describe.serial('forgot-password', () => {
  test('QA_USER_1 forgot password flow', async ({ page }) => {
    const state = loadState()
    if (!state.mailboxAvailable) {
      mergeReport({ forgotPasswordQa1: 'FAIL', resetEmailQa1: 'FAIL' })
      test.skip(true, 'email gate')
    }

    await logoutViaUi(page)
    const since = new Date()
    await triggerForgotPassword(page, state.qaUser1!.email)
    state.qaUser1!.resetSince = since.toISOString()
    state.qaUser1!.newPassword = `QaE2e-New1-${state.runId}-Z9!`
    saveState(state)

    mergeReport({
      forgotPasswordQa1: 'PASS',
      resetEmailQa1: 'SKIP',
    })
  })

  test('QA_USER_2 forgot password flow', async ({ page }) => {
    const state = loadState()
    if (!state.mailboxAvailable) {
      mergeReport({ forgotPasswordQa2: 'FAIL', resetEmailQa2: 'FAIL' })
      test.skip(true, 'email gate')
    }

    await logoutViaUi(page)
    const since = new Date()
    await triggerForgotPassword(page, state.qaUser2!.email)
    state.qaUser2!.resetSince = since.toISOString()
    state.qaUser2!.newPassword = `QaE2e-New2-${state.runId}-Z9!`
    saveState(state)

    mergeReport({
      forgotPasswordQa2: 'PASS',
      resetEmailQa2: 'SKIP',
    })
  })
})

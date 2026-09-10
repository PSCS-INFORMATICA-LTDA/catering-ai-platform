import { test, expect } from '@playwright/test'
import { createInviteViaApi } from './helpers/authFlow'
import { assertPreInvite } from './helpers/supabaseAssertions'
import { loadReport, loadState, mergeReport, saveState, gate } from './helpers/report'

function withBlocker(message: string): string[] {
  return [...(loadReport().findingsBlocker ?? []), message]
}

async function runInvite(
  request: Parameters<typeof createInviteViaApi>[0],
  key: 'qaUser1' | 'qaUser2',
  expectedRole: 'admin' | 'operator',
) {
  const state = loadState()
  const identity = state[key]!
  const resume = process.env.QA_E2E_RESUME === '1'

  if (resume && identity.inviteId) {
    const pre = await assertPreInvite(identity.email, expectedRole)
    expect(pre.inviteRole).toBe(expectedRole)
    mergeReport(
      key === 'qaUser1'
        ? { inviteFlowQa1: 'PASS', emailDeliveryQa1: 'SKIP' }
        : { inviteFlowQa2: 'PASS', emailDeliveryQa2: 'SKIP' },
    )
    return
  }

  const since = new Date()
  const result = await createInviteViaApi(
    request,
    state.adminSession!,
    identity.email,
    identity.role,
  )

  if (result.smtpRateLimitBlocked) {
    mergeReport({
      smtpRateLimitBlocked: 'YES',
      humanGateRequired: 'YES',
      findingsBlocker: withBlocker(
        `${key} invite blocked by Supabase Auth email rate limit; no aggressive retry performed`,
      ),
    })
  }

  if (!result.ok) {
    mergeReport(
      key === 'qaUser1'
        ? {
            inviteFlowQa1: 'FAIL',
            emailDeliveryQa1: 'SKIP',
            findingsBlocker: withBlocker(
              `QA1 invite API ${result.status}: ${result.error ?? 'unknown'}`,
            ),
          }
        : {
            inviteFlowQa2: 'FAIL',
            emailDeliveryQa2: 'SKIP',
            findingsBlocker: withBlocker(
              `QA2 invite API ${result.status}: ${result.error ?? 'unknown'}`,
            ),
          },
    )
    expect(result.ok, `invite failed: ${result.error} status=${result.status}`).toBeTruthy()
    return
  }

  if (!result.inviteId) throw new Error(`${key} invite succeeded without inviteId`)
  identity.inviteId = result.inviteId
  identity.inviteSince = since.toISOString()
  saveState(state)

  const pre = await assertPreInvite(identity.email, expectedRole)
  mergeReport(
    key === 'qaUser1'
      ? { inviteFlowQa1: gate(result.ok), emailDeliveryQa1: 'SKIP' }
      : { inviteFlowQa2: gate(result.ok), emailDeliveryQa2: 'SKIP' },
  )

  expect(pre.inviteRole).toBe(expectedRole)
}

test.describe.serial('invite-user', () => {
  test('QA_USER_1 admin invite via /api/users', async ({ request }) => {
    await runInvite(request, 'qaUser1', 'admin')
  })

  test('QA_USER_2 operator invite via /api/users', async ({ request }) => {
    await runInvite(request, 'qaUser2', 'operator')
  })
})

import { test, expect } from '@playwright/test'
import {
  assertProtectedRouteBlocked,
  fetchMe,
  loginViaUi,
  logoutViaUi,
} from './helpers/authFlow'
import { CDL_DEV_COMPANY_ID } from './helpers/constants'
import { loadState, mergeReport, gate } from './helpers/report'

test.describe.serial('login-logout-relogin', () => {
  test('QA_USER_1 logout, guard, relogin, context', async ({ page, request }) => {
    const state = loadState()
    if (!state.mailboxAvailable) test.skip(true, 'email gate')

    await loginViaUi(page, state.qaUser1!.email, state.qaUser1!.password)

    const meBefore = await fetchMe(request, state.adminSession!.cookieHeader)
    void meBefore

    await logoutViaUi(page)
    const blocked = await assertProtectedRouteBlocked(page, '/quotes')

    await loginViaUi(page, state.qaUser1!.email, state.qaUser1!.password)
    await page.goto('/quotes')
    await expect(page).not.toHaveURL(/\/login/)

    const cookies = await page.context().cookies()
    const authCookie = cookies.find((c) => c.name.includes('auth-token'))
    expect(authCookie).toBeTruthy()

    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const me = await fetchMe(request, cookieHeader)
    const memberships = (me.json?.memberships as Array<{ companyId: string; role: string }>) ?? []
    const cdlMembership = memberships.find((m) => m.companyId === CDL_DEV_COMPANY_ID)

    mergeReport({
      logoutQa1: gate(blocked),
      reloginQa1: gate(me.ok),
      protectedRouteGuardQa1: gate(blocked),
      companyContextQa1: gate(Boolean(cdlMembership)),
      roleContextQa1: gate(cdlMembership?.role === 'admin'),
    })

    expect(blocked).toBeTruthy()
    expect(me.ok).toBeTruthy()
    expect(cdlMembership?.role).toBe('admin')
  })

  test('QA_USER_2 logout, guard, relogin, context', async ({ page, request }) => {
    const state = loadState()
    if (!state.mailboxAvailable) test.skip(true, 'email gate')

    await loginViaUi(page, state.qaUser2!.email, state.qaUser2!.password)
    await logoutViaUi(page)
    const blocked = await assertProtectedRouteBlocked(page, '/quotes')
    await loginViaUi(page, state.qaUser2!.email, state.qaUser2!.password)

    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const me = await fetchMe(request, cookieHeader)
    const memberships = (me.json?.memberships as Array<{ companyId: string; role: string }>) ?? []
    const cdlMembership = memberships.find((m) => m.companyId === CDL_DEV_COMPANY_ID)

    mergeReport({
      logoutQa2: gate(blocked),
      reloginQa2: gate(me.ok),
      protectedRouteGuardQa2: gate(blocked),
      companyContextQa2: gate(Boolean(cdlMembership)),
      roleContextQa2: gate(cdlMembership?.role === 'operator'),
    })

    expect(cdlMembership?.role).toBe('operator')
  })
})

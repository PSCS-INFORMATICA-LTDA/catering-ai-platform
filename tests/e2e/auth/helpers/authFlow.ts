import type { APIRequestContext, Page } from '@playwright/test'
import { CANONICAL_DEV_URL } from './constants'
import { findAuthUserByEmail } from './supabaseAssertions'
import type { EmailEvent } from './mailbox'
import { waitForEmailLink } from './mailbox'

export type AdminSession = {
  accessToken: string
  refreshToken: string
  userId: string
  cookieHeader: string
}

export type InviteApiResult = {
  ok: boolean
  status: number
  inviteId?: string
  error?: string
  smtpRateLimitBlocked: boolean
}

function supabaseCookiePayload(session: {
  access_token: string
  refresh_token: string
  expires_in?: number
  expires_at?: number
}) {
  return JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: 'bearer',
    expires_in: session.expires_in ?? 3600,
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
  })
}

export function isEmailRateLimitError(value: unknown): boolean {
  const text = value instanceof Error ? value.message : String(value ?? '')
  return /email\s+rate\s+limit|rate\s+limit\s+exceeded|too\s+many\s+(emails|requests)/i.test(text)
}

export function buildSupabaseCookieHeader(
  accessToken: string,
  refreshToken: string,
  expiresAt?: number,
): string {
  const ref = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
    /https:\/\/([a-z0-9]+)\.supabase\.co/,
  )?.[1]
  if (!ref) throw new Error('Cannot derive Supabase project ref')
  const name = `sb-${ref}-auth-token`
  const value = encodeURIComponent(
    supabaseCookiePayload({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    }),
  )
  return `${name}=${value}`
}

export async function adminSignIn(): Promise<AdminSession> {
  const email = process.env.CATERING_DEV_LOGIN_EMAIL?.trim()
  const password = process.env.CATERING_DEV_LOGIN_PASSWORD?.trim()
  if (!email || !password) {
    throw new Error('CATERING_DEV_LOGIN_EMAIL and CATERING_DEV_LOGIN_PASSWORD required')
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anon,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  const json = (await res.json()) as {
    access_token?: string
    refresh_token?: string
    user?: { id: string }
    error_description?: string
    msg?: string
  }

  if (!res.ok || !json.access_token || !json.refresh_token || !json.user?.id) {
    throw new Error(`Admin sign-in failed: ${json.error_description ?? json.msg ?? res.status}`)
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    userId: json.user.id,
    cookieHeader: buildSupabaseCookieHeader(json.access_token, json.refresh_token),
  }
}

export async function createInviteViaApi(
  request: APIRequestContext,
  session: AdminSession,
  email: string,
  role: string,
): Promise<InviteApiResult> {
  const res = await request.post(`${CANONICAL_DEV_URL}/api/users`, {
    headers: {
      Cookie: session.cookieHeader,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    data: { email, role },
  })

  const json = (await res.json().catch(() => ({}))) as {
    data?: { id?: string }
    error?: string
    inviteId?: string
    message?: string
  }
  const error = json.error ?? json.message

  return {
    ok: res.ok(),
    status: res.status(),
    inviteId: json.data?.id ?? json.inviteId,
    error,
    smtpRateLimitBlocked: isEmailRateLimitError(error),
  }
}

export async function resendInviteViaApi(
  request: APIRequestContext,
  session: AdminSession,
  inviteId: string,
): Promise<InviteApiResult> {
  const res = await request.post(`${CANONICAL_DEV_URL}/api/users/resend`, {
    headers: {
      Cookie: session.cookieHeader,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    data: { inviteId },
  })
  const json = (await res.json().catch(() => ({}))) as {
    error?: string
    message?: string
    inviteId?: string
    data?: { id?: string }
  }
  const error = json.error ?? json.message
  return {
    ok: res.ok(),
    status: res.status(),
    inviteId: json.data?.id ?? json.inviteId,
    error,
    smtpRateLimitBlocked: isEmailRateLimitError(error),
  }
}

export async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${CANONICAL_DEV_URL}/login`)
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/(quotes|profile|users)/, { timeout: 30_000 })
}

export async function logoutViaUi(page: Page): Promise<void> {
  const res = await page.request.post(`${CANONICAL_DEV_URL}/api/auth/logout`, {
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok()) await page.context().clearCookies()
  await page.goto(`${CANONICAL_DEV_URL}/login`)
}

export async function assertProtectedRouteBlocked(page: Page, path: string): Promise<boolean> {
  await page.goto(`${CANONICAL_DEV_URL}${path}`)
  await page.waitForTimeout(1500)
  return page.url().includes('/login')
}

export async function fetchMe(
  request: APIRequestContext,
  cookieHeader: string,
  accessToken?: string,
): Promise<{ ok: boolean; status: number; json?: Record<string, unknown> }> {
  const headers: Record<string, string> = { Cookie: cookieHeader }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const res = await request.get(`${CANONICAL_DEV_URL}/api/auth/me`, { headers })
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
  return { ok: res.ok(), status: res.status(), json: json ?? undefined }
}

export async function completeInviteFromEmail(
  page: Page,
  email: string,
  password: string,
  since: Date,
): Promise<{ ok: boolean; emailEvent?: EmailEvent; error?: string }> {
  const lookup = await waitForEmailLink({ recipient: email, purpose: 'invite', since })
  if (!lookup) return { ok: false, error: 'invite email/link not available from configured mailbox provider' }

  await page.goto(lookup.rawLink)
  await page.waitForURL(/\/(auth\/callback|login|quotes|set-password|invite)/, {
    timeout: 60_000,
  })

  const passwordField = page.locator('input[type="password"]').first()
  if (await passwordField.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await passwordField.fill(password)
    const confirm = page.locator('input[type="password"]').nth(1)
    if (await confirm.isVisible().catch(() => false)) await confirm.fill(password)
    await page.locator('button[type="submit"]').click()
  }

  await page.waitForURL(/\/(quotes|auth\/callback)/, { timeout: 60_000 }).catch(() => undefined)
  if (page.url().includes('/auth/callback')) {
    await page.waitForURL(/\/quotes/, { timeout: 30_000 })
  }

  const auth = await findAuthUserByEmail(email)
  if (!auth?.email_confirmed_at) {
    return {
      ok: false,
      emailEvent: lookup.event,
      error: 'auth user not confirmed after invite',
    }
  }

  return { ok: true, emailEvent: lookup.event }
}

export async function triggerForgotPassword(page: Page, email: string): Promise<void> {
  await page.goto(`${CANONICAL_DEV_URL}/auth/forgot-password`)
  await page.locator('input[type="email"]').fill(email)
  await page.locator('button[type="submit"]').click()
  await page.waitForTimeout(2000)
}

export async function completePasswordResetFromEmail(
  page: Page,
  email: string,
  newPassword: string,
  since: Date,
): Promise<{ ok: boolean; emailEvent?: EmailEvent; error?: string }> {
  const lookup = await waitForEmailLink({ recipient: email, purpose: 'reset', since })
  if (!lookup) return { ok: false, error: 'reset email/link not available from configured mailbox provider' }

  await page.goto(lookup.rawLink)
  await page.waitForURL(/\/(auth\/reset-password|auth\/callback)/, { timeout: 60_000 })
  if (page.url().includes('/auth/callback')) {
    await page.waitForURL(/\/auth\/reset-password/, { timeout: 30_000 })
  }

  const fields = page.locator('input[type="password"]')
  await fields.first().fill(newPassword)
  const confirm = fields.nth(1)
  if (await confirm.isVisible().catch(() => false)) await confirm.fill(newPassword)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/login/, { timeout: 30_000 })

  return { ok: true, emailEvent: lookup.event }
}

export async function tryPasswordLogin(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return res.ok
}

export async function verifyInviteRequestPersisted(email: string): Promise<boolean> {
  const auth = await findAuthUserByEmail(email)
  return Boolean(auth?.invited_at || auth?.confirmation_sent_at)
}

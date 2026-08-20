import 'server-only'

import type { NextRequest } from 'next/server'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import {
  resolvePublicQuoteTenant,
  resolvePublicQuoteTenantByCompanyId,
  type ResolvedPublicQuoteTenant,
} from './bootstrap'
import {
  createPublicSessionToken,
  PUBLIC_QUOTE_COOKIE,
  PUBLIC_QUOTE_SESSION_TTL_SECONDS,
  PublicQuoteHttpError,
  requestFingerprint,
  sha256,
} from './security'
import type {
  PublicQuoteIntakeSession,
  PublicQuoteLocale,
} from './types'
import { sanitizePublicQuoteDraft } from './validation'

const SESSION_SELECT = [
  'id',
  'company_id',
  'locale',
  'token_hash',
  'draft',
  'current_step',
  'status',
  'expires_at',
  'revoked_at',
  'quote_id',
  'idempotency_key_hash',
  'submission_hash',
  'consent_at',
  'consent_version',
  'created_at',
  'updated_at',
].join(', ')

export type PublicQuoteSessionView = {
  draft: Record<string, unknown>
  currentStep: number
  expiresAt: string
}

function toSession(value: unknown): PublicQuoteIntakeSession | null {
  return value && typeof value === 'object'
    ? (value as PublicQuoteIntakeSession)
    : null
}

export function publicSessionView(
  session: PublicQuoteIntakeSession,
): PublicQuoteSessionView {
  return {
    draft: session.draft,
    currentStep: session.current_step,
    expiresAt: session.expires_at,
  }
}

export async function consumePublicQuoteRateLimit(
  request: NextRequest,
  companyId: string,
  action: 'session' | 'autosave' | 'preview' | 'upload' | 'submit',
  limit: number,
  windowSeconds: number,
) {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase.rpc(
    'consume_public_quote_rate_limit',
    {
      p_company_id: companyId,
      p_fingerprint: requestFingerprint(request),
      p_action: action,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    },
  )
  if (error) throw new PublicQuoteHttpError(500, 'server_error')
  if (data !== true) throw new PublicQuoteHttpError(429, 'rate_limited')
}

async function findSessionByTokenHash(tokenHash: string) {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('public_quote_intake_sessions')
    .select(SESSION_SELECT)
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (error) throw new PublicQuoteHttpError(500, 'server_error')
  return toSession(data)
}

async function expireSession(sessionId: string) {
  const supabase = getSupabaseServerClient()
  await supabase
    .from('public_quote_intake_sessions')
    .update({ status: 'expired' })
    .eq('id', sessionId)
    .in('status', ['active', 'submitting'])
}

export async function loadPublicQuoteSession(
  request: NextRequest,
  options: { allowSubmitted?: boolean } = {},
): Promise<PublicQuoteIntakeSession> {
  const token = request.cookies.get(PUBLIC_QUOTE_COOKIE)?.value?.trim()
  if (!token || token.length < 40 || token.length > 100) {
    throw new PublicQuoteHttpError(404, 'not_found')
  }
  const session = await findSessionByTokenHash(sha256(token))
  if (!session || session.revoked_at) {
    throw new PublicQuoteHttpError(404, 'not_found')
  }
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await expireSession(session.id)
    throw new PublicQuoteHttpError(410, 'expired')
  }
  if (session.status === 'submitted' && options.allowSubmitted) return session
  if (session.status !== 'active') {
    throw new PublicQuoteHttpError(409, 'conflict')
  }
  return session
}

export async function loadPublicQuoteSessionTenant(
  session: PublicQuoteIntakeSession,
): Promise<ResolvedPublicQuoteTenant> {
  const tenant = await resolvePublicQuoteTenantByCompanyId(
    session.company_id,
    session.locale,
  )
  if (!tenant) throw new PublicQuoteHttpError(404, 'not_found')
  return tenant
}

async function resumeMatchingSession(
  request: NextRequest,
  companyId: string,
  locale: PublicQuoteLocale,
) {
  try {
    const session = await loadPublicQuoteSession(request)
    if (session.company_id !== companyId) return null
    if (session.locale === locale) return session

    // Same tenant cookie, different public locale (PT/EN/ES). Keep the draft
    // and step so the language switcher does not wipe an in-progress quote.
    const draft = sanitizePublicQuoteDraft({
      ...(session.draft && typeof session.draft === 'object'
        ? (session.draft as Record<string, unknown>)
        : {}),
      locale,
    })
    const supabase = getSupabaseServerClient()
    const { data, error } = await supabase
      .from('public_quote_intake_sessions')
      .update({ locale, draft })
      .eq('id', session.id)
      .eq('status', 'active')
      .select(SESSION_SELECT)
      .single()
    if (error || !data) return session
    return toSession(data) as PublicQuoteIntakeSession
  } catch (error) {
    if (error instanceof PublicQuoteHttpError && error.status < 500) return null
    throw error
  }
}

export async function beginPublicQuoteSession(
  request: NextRequest,
  companySlug: string,
  locale: string,
  options: { forceNew?: boolean } = {},
): Promise<{
  session: PublicQuoteIntakeSession
  token: string | null
  expiresAt: Date
}> {
  const tenant = await resolvePublicQuoteTenant(companySlug, locale)
  if (!tenant) throw new PublicQuoteHttpError(404, 'not_found')

  await consumePublicQuoteRateLimit(
    request,
    tenant.company.id,
    'session',
    20,
    60 * 60,
  )

  const resumed = options.forceNew
    ? null
    : await resumeMatchingSession(
        request,
        tenant.company.id,
        tenant.locale,
      )
  if (resumed) {
    return {
      session: resumed,
      token: null,
      expiresAt: new Date(resumed.expires_at),
    }
  }

  const token = createPublicSessionToken()
  const expiresAt = new Date(
    Date.now() + PUBLIC_QUOTE_SESSION_TTL_SECONDS * 1000,
  )
  const initialDraft = sanitizePublicQuoteDraft({ locale: tenant.locale })
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('public_quote_intake_sessions')
    .insert({
      company_id: tenant.company.id,
      locale: tenant.locale,
      token_hash: sha256(token),
      draft: initialDraft,
      current_step: 0,
      status: 'active',
      expires_at: expiresAt.toISOString(),
    })
    .select(SESSION_SELECT)
    .single()
  if (error || !data) throw new PublicQuoteHttpError(500, 'server_error')

  return {
    session: toSession(data) as PublicQuoteIntakeSession,
    token,
    expiresAt,
  }
}

export async function savePublicQuoteSession(
  request: NextRequest,
  draftValue: unknown,
  currentStepValue: unknown,
) {
  const session = await loadPublicQuoteSession(request)
  await loadPublicQuoteSessionTenant(session)
  await consumePublicQuoteRateLimit(
    request,
    session.company_id,
    'autosave',
    180,
    60 * 60,
  )

  const draft = sanitizePublicQuoteDraft(draftValue)
  draft.locale = session.locale
  const parsedStep = Number(currentStepValue)
  const currentStep = Number.isFinite(parsedStep)
    ? Math.min(5, Math.max(0, Math.floor(parsedStep)))
    : session.current_step

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('public_quote_intake_sessions')
    .update({ draft, current_step: currentStep })
    .eq('id', session.id)
    .eq('status', 'active')
    .select(SESSION_SELECT)
    .single()
  if (error || !data) throw new PublicQuoteHttpError(409, 'conflict')
  return toSession(data) as PublicQuoteIntakeSession
}

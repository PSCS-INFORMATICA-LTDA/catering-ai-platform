import { NextRequest, NextResponse } from 'next/server'
import {
  assertHoneypot,
  assertRequestOrigin,
  publicErrorResponse,
  readLimitedJson,
  setPublicSessionCookie,
} from '@/Lib/publicQuote/security'
import {
  beginPublicQuoteSession,
  publicSessionView,
  savePublicQuoteSession,
} from '@/Lib/publicQuote/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }

function errorResponse(error: unknown) {
  const result = publicErrorResponse(error)
  return NextResponse.json(result.body, {
    status: result.status,
    headers: NO_STORE,
  })
}

export async function POST(request: NextRequest) {
  try {
    assertRequestOrigin(request)
    const body = await readLimitedJson<{
      companySlug?: unknown
      locale?: unknown
      website?: unknown
      forceNew?: unknown
    }>(request)
    assertHoneypot(body?.website)
    const started = await beginPublicQuoteSession(
      request,
      typeof body?.companySlug === 'string' ? body.companySlug : '',
      typeof body?.locale === 'string' ? body.locale : '',
      { forceNew: body?.forceNew === true },
    )
    const response = NextResponse.json(
      { session: publicSessionView(started.session) },
      { headers: NO_STORE },
    )
    if (started.token) {
      setPublicSessionCookie(response, started.token, started.expiresAt)
    }
    return response
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    assertRequestOrigin(request)
    const body = await readLimitedJson<{
      draft?: unknown
      currentStep?: unknown
      website?: unknown
    }>(request)
    assertHoneypot(body?.website)
    const session = await savePublicQuoteSession(
      request,
      body?.draft,
      body?.currentStep,
    )
    return NextResponse.json(
      { session: publicSessionView(session) },
      { headers: NO_STORE },
    )
  } catch (error) {
    return errorResponse(error)
  }
}

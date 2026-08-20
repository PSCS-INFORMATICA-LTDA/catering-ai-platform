import { NextRequest, NextResponse } from 'next/server'
import { PscsOneCompanyService } from '@/Lib/pscs-one/companyService'
import {
  isPscsOneSsoEnabled,
  PSCS_ONE_MAPPED_COMPANY_COOKIE,
  pscsOneCallbackUri,
} from '@/Lib/pscs-one/config'
import { describeSsoError, publicPscsOneSsoReason } from '@/Lib/pscs-one/errors'
import { PscsOneIdentityService } from '@/Lib/pscs-one/identityService'
import { PscsOneSessionAdapter } from '@/Lib/pscs-one/sessionAdapter'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function loginDenied(request: NextRequest, reason: string) {
  const url = new URL('/login', request.nextUrl.origin)
  url.searchParams.set('pscs_one', 'denied')
  url.searchParams.set('reason', reason)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  if (!isPscsOneSsoEnabled()) {
    return loginDenied(request, 'sso_disabled')
  }

  const code = request.nextUrl.searchParams.get('code')?.trim()
  if (!code) {
    return loginDenied(request, 'missing_code')
  }

  try {
    const identity = await PscsOneIdentityService.exchangeAuthorizationCode(code)
    const local = await PscsOneSessionAdapter.ensureLocalUser(identity)
    await PscsOneCompanyService.ensureMembership(local.authUserId, identity.external_company_id)

    const dest = new URL('/quotes', request.nextUrl.origin)
    const response = NextResponse.redirect(dest)
    await PscsOneSessionAdapter.attachSessionCookie(request, response, local.tokenHash)
    response.cookies.set(PSCS_ONE_MAPPED_COMPANY_COOKIE, identity.external_company_id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 8,
    })
    return response
  } catch (error) {
    const safe = publicPscsOneSsoReason(error)
    console.error('pscs_one.callback_denied', { reason: safe, ...describeSsoError(error) })
    return loginDenied(request, safe)
  }
}

export async function POST() {
  return NextResponse.json({ error: 'method_not_allowed', redirect_uri: pscsOneCallbackUri() }, { status: 405 })
}

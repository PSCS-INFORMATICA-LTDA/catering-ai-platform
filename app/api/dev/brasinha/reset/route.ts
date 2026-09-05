import { NextResponse } from 'next/server'
import {
  rejectSpoofedCompanyId,
  requireApiAuth,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { assertBrasinhaDevRuntime } from '@/Lib/brasinha/env'

export const dynamic = 'force-dynamic'

/** Starts a new conversation pointer. Does not delete persisted history. */
export async function POST(request: Request) {
  try {
    assertBrasinhaDevRuntime()
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const auth = await requireApiAuth()
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const spoof = rejectSpoofedCompanyId(auth.session, body.companyId)
  if (spoof) return spoof

  const companyId = resolveAuthorizedCompanyId(auth.session)
  return NextResponse.json({
    ok: true,
    companyId,
    deleted: false,
    conversationId: null,
  })
}

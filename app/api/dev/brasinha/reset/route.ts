import { NextResponse } from 'next/server'
import {
  rejectSpoofedCompanyId,
  requireApiAuth,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { assertBrasinhaDevRuntime } from '@/Lib/brasinha/env'
import { brasinhaMemoryStore } from '@/Lib/brasinha/store/memoryConversationStore'

export const dynamic = 'force-dynamic'

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
  const conversationId =
    typeof body.conversationId === 'string' ? body.conversationId : ''
  if (conversationId) {
    brasinhaMemoryStore.reset(companyId, conversationId)
  }
  return NextResponse.json({ ok: true, companyId })
}

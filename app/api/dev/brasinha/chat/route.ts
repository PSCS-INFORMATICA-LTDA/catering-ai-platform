import { NextResponse } from 'next/server'
import {
  rejectSpoofedCompanyId,
  requireApiAuth,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { assertBrasinhaDevRuntime } from '@/Lib/brasinha/env'
import { runBrasinhaTurn } from '@/Lib/brasinha/core/runTurn'
import { brasinhaMemoryStore } from '@/Lib/brasinha/store/memoryConversationStore'
import { createCanonicalCatalogPort } from '@/Lib/brasinha/tools/canonicalPort'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    assertBrasinhaDevRuntime()
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const auth = await requireApiAuth()
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const spoof = rejectSpoofedCompanyId(auth.session, body?.companyId)
  if (spoof) return spoof

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) {
    return NextResponse.json({ error: 'text_required' }, { status: 400 })
  }

  const result = await runBrasinhaTurn({
    inbound: {
      channel: 'dev_simulator',
      companyId,
      conversationId:
        typeof body?.conversationId === 'string' ? body.conversationId : null,
      externalContactRef: auth.session.email ?? 'dev-user',
      text,
    },
    store: brasinhaMemoryStore,
    catalog: createCanonicalCatalogPort(),
  })

  return NextResponse.json({
    conversationId: result.conversation.id,
    companyId: result.conversation.companyId,
    language: result.detectedLanguage,
    handoffStatus: result.conversation.handoffStatus,
    handoffReason: result.conversation.handoffReason,
    toolsCalled: result.toolsCalled,
    traces: result.traces,
    reply: result.reply.text,
    messages: brasinhaMemoryStore.listMessages(companyId, result.conversation.id),
  })
}

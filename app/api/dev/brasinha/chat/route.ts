import { NextResponse } from 'next/server'
import {
  rejectSpoofedCompanyId,
  requireApiAuth,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { resolveBrasinhaReasoner } from '@/Lib/brasinha/core/registry'
import { runBrasinhaTurn } from '@/Lib/brasinha/core/runTurn'
import { assertBrasinhaDevRuntime } from '@/Lib/brasinha/env'
import { createSupabaseConversationStore } from '@/Lib/brasinha/store/supabaseConversationStore'
import { COMPANY_SCOPE_VIOLATION } from '@/Lib/brasinha/store/types'
import { createCanonicalCatalogPort } from '@/Lib/brasinha/tools/canonicalPort'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

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

  const store = createSupabaseConversationStore(getSupabaseServerClient())
  try {
    const result = await runBrasinhaTurn({
      inbound: {
        channel: 'dev_simulator',
        companyId,
        conversationId:
          typeof body?.conversationId === 'string' ? body.conversationId : null,
        externalContactRef: auth.session.email ?? 'dev-user',
        text,
      },
      store,
      catalog: createCanonicalCatalogPort(),
      reasoner: resolveBrasinhaReasoner(),
    })
    const messages = (await store.listMessages(companyId, result.conversation.id)).filter(
      (row) => row.role === 'customer' || row.role === 'assistant',
    )
    return NextResponse.json({
      conversationId: result.conversation.id,
      companyId: result.conversation.companyId,
      language: result.detectedLanguage,
      handoffStatus: result.conversation.handoffStatus,
      handoffReason: result.conversation.handoffReason,
      toolsCalled: result.toolsCalled,
      traces: result.traces,
      reply: result.reply.text,
      reasonerKind: result.reasonerKind,
      reasonerModel: result.reasonerModel,
      providerFailure: result.providerFailure,
      providerErrorStatus: result.providerErrorStatus,
      providerErrorCode: result.providerErrorCode,
      providerErrorType: result.providerErrorType,
      intakeStage: result.intake.currentStage,
      missingFields: result.intake.missingFields,
      pendingActionType: result.intake.pendingActionType,
      readyForReview: result.intake.readyForReview,
      readyToCreateQuote: result.intake.readyToCreateQuote,
      packageKey: result.intake.packageKey,
      packageName: result.intake.packageName,
      messages,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'turn_failed'
    if (message === COMPANY_SCOPE_VIOLATION) {
      return NextResponse.json({ error: COMPANY_SCOPE_VIOLATION }, { status: 403 })
    }
    if (/brasinha_conversations|brasinha_messages|schema cache/i.test(message)) {
      return NextResponse.json({ error: 'persistence_not_migrated' }, { status: 503 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

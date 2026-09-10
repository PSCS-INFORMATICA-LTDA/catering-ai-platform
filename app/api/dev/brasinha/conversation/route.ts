import { NextResponse } from 'next/server'
import {
  rejectSpoofedCompanyId,
  requireApiAuth,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { publicIntakeSnapshot } from '@/Lib/brasinha/intake/draft'
import { assertBrasinhaDevRuntime } from '@/Lib/brasinha/env'
import { createSupabaseConversationStore } from '@/Lib/brasinha/store/supabaseConversationStore'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    assertBrasinhaDevRuntime()
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const auth = await requireApiAuth()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const spoof = rejectSpoofedCompanyId(
    auth.session,
    url.searchParams.get('companyId'),
  )
  if (spoof) return spoof

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const conversationId = url.searchParams.get('id')?.trim() || ''
  if (!conversationId) {
    return NextResponse.json({ error: 'conversation_id_required' }, { status: 400 })
  }

  const store = createSupabaseConversationStore(getSupabaseServerClient())
  const conversation = await store.get(companyId, conversationId)
  if (!conversation) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const messages = (await store.listMessages(companyId, conversationId)).filter(
    (row) => row.role === 'customer' || row.role === 'assistant',
  )
  const draft = await store.getIntakeDraft(companyId, conversationId).catch(() => null)
  const intake = draft ? publicIntakeSnapshot(draft) : null
  return NextResponse.json({
    conversationId: conversation.id,
    companyId: conversation.companyId,
    language: conversation.language,
    handoffStatus: conversation.handoffStatus,
    handoffReason: conversation.handoffReason,
    intakeStage: intake?.currentStage ?? null,
    missingFields: intake?.missingFields ?? [],
    pendingActionType: intake?.pendingActionType ?? null,
    readyForReview: intake?.readyForReview ?? false,
    readyToCreateQuote: intake?.readyToCreateQuote ?? false,
    packageKey: intake?.packageKey ?? null,
    packageName: intake?.packageName ?? null,
    messages,
  })
}

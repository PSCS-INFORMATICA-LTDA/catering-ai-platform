import { deliveryStatusPatch, parseMetaStatusWebhook, shouldApplyMetaStatus } from '@/Lib/notifications/mapMetaStatus'
import { verifyMetaHubSignature } from '@/Lib/notifications/verifyMetaSignature'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim()
  if (mode === 'subscribe' && expected && token === expected && challenge) {
    return new Response(challenge, { status: 200 })
  }
  return Response.json({ error: 'forbidden' }, { status: 403 })
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const verified = verifyMetaHubSignature({
    rawBody,
    signatureHeader: request.headers.get('x-hub-signature-256'),
  })
  if (!verified.ok) {
    return Response.json({ error: verified.error }, { status: 401 })
  }

  let body: unknown = null
  try {
    body = rawBody ? JSON.parse(rawBody) : null
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const updates = parseMetaStatusWebhook(body)
  if (updates.length === 0) {
    return Response.json({ data: { updated: 0 } })
  }

  const db = getSupabaseServerClient()
  let updated = 0
  for (const update of updates) {
    if (!update.phoneNumberId && !update.wabaId) {
      continue
    }
    let providerQuery = db
      .from('company_notification_providers')
      .select('company_id, phone_number_id, config')
      .eq('channel', 'whatsapp')
    if (update.phoneNumberId) {
      providerQuery = providerQuery.eq('phone_number_id', update.phoneNumberId)
    }
    const { data: providers } = await providerQuery
    const scoped = (providers ?? []).filter((row) => {
      if (update.phoneNumberId && row.phone_number_id === update.phoneNumberId) return true
      const config = (row.config || {}) as { waba_id?: string }
      return Boolean(update.wabaId && config.waba_id && config.waba_id === update.wabaId)
    })
    if (scoped.length === 0) continue

    for (const provider of scoped) {
      const { data: current } = await db
        .from('notification_deliveries')
        .select('id, status')
        .eq('company_id', provider.company_id)
        .eq('provider_message_id', update.providerMessageId)
        .maybeSingle()
      if (!current?.id) continue
      if (!shouldApplyMetaStatus(current.status, update.status)) continue
      const patch = deliveryStatusPatch(update)
      const { data } = await db
        .from('notification_deliveries')
        .update(patch)
        .eq('id', current.id)
        .eq('company_id', provider.company_id)
        .select('id')
      updated += data?.length ?? 0
    }
  }
  return Response.json({ data: { updated } })
}

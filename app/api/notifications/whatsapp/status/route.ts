import { deliveryStatusPatch, parseMetaStatusWebhook } from '@/Lib/notifications/mapMetaStatus'
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
  const body = await request.json().catch(() => null)
  const updates = parseMetaStatusWebhook(body)
  if (updates.length === 0) {
    return Response.json({ data: { updated: 0 } })
  }
  const db = getSupabaseServerClient()
  let updated = 0
  for (const update of updates) {
    const patch = deliveryStatusPatch(update)
    const { data } = await db
      .from('notification_deliveries')
      .update(patch)
      .eq('provider_message_id', update.providerMessageId)
      .select('id')
    updated += data?.length ?? 0
  }
  return Response.json({ data: { updated } })
}

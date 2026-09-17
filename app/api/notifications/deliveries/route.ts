import {
  requireAnyApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAnyApiPermission(
    'notification_deliveries.view',
    'notifications.view',
  )
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { data, error } = await getSupabaseServerClient()
    .from('notification_deliveries')
    .select(
      'id, company_id, event_id, recipient_id, channel, provider, template_key, status, provider_message_id, attempt_count, last_error, created_at, sent_at, delivered_at, read_at, failed_at',
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(80)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data: data ?? [] })
}

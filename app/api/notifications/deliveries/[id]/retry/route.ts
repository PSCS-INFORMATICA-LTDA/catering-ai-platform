import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { retryNotificationDelivery } from '@/Lib/notifications/retryDelivery'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission('notifications.manage')
  if (!auth.ok) return auth.response
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const { id } = await context.params
  const result = await retryNotificationDelivery({
    companyId,
    deliveryId: id,
  })
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 409 })
  }
  return Response.json({ data: result })
}

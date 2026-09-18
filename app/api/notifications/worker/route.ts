import { notificationWorkerSecret } from '@/Lib/notifications/env'
import { processNotificationQueue } from '@/Lib/notifications/processDeliveryQueue'
import { timingSafeEqual } from 'node:crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(request: Request) {
  const expected = notificationWorkerSecret()
  if (!expected) return false
  const header = request.headers.get('authorization') || ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const alt = request.headers.get('x-notification-worker-secret')?.trim() || ''
  const provided = bearer || alt
  if (!provided || provided.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}

async function run(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const url = new URL(request.url)
  const companyId = url.searchParams.get('companyId')?.trim() || undefined
  const result = await processNotificationQueue({
    limit: 25,
    companyId,
    reason: 'cron_or_worker',
  })
  return Response.json({ data: result })
}

export async function GET(request: Request) {
  return run(request)
}

export async function POST(request: Request) {
  return run(request)
}

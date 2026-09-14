type DecideAction = 'approve' | 'reject'

export type DecideCouponApplicationResult = {
  ok: boolean
  status: number
  data: {
    error?: string
    via?: 'rpc' | 'fallback'
    status?: 'applied' | 'rejected'
    idempotent?: boolean
    total?: number
    deposit?: number
    balance?: number
  }
}

export async function decideCouponApplicationClient(
  id: string,
  action: DecideAction,
): Promise<DecideCouponApplicationResult> {
  const response = await fetch('/api/coupons/applications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action }),
  })
  const data = (await response.json().catch(() => ({}))) as DecideCouponApplicationResult['data']
  return { ok: response.ok, status: response.status, data }
}

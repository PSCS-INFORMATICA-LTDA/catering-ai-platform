import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import { getPaypalSandboxAccessToken } from './adapter'
import { paypalApiBase, readPaypalRuntimeConfig } from './config'

export type PaypalWebhookHeaders = {
  transmissionId: string | null
  transmissionTime: string | null
  certUrl: string | null
  authAlgo: string | null
  transmissionSig: string | null
}

export function readPaypalWebhookHeaders(headers: Headers): PaypalWebhookHeaders {
  return {
    transmissionId: headers.get('paypal-transmission-id'),
    transmissionTime: headers.get('paypal-transmission-time'),
    certUrl: headers.get('paypal-cert-url'),
    authAlgo: headers.get('paypal-auth-algo'),
    transmissionSig: headers.get('paypal-transmission-sig'),
  }
}

export function webhookEventId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const id = (payload as { id?: unknown }).id
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

export function webhookOrderIds(payload: unknown): {
  orderId: string | null
  captureId: string | null
} {
  const resource =
    payload && typeof payload === 'object'
      ? ((payload as { resource?: Record<string, unknown> }).resource ?? {})
      : {}
  const orderId =
    (typeof resource.supplementary_data === 'object' &&
    resource.supplementary_data &&
    typeof (resource.supplementary_data as { related_ids?: { order_id?: string } }).related_ids
      ?.order_id === 'string'
      ? (resource.supplementary_data as { related_ids?: { order_id?: string } }).related_ids
          ?.order_id
      : null) ||
    (typeof resource.id === 'string' && resource.intent ? resource.id : null) ||
    (typeof resource.supplementary_data === 'object' ? null : null)
  const captureId = typeof resource.id === 'string' ? resource.id : null
  return { orderId: orderId ?? null, captureId }
}

/**
 * Signature must be verified. A COMPLETED payload alone is never enough.
 * Sandbox without webhook id stays rejected unless the explicit mock path is used.
 */
export async function verifyPaypalWebhookSignature(input: {
  headers: PaypalWebhookHeaders
  rawBody: string
  webhookId?: string | null
  accessToken?: string | null
}): Promise<{ ok: boolean; reason: string }> {
  const config = readPaypalRuntimeConfig()
  const webhookId = input.webhookId ?? config.webhookId
  if (!webhookId) return { ok: false, reason: 'webhook_id_missing' }
  if (
    !input.headers.transmissionId ||
    !input.headers.transmissionSig ||
    !input.headers.transmissionTime ||
    !input.headers.authAlgo ||
    !input.headers.certUrl
  ) {
    return { ok: false, reason: 'headers_missing' }
  }
  const accessToken = input.accessToken ?? (await getPaypalSandboxAccessToken())
  if (!accessToken) return { ok: false, reason: 'auth_missing' }

  const response = await fetch(
    `${paypalApiBase('sandbox')}/v1/notifications/verify-webhook-signature`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: input.headers.authAlgo,
        cert_url: input.headers.certUrl,
        transmission_id: input.headers.transmissionId,
        transmission_sig: input.headers.transmissionSig,
        transmission_time: input.headers.transmissionTime,
        webhook_id: webhookId,
        webhook_event: JSON.parse(input.rawBody),
      }),
    },
  )
  const data = (await response.json().catch(() => null)) as {
    verification_status?: string
  } | null
  if (data?.verification_status === 'SUCCESS') return { ok: true, reason: 'verified' }
  return { ok: false, reason: 'invalid_signature' }
}

/** Test-only helper: compare a local HMAC, never used as production verification. */
export function mockWebhookHmacValid(rawBody: string, secret: string, signature: string) {
  const digest = createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(digest)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

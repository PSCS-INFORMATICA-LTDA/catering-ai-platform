import 'server-only'

import { paypalApiBase } from './config'

type PaypalWebhookRecord = {
  id?: string
  url?: string
  event_types?: Array<{ name?: string }>
}

function hasCaptureCompleted(webhook: PaypalWebhookRecord) {
  return (webhook.event_types ?? []).some(
    (event) => event.name === 'PAYMENT.CAPTURE.COMPLETED',
  )
}

export async function listSandboxWebhooks(accessToken: string) {
  const response = await fetch(`${paypalApiBase('sandbox')}/v1/notifications/webhooks`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })
  const payload = (await response.json().catch(() => null)) as {
    webhooks?: PaypalWebhookRecord[]
  } | null
  if (!response.ok) return []
  return payload?.webhooks ?? []
}

export async function findOrCreateSandboxWebhook(input: {
  accessToken: string
  url: string
}): Promise<{ id: string; reused: boolean } | null> {
  const existing = (await listSandboxWebhooks(input.accessToken)).find(
    (webhook) => webhook.url === input.url && webhook.id,
  )
  if (existing?.id) {
    return { id: existing.id, reused: true }
  }

  const response = await fetch(`${paypalApiBase('sandbox')}/v1/notifications/webhooks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: input.url,
      event_types: [{ name: 'PAYMENT.CAPTURE.COMPLETED' }],
    }),
    cache: 'no-store',
  })
  const payload = (await response.json().catch(() => null)) as PaypalWebhookRecord | null
  if (response.ok && payload?.id) {
    return { id: payload.id, reused: false }
  }

  const afterConflict = (await listSandboxWebhooks(input.accessToken)).find(
    (webhook) => webhook.url === input.url && webhook.id,
  )
  if (afterConflict?.id) {
    return { id: afterConflict.id, reused: true }
  }
  return null
}

export function webhookCoversCapture(webhook: PaypalWebhookRecord) {
  return hasCaptureCompleted(webhook)
}

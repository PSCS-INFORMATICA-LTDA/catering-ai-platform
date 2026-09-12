import 'server-only'

import { paypalApiBase } from './config'

type PaypalWebhookRecord = {
  id?: string
  url?: string
  event_types?: Array<{ name?: string }>
}

const REQUIRED_FINANCE_EVENTS = [
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.REFUNDED',
] as const

function coversEvent(webhook: PaypalWebhookRecord, eventName: string) {
  return (webhook.event_types ?? []).some(
    (event) => event.name === '*' || event.name === eventName,
  )
}

function coversFinanceEvents(webhook: PaypalWebhookRecord) {
  return REQUIRED_FINANCE_EVENTS.every((eventName) => coversEvent(webhook, eventName))
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
}): Promise<{ id: string; reused: boolean; refundEventsConfigured: boolean } | null> {
  const existing = (await listSandboxWebhooks(input.accessToken)).find(
    (webhook) => webhook.url === input.url && webhook.id,
  )
  if (existing?.id) {
    // Existing subscriptions are preserved instead of being mutated implicitly.
    // Direct Sandbox refund execution is still authoritative; operators can use
    // Configure/Update Webhook later to migrate the subscription explicitly.
    return {
      id: existing.id,
      reused: true,
      refundEventsConfigured: coversFinanceEvents(existing),
    }
  }

  const response = await fetch(`${paypalApiBase('sandbox')}/v1/notifications/webhooks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: input.url,
      event_types: REQUIRED_FINANCE_EVENTS.map((name) => ({ name })),
    }),
    cache: 'no-store',
  })
  const payload = (await response.json().catch(() => null)) as PaypalWebhookRecord | null
  if (response.ok && payload?.id) {
    return { id: payload.id, reused: false, refundEventsConfigured: true }
  }

  const afterConflict = (await listSandboxWebhooks(input.accessToken)).find(
    (webhook) => webhook.url === input.url && webhook.id,
  )
  if (afterConflict?.id) {
    return {
      id: afterConflict.id,
      reused: true,
      refundEventsConfigured: coversFinanceEvents(afterConflict),
    }
  }
  return null
}

export function webhookCoversCapture(webhook: PaypalWebhookRecord) {
  return coversEvent(webhook, 'PAYMENT.CAPTURE.COMPLETED')
}

export function webhookCoversRefund(webhook: PaypalWebhookRecord) {
  return coversEvent(webhook, 'PAYMENT.CAPTURE.REFUNDED')
}

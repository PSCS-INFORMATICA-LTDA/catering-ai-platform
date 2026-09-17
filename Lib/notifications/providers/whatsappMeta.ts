import {
  isWhatsAppNotificationsEnabled,
  whatsAppAccessToken,
  whatsAppPhoneNumberId,
  whatsAppTemplateName,
} from '../env'
import type { NotificationProvider, NotificationSendResult } from '../types'

function languageCode(locale: 'pt' | 'en' | 'es') {
  if (locale === 'en') return 'en_US'
  if (locale === 'es') return 'es'
  return 'pt_BR'
}

function money(value: number | null, currency: string | null) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${currency || 'USD'} ${value.toFixed(2)}`
}

export const whatsAppMetaProvider: NotificationProvider = {
  channel: 'whatsapp',
  async send(input): Promise<NotificationSendResult> {
    if (!isWhatsAppNotificationsEnabled()) {
      return { ok: false, provider: 'meta_whatsapp', error: 'whatsapp_disabled' }
    }
    const token = whatsAppAccessToken()
    const phoneNumberId = whatsAppPhoneNumberId()
    if (!token || !phoneNumberId) {
      return { ok: false, provider: 'meta_whatsapp', error: 'whatsapp_not_configured' }
    }
    if (!input.toE164) {
      return { ok: false, provider: 'meta_whatsapp', error: 'recipient_phone_missing' }
    }

    const template = whatsAppTemplateName()
    const body = {
      messaging_product: 'whatsapp',
      to: input.toE164.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: template,
        language: { code: languageCode(input.locale) },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: input.payload.customerName || '—' },
              {
                type: 'text',
                text: [input.payload.eventDate, input.payload.eventTime].filter(Boolean).join(' ') || '—',
              },
              { type: 'text', text: input.payload.quoteNumber || input.payload.quoteId },
              { type: 'text', text: money(input.payload.total, input.payload.currency) },
            ],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: input.payload.quoteId }],
          },
        ],
      },
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )
    const json = (await response.json().catch(() => null)) as {
      messages?: Array<{ id?: string }>
      error?: { message?: string; code?: number }
    } | null
    if (!response.ok) {
      const message = json?.error?.message || `whatsapp_http_${response.status}`
      return {
        ok: false,
        provider: 'meta_whatsapp',
        error: String(message).slice(0, 240),
      }
    }
    return {
      ok: true,
      provider: 'meta_whatsapp',
      providerMessageId: json?.messages?.[0]?.id ?? null,
    }
  },
}

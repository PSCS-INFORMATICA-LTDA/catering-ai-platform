import { resolveWhatsAppConfig } from '../resolveProvider'
import { templateKeyForEvent, whatsAppButtonParameter, whatsAppTemplateBody } from '../templates'
import type { NotificationProvider, NotificationSendResult } from '../types'

function languageCode(locale: 'pt' | 'en' | 'es') {
  if (locale === 'en') return 'en_US'
  if (locale === 'es') return 'es'
  return 'pt_BR'
}

export const whatsAppMetaProvider: NotificationProvider = {
  channel: 'whatsapp',
  async send(input): Promise<NotificationSendResult> {
    const config = await resolveWhatsAppConfig(input.companyId)
    if (!config.enabled) {
      return { ok: false, provider: 'meta_whatsapp', error: 'whatsapp_disabled' }
    }
    if (!config.accessToken || !config.phoneNumberId) {
      return { ok: false, provider: 'meta_whatsapp', error: 'whatsapp_not_configured' }
    }
    if (!input.toE164) {
      return { ok: false, provider: 'meta_whatsapp', error: 'recipient_phone_missing' }
    }

    const template = input.templateKey || templateKeyForEvent(input.payload.eventKey)
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
            parameters: whatsAppTemplateBody({
              templateKey: template,
              locale: input.locale,
              payload: input.payload,
            }).map((text) => ({ type: 'text', text })),
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: whatsAppButtonParameter(input.payload) }],
          },
        ],
      },
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
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
        provider: config.provider || 'meta_whatsapp',
        error: String(message).slice(0, 240),
      }
    }
    return {
      ok: true,
      provider: config.provider || 'meta_whatsapp',
      providerMessageId: json?.messages?.[0]?.id ?? null,
    }
  },
}

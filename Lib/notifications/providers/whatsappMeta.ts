import { includeDevHeaderInWhatsAppTemplate } from '../env'
import { resolveWhatsAppConfig } from '../resolveProvider'
import { templateKeyForEvent, whatsAppButtonParameter, whatsAppTemplateBody } from '../templates'
import { eventHeadline } from '../whatsappCopy'
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
      return {
        ok: false,
        provider: 'meta_whatsapp',
        error: config.reason || 'whatsapp_disabled',
      }
    }
    if (!config.accessToken || !config.phoneNumberId) {
      return { ok: false, provider: 'meta_whatsapp', error: 'whatsapp_not_configured' }
    }
    if (!input.toE164) {
      return { ok: false, provider: 'meta_whatsapp', error: 'recipient_phone_missing' }
    }

    const template = input.templateKey || templateKeyForEvent(input.payload.eventKey)
    const components: Array<Record<string, unknown>> = []
    if (includeDevHeaderInWhatsAppTemplate()) {
      components.push({
        type: 'header',
        parameters: [{ type: 'text', text: eventHeadline(input.payload.eventKey, input.locale) }],
      })
    }
    components.push({
      type: 'body',
      parameters: whatsAppTemplateBody({
        templateKey: template,
        locale: input.locale,
        payload: input.payload,
      }).map((text) => ({ type: 'text', text })),
    })
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: whatsAppButtonParameter(input.payload) }],
    })

    const body = {
      messaging_product: 'whatsapp',
      to: input.toE164.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: template,
        language: { code: languageCode(input.locale) },
        components,
      },
    }

    let response: Response
    try {
      response = await fetch(
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'whatsapp_network_error'
      return {
        ok: false,
        provider: config.provider || 'meta_whatsapp',
        error: message.slice(0, 240),
        uncertain: true,
      }
    }

    const json = (await response.json().catch(() => null)) as {
      messages?: Array<{ id?: string }>
      error?: { message?: string; code?: number; error_subcode?: number }
    } | null
    if (!response.ok) {
      const message = json?.error?.message || `whatsapp_http_${response.status}`
      const retryAfter = response.headers.get('retry-after')
      return {
        ok: false,
        provider: config.provider || 'meta_whatsapp',
        error: String(message).slice(0, 240),
        retryAfterSeconds: retryAfter ? Number(retryAfter) || 60 : response.status === 429 ? 60 : null,
      }
    }
    return {
      ok: true,
      provider: config.provider || 'meta_whatsapp',
      providerMessageId: json?.messages?.[0]?.id ?? null,
    }
  },
}

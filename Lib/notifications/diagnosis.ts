import { publicWhatsAppProviderStatus, resolveWhatsAppConfig } from './resolveProvider'
import type { NotificationConsentStatus } from './types'

export type NotificationDiagnosis = {
  ready: boolean
  missing: Array<{ code: string; field: string; where: string }>
  provider: ReturnType<typeof publicWhatsAppProviderStatus>
}

export function buildNotificationDiagnosis(input: {
  provider: Awaited<ReturnType<typeof resolveWhatsAppConfig>>
  recipientEnabled: boolean
  consentStatus: NotificationConsentStatus | string | null | undefined
  phoneE164: string | null
  subscribedEvents: string[]
  callbackConfigured?: boolean
}): NotificationDiagnosis {
  const missing: NotificationDiagnosis['missing'] = []
  if (!input.provider.enabled) {
    missing.push({
      code: input.provider.reason || 'whatsapp_not_configured',
      field: 'company_notification_providers',
      where: 'Configurações > Notificações / company WhatsApp provider',
    })
  }
  if (!input.phoneE164) {
    missing.push({
      code: 'recipient_phone_missing',
      field: 'phone',
      where: 'Configurações > Notificações > destinatário',
    })
  }
  if (!input.recipientEnabled) {
    missing.push({
      code: 'recipient_disabled',
      field: 'enabled',
      where: 'Configurações > Notificações > destinatário',
    })
  }
  if (input.consentStatus !== 'confirmed') {
    missing.push({
      code: 'consent_not_confirmed',
      field: 'consent_status',
      where: 'Configurações > Notificações > autorização do destinatário',
    })
  }
  if (input.subscribedEvents.length === 0) {
    missing.push({
      code: 'no_event_subscription',
      field: 'subscriptions',
      where: 'Configurações > Notificações > eventos',
    })
  }
  if (input.callbackConfigured === false) {
    missing.push({
      code: 'callback_not_configured',
      field: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN / META App Secret',
      where: 'Meta App Dashboard > WhatsApp > Configuration > Callback URL',
    })
  }
  return {
    ready: missing.length === 0,
    missing,
    provider: publicWhatsAppProviderStatus(input.provider),
  }
}

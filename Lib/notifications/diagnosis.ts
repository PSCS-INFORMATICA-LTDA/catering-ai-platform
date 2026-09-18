import { buildMetaChecklist, type MetaChecklist } from './metaChecklist'
import { publicWhatsAppProviderStatus, resolveWhatsAppConfig } from './resolveProvider'
import type { NotificationConsentStatus } from './types'

export type NotificationDiagnosis = {
  ready: boolean
  missing: Array<{ code: string; field: string; where: string }>
  provider: ReturnType<typeof publicWhatsAppProviderStatus>
  meta: MetaChecklist
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
  const meta = buildMetaChecklist()
  if (meta.appSecret === 'AUSENTE') {
    missing.push({
      code: 'meta_app_secret_missing',
      field: 'WHATSAPP_APP_SECRET',
      where: 'Vercel Preview env (server-only) + Meta App > App Secret',
    })
  }
  if (meta.accessToken === 'AUSENTE') {
    missing.push({
      code: 'meta_access_token_missing',
      field: 'WHATSAPP_ACCESS_TOKEN',
      where: 'Vercel Preview env (server-only) + Meta WhatsApp > API Setup. Not the App Secret.',
    })
  }
  if (meta.phoneNumberId === 'AUSENTE') {
    missing.push({
      code: 'meta_phone_number_id_missing',
      field: 'WHATSAPP_PHONE_NUMBER_ID / company_notification_providers.phone_number_id',
      where: 'Configurações > Notificações + Meta WhatsApp > Phone number ID',
    })
  }
  if (meta.verifyToken === 'AUSENTE') {
    missing.push({
      code: 'meta_verify_token_missing',
      field: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
      where: 'Vercel Preview env + Meta App > WhatsApp > Configuration > Verify token',
    })
  }
  if (meta.workerSecret === 'AUSENTE') {
    missing.push({
      code: 'worker_secret_missing',
      field: 'NOTIFICATION_WORKER_SECRET or CRON_SECRET',
      where: 'Vercel Preview env (server-only). Used by the DEV scheduler, not by the browser.',
    })
  }
  if (input.callbackConfigured === false) {
    missing.push({
      code: 'callback_not_configured',
      field: 'Callback URL + X-Hub-Signature-256',
      where: 'Meta App Dashboard > WhatsApp > Configuration > Callback URL = {preview}/api/notifications/whatsapp/status',
    })
  }
  return {
    ready: missing.length === 0,
    missing,
    provider: publicWhatsAppProviderStatus(input.provider),
    meta,
  }
}

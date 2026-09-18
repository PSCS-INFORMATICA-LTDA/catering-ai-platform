import { notificationWorkerSecret, whatsAppAccessToken, whatsAppPhoneNumberId } from './env'
import { metaAppSecret } from './verifyMetaSignature'

export type ConfigPresence = 'CONFIGURADO' | 'AUSENTE' | 'NÃO VERIFICADO'

function presence(value: string | null | undefined): Exclude<ConfigPresence, 'NÃO VERIFICADO'> {
  return String(value || '').trim() ? 'CONFIGURADO' : 'AUSENTE'
}

export type MetaChecklist = {
  appSecret: ConfigPresence
  accessToken: ConfigPresence
  phoneNumberId: ConfigPresence
  verifyToken: ConfigPresence
  workerSecret: ConfigPresence
  sharedSenderAllowlist: ConfigPresence
  callbackSignature: ConfigPresence
  templates: {
    new_quote_internal: ConfigPresence
    quote_accepted_internal: ConfigPresence
    payment_deposit_received_internal: ConfigPresence
    payment_full_received_internal: ConfigPresence
  }
  templateLanguages: {
    pt: ConfigPresence
    en: ConfigPresence
    es: ConfigPresence
  }
}

/** Presence only. Never returns secret values. Templates stay unverified until Meta is checked. */
export function buildMetaChecklist(): MetaChecklist {
  return {
    appSecret: presence(metaAppSecret()),
    accessToken: presence(whatsAppAccessToken()),
    phoneNumberId: presence(whatsAppPhoneNumberId()),
    verifyToken: presence(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
    workerSecret: presence(notificationWorkerSecret()),
    sharedSenderAllowlist: presence(process.env.WHATSAPP_SHARED_SENDER_COMPANY_IDS),
    callbackSignature: 'NÃO VERIFICADO',
    templates: {
      new_quote_internal: 'NÃO VERIFICADO',
      quote_accepted_internal: 'NÃO VERIFICADO',
      payment_deposit_received_internal: 'NÃO VERIFICADO',
      payment_full_received_internal: 'NÃO VERIFICADO',
    },
    templateLanguages: {
      pt: 'NÃO VERIFICADO',
      en: 'NÃO VERIFICADO',
      es: 'NÃO VERIFICADO',
    },
  }
}

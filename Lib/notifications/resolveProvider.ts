import { decryptProviderSecret } from '@/Lib/payments/secretVault'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import {
  isWhatsAppNotificationsEnabled,
  whatsAppAccessToken,
  whatsAppPhoneNumberId,
} from './env'
import type { WhatsAppResolvedConfig } from './types'

export async function resolveWhatsAppConfig(companyId: string): Promise<WhatsAppResolvedConfig> {
  const flagOn = isWhatsAppNotificationsEnabled()
  if (companyId) {
    try {
      const db = getSupabaseServerClient()
      const { data: row } = await db
        .from('company_notification_providers')
        .select('enabled, provider, phone_number_id, credential_ref')
        .eq('company_id', companyId)
        .eq('channel', 'whatsapp')
        .maybeSingle()
      if (row?.enabled) {
        const secret = await db.rpc('read_company_notification_secret', {
          p_company_id: companyId,
          p_channel: 'whatsapp',
          p_provider: row.provider || 'meta_cloud_api',
        })
        let token = ''
        if (secret.data) {
          try {
            token = decryptProviderSecret(String(secret.data))
          } catch {
            token = ''
          }
        }
        const phoneNumberId = String(row.phone_number_id || '')
        if (token && phoneNumberId && flagOn) {
          return {
            source: 'company',
            enabled: true,
            accessToken: token,
            phoneNumberId,
            provider: String(row.provider || 'meta_cloud_api'),
          }
        }
      }
    } catch {
      // fall through to env
    }
  }

  const token = whatsAppAccessToken()
  const phoneNumberId = whatsAppPhoneNumberId()
  if (flagOn && token && phoneNumberId) {
    return {
      source: 'env_fallback',
      enabled: true,
      accessToken: token,
      phoneNumberId,
      provider: 'meta_cloud_api',
    }
  }
  return {
    source: 'none',
    enabled: false,
    accessToken: '',
    phoneNumberId: '',
    provider: 'meta_cloud_api',
  }
}

export function publicWhatsAppProviderStatus(config: WhatsAppResolvedConfig) {
  return {
    channel: 'whatsapp' as const,
    configured: Boolean(config.phoneNumberId) && config.source !== 'none',
    source: config.source,
    enabled: config.enabled,
    templates: {
      new_quote_internal: 'pending_external_approval',
      payment_deposit_received_internal: 'pending_external_approval',
      payment_full_received_internal: 'pending_external_approval',
    },
  }
}

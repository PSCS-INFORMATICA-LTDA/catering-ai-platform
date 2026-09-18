import { decryptProviderSecret } from '@/Lib/payments/secretVault'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import {
  companyMayUseSharedWhatsAppSender,
  isWhatsAppNotificationsEnabled,
  whatsAppAccessToken,
  whatsAppPhoneNumberId,
} from './env'
import type { WhatsAppResolvedConfig } from './types'

function none(reason: string): WhatsAppResolvedConfig {
  return {
    source: 'none',
    enabled: false,
    accessToken: '',
    phoneNumberId: '',
    provider: 'meta_cloud_api',
    reason,
  }
}

export async function resolveWhatsAppConfig(companyId: string): Promise<WhatsAppResolvedConfig> {
  if (!companyId) return none('company_required')
  const flagOn = isWhatsAppNotificationsEnabled()
  if (!flagOn) return none('whatsapp_flag_off')

  try {
    const db = getSupabaseServerClient()
    const { data: row } = await db
      .from('company_notification_providers')
      .select('enabled, provider, phone_number_id, credential_ref')
      .eq('company_id', companyId)
      .eq('channel', 'whatsapp')
      .maybeSingle()

    if (row) {
      if (!row.enabled) return none('provider_disabled')
      const provider = String(row.provider || 'meta_cloud_api')
      if (provider === 'pscs_shared') {
        if (!companyMayUseSharedWhatsAppSender(companyId)) {
          return none('shared_sender_not_linked')
        }
        const token = whatsAppAccessToken()
        const phoneNumberId = String(row.phone_number_id || whatsAppPhoneNumberId() || '')
        if (!token || !phoneNumberId) return none('shared_sender_incomplete')
        return {
          source: 'shared_explicit',
          enabled: true,
          accessToken: token,
          phoneNumberId,
          provider,
        }
      }
      const secret = await db.rpc('read_company_notification_secret', {
        p_company_id: companyId,
        p_channel: 'whatsapp',
        p_provider: provider,
      })
      let token = ''
      if (secret.data) {
        try {
          token = decryptProviderSecret(String(secret.data))
        } catch {
          return none('credential_decrypt_failed')
        }
      }
      const phoneNumberId = String(row.phone_number_id || '')
      if (!token || !phoneNumberId) return none('company_credential_incomplete')
      return {
        source: 'company',
        enabled: true,
        accessToken: token,
        phoneNumberId,
        provider,
      }
    }
  } catch {
    return none('provider_lookup_failed')
  }

  if (companyMayUseSharedWhatsAppSender(companyId)) {
    const token = whatsAppAccessToken()
    const phoneNumberId = whatsAppPhoneNumberId()
    if (token && phoneNumberId) {
      return {
        source: 'shared_explicit',
        enabled: true,
        accessToken: token,
        phoneNumberId,
        provider: 'pscs_shared',
      }
    }
    return none('shared_sender_incomplete')
  }

  return none('company_provider_missing')
}

export function publicWhatsAppProviderStatus(config: WhatsAppResolvedConfig) {
  return {
    channel: 'whatsapp' as const,
    configured: config.enabled && Boolean(config.phoneNumberId) && config.source !== 'none',
    source: config.source,
    enabled: config.enabled,
    reason: config.reason ?? null,
    templates: {
      new_quote_internal: 'unverified',
      quote_accepted_internal: 'unverified',
      payment_deposit_received_internal: 'unverified',
      payment_full_received_internal: 'unverified',
    },
  }
}

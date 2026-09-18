import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { publicWhatsAppProviderStatus, resolveWhatsAppConfig } from './resolveProvider'

export type PaymentNotificationSummary = {
  activeRecipients: number
  depositEnabled: boolean
  fullEnabled: boolean
  acceptedEnabled: boolean
  provider: ReturnType<typeof publicWhatsAppProviderStatus>
}

export async function loadPaymentNotificationSummary(
  companyId: string,
): Promise<PaymentNotificationSummary> {
  const empty: PaymentNotificationSummary = {
    activeRecipients: 0,
    depositEnabled: false,
    fullEnabled: false,
    acceptedEnabled: false,
    provider: publicWhatsAppProviderStatus({
      source: 'none',
      enabled: false,
      accessToken: '',
      phoneNumberId: '',
      provider: 'meta_cloud_api',
    }),
  }
  try {
    const db = getSupabaseServerClient()
    const [{ data: recipients }, { data: subscriptions }, provider] = await Promise.all([
      db
        .from('notification_recipients')
        .select('id, enabled')
        .eq('company_id', companyId),
      db
        .from('notification_subscriptions')
        .select('event_key, enabled, recipient_id')
        .eq('company_id', companyId),
      resolveWhatsAppConfig(companyId),
    ])
    const activeIds = new Set(
      (recipients ?? []).filter((row) => row.enabled).map((row) => String(row.id)),
    )
    return {
      activeRecipients: activeIds.size,
      depositEnabled: (subscriptions ?? []).some(
        (row) =>
          row.event_key === 'payment.deposit_received' &&
          row.enabled &&
          activeIds.has(String(row.recipient_id)),
      ),
      fullEnabled: (subscriptions ?? []).some(
        (row) =>
          row.event_key === 'payment.full_received' &&
          row.enabled &&
          activeIds.has(String(row.recipient_id)),
      ),
      acceptedEnabled: (subscriptions ?? []).some(
        (row) =>
          row.event_key === 'quote.accepted' &&
          row.enabled &&
          activeIds.has(String(row.recipient_id)),
      ),
      provider: publicWhatsAppProviderStatus(provider),
    }
  } catch {
    return empty
  }
}

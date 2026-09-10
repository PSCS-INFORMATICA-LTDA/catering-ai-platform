import 'server-only'

import {
  loadCompanyPaypalCredentials,
  loadCompanyPaypalRow,
} from '@/Lib/payments/companyPaypal'
import { readPaypalRuntimeConfig } from './config'

export type PublicPaypalCheckoutReason =
  | 'ready'
  | 'paypal_production_blocked'
  | 'paypal_live_blocked'
  | 'paypal_disabled'
  | 'paypal_public_checkout_off'
  | 'paypal_not_configured'
  | 'paypal_company_disabled'
  | 'paypal_sandbox_required'
  | 'paypal_credentials_missing'
  | 'paypal_test_required'
  | 'paypal_webhook_required'

export type PublicPaypalCheckoutReadiness = {
  ready: boolean
  reason: PublicPaypalCheckoutReason
  clientId: string | null
  environment: 'sandbox'
}

function blocked(reason: PublicPaypalCheckoutReason): PublicPaypalCheckoutReadiness {
  return { ready: false, reason, clientId: null, environment: 'sandbox' }
}

/**
 * Public checkout is intentionally stricter than the authenticated operator flow.
 * It requires every sandbox safety gate to be green before a browser can start
 * a PayPal order. No secret is ever returned from this helper.
 */
export async function resolvePublicPaypalCheckoutReadiness(
  companyId: string,
): Promise<PublicPaypalCheckoutReadiness> {
  const runtime = readPaypalRuntimeConfig()
  if (runtime.productionBlocked) return blocked('paypal_production_blocked')
  if (runtime.liveBlocked) return blocked('paypal_live_blocked')
  if (!runtime.enabled) return blocked('paypal_disabled')
  if (!runtime.publicCheckout) return blocked('paypal_public_checkout_off')

  const row = await loadCompanyPaypalRow(companyId)
  if (!row) return blocked('paypal_not_configured')
  if (row.environment === 'live') return blocked('paypal_sandbox_required')
  if (row.enabled !== true) return blocked('paypal_company_disabled')

  const credentials = await loadCompanyPaypalCredentials(companyId)
  if (!credentials.clientId || !credentials.clientSecret) {
    return blocked('paypal_credentials_missing')
  }

  const metadata =
    row.metadata && typeof row.metadata === 'object'
      ? (row.metadata as Record<string, unknown>)
      : {}
  if (metadata.connection_status !== 'validated') {
    return blocked('paypal_test_required')
  }
  if (!credentials.webhookId || !credentials.webhookRouteKey) {
    return blocked('paypal_webhook_required')
  }

  return {
    ready: true,
    reason: 'ready',
    clientId: credentials.clientId,
    environment: 'sandbox',
  }
}

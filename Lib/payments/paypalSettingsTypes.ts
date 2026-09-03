export type PaypalConnectionStatus =
  | 'not_configured'
  | 'configured'
  | 'validated'
  | 'error'

export type CompanyPaypalMetadata = {
  webhook_id?: string | null
  client_secret_vault_id?: string | null
  connection_status?: PaypalConnectionStatus
  last_tested_at?: string | null
  last_test_status?: string | null
  last_test_error?: string | null
}

export type CompanyPaypalPublicSettings = {
  provider: 'paypal'
  environment: 'sandbox'
  enabled: boolean
  clientId: string | null
  clientSecretConfigured: boolean
  webhookConfigured: boolean
  webhookId: string | null
  webhookUrl: string | null
  webhookRouteKey: string | null
  connectionStatus: PaypalConnectionStatus
  lastTestedAt: string | null
  lastTestStatus: string | null
  publicCheckout: false
  liveBlocked: true
  platformEnabled: boolean
}

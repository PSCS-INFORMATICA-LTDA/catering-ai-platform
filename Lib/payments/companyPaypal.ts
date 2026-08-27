import 'server-only'

import { randomBytes } from 'node:crypto'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { readPaypalRuntimeConfig } from './paypal/config'
import type {
  CompanyPaypalMetadata,
  CompanyPaypalPublicSettings,
  PaypalConnectionStatus,
} from './paypalSettingsTypes'
import { loadCompanyPaypalSecret } from './secretVault'

export type {
  CompanyPaypalMetadata,
  CompanyPaypalPublicSettings,
  PaypalConnectionStatus,
}

export type CompanyPaypalCredentials = {
  companyId: string
  environment: 'sandbox'
  enabled: boolean
  clientId: string | null
  clientSecret: string | null
  webhookId: string | null
  webhookRouteKey: string | null
}

function asMetadata(value: unknown): CompanyPaypalMetadata {
  return value && typeof value === 'object' ? (value as CompanyPaypalMetadata) : {}
}

export function createWebhookRouteKey() {
  return randomBytes(24).toString('base64url')
}

export function publicPaypalWebhookUrl(routeKey: string | null) {
  if (!routeKey) return null
  const origin = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://catering-ai-agenda-dev.vercel.app'
  ).replace(/\/$/, '')
  return `${origin}/api/payments/paypal/webhook/${routeKey}`
}

export async function loadCompanyPaypalRow(companyId: string) {
  const { data } = await getSupabaseServerClient()
    .from('company_payment_providers')
    .select(
      'id, company_id, provider, environment, enabled, public_client_id, webhook_route_key, metadata',
    )
    .eq('company_id', companyId)
    .eq('provider', 'paypal')
    .maybeSingle()
  return data
}

export async function loadCompanyPaypalCredentials(
  companyId: string,
): Promise<CompanyPaypalCredentials> {
  const row = await loadCompanyPaypalRow(companyId)
  const metadata = asMetadata(row?.metadata)
  const clientSecret = await loadCompanyPaypalSecret(companyId)
  return {
    companyId,
    environment: 'sandbox',
    enabled: row?.enabled === true,
    clientId: row?.public_client_id ? String(row.public_client_id) : null,
    clientSecret,
    webhookId: metadata.webhook_id ? String(metadata.webhook_id) : null,
    webhookRouteKey: row?.webhook_route_key ? String(row.webhook_route_key) : null,
  }
}

export async function toPublicPaypalSettings(
  companyId: string,
): Promise<CompanyPaypalPublicSettings> {
  const runtime = readPaypalRuntimeConfig()
  const row = await loadCompanyPaypalRow(companyId)
  const metadata = asMetadata(row?.metadata)
  const clientId = row?.public_client_id ? String(row.public_client_id) : null
  const secretConfigured = Boolean(await loadCompanyPaypalSecret(companyId))
  const routeKey = row?.webhook_route_key ? String(row.webhook_route_key) : null
  const connectionStatus: PaypalConnectionStatus =
    metadata.connection_status ||
    (clientId && secretConfigured ? 'configured' : 'not_configured')
  return {
    provider: 'paypal',
    environment: 'sandbox',
    enabled: row?.enabled === true,
    clientId,
    clientSecretConfigured: secretConfigured,
    webhookConfigured: Boolean(metadata.webhook_id),
    webhookId: metadata.webhook_id ?? null,
    webhookUrl: publicPaypalWebhookUrl(routeKey),
    webhookRouteKey: routeKey,
    connectionStatus,
    lastTestedAt: metadata.last_tested_at ?? null,
    lastTestStatus: metadata.last_test_status ?? null,
    publicCheckout: false,
    liveBlocked: true,
    platformEnabled: runtime.enabled,
  }
}

export async function findPaypalProviderByWebhookKey(routeKey: string) {
  const { data } = await getSupabaseServerClient()
    .from('company_payment_providers')
    .select('company_id, provider, webhook_route_key, metadata, public_client_id, enabled, environment')
    .eq('provider', 'paypal')
    .eq('webhook_route_key', routeKey)
    .maybeSingle()
  return data
}

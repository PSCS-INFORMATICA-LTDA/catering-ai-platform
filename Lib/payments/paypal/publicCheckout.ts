import 'server-only'

import { hasPermission } from '@/Lib/auth/permissions'
import { resolveSessionCompanyId } from '@/Lib/auth/requireApi'
import { getAuthSession } from '@/Lib/auth/session'
import {
  loadCompanyPaypalCredentials,
  loadCompanyPaypalRow,
} from '@/Lib/payments/companyPaypal'
import {
  decideInternalSandboxCheckout,
  decideLivePaypalCheckout,
  PAYPAL_LIVE_NOT_AVAILABLE,
  type PaypalCheckoutMode,
  type PaypalPaymentEnvironment,
  type PublicPaypalBlockReason,
} from './checkoutPolicy'
import {
  activePaypalApiBase,
  PAYPAL_LIVE_ADAPTER_AVAILABLE,
  readPaypalRequestedEnv,
  readPaypalRuntimeConfig,
  readPublicCheckoutFlag,
  readRuntimeEnv,
} from './config'

export const PAYPAL_INTERNAL_SANDBOX_PERMISSION = 'quotes.manage'

export const PAYPAL_LIVE_NOT_AVAILABLE_MESSAGE =
  'PayPal is temporarily unavailable. Please use the available alternative payment method.'

export type PaypalLiveCheckoutResult =
  | { ok: true; environment: 'live'; clientId: string }
  | { ok: false; error: typeof PAYPAL_LIVE_NOT_AVAILABLE; reason: PublicPaypalBlockReason }

export type PaypalCheckoutAccess =
  | {
      allowed: true
      mode: Exclude<PaypalCheckoutMode, 'blocked'>
      environment: PaypalPaymentEnvironment
      clientId: string
    }
  | {
      allowed: false
      mode: 'blocked'
      error: typeof PAYPAL_LIVE_NOT_AVAILABLE
      reason: PublicPaypalBlockReason
    }

function metadataOf(row: { metadata?: unknown } | null) {
  return row?.metadata && typeof row.metadata === 'object'
    ? (row.metadata as Record<string, unknown>)
    : {}
}

async function loadCompanyPaypalState(companyId: string) {
  const [row, credentials] = await Promise.all([
    loadCompanyPaypalRow(companyId),
    loadCompanyPaypalCredentials(companyId),
  ])
  return {
    row,
    credentials,
    credentialsPresent: Boolean(credentials.clientId && credentials.clientSecret),
  }
}

/**
 * Canonical server-side guard for the PUBLIC customer PayPal checkout.
 * Allowed only when PayPal is explicitly LIVE end to end; anything else is
 * PAYPAL_LIVE_NOT_AVAILABLE. Never returns secrets.
 */
export async function assertPayPalLiveCheckoutAllowed(
  companyId: string,
): Promise<PaypalLiveCheckoutResult> {
  const runtime = readPaypalRuntimeConfig()
  const { row, credentials, credentialsPresent } = await loadCompanyPaypalState(companyId)
  const decision = decideLivePaypalCheckout({
    requestedEnv: readPaypalRequestedEnv(),
    runtimeEnv: readRuntimeEnv(),
    activeApiBase: activePaypalApiBase(runtime),
    liveAdapterAvailable: PAYPAL_LIVE_ADAPTER_AVAILABLE,
    platformEnabled: runtime.enabled,
    publicCheckoutFlag: readPublicCheckoutFlag(),
    companyConfigured: Boolean(row),
    companyEnvironment: row?.environment ? String(row.environment) : null,
    companyEnabled: row?.enabled === true,
    credentialsPresent,
    connectionValidated: metadataOf(row).connection_status === 'validated',
    webhookConfigured: Boolean(credentials.webhookId && credentials.webhookRouteKey),
  })
  if (!decision.allowed || !credentials.clientId) {
    return {
      ok: false,
      error: PAYPAL_LIVE_NOT_AVAILABLE,
      reason: decision.allowed ? 'paypal_credentials_missing' : decision.reason,
    }
  }
  return { ok: true, environment: 'live', clientId: credentials.clientId }
}

async function isInternalViewerForCompany(companyId: string): Promise<boolean> {
  const session = await getAuthSession().catch(() => null)
  if (!session) return false
  if (resolveSessionCompanyId(session) !== companyId) return false
  return (
    session.isPlatformAdmin ||
    hasPermission(session.permissions, PAYPAL_INTERNAL_SANDBOX_PERMISSION)
  )
}

/**
 * Resolves who may run a PayPal checkout for a public payment link:
 * - LIVE: any customer, only when assertPayPalLiveCheckoutAllowed passes;
 * - internal Sandbox: authenticated staff of the same company (TEST only);
 * - otherwise blocked with PAYPAL_LIVE_NOT_AVAILABLE.
 */
export async function resolvePaypalCheckoutAccess(companyId: string): Promise<PaypalCheckoutAccess> {
  const live = await assertPayPalLiveCheckoutAllowed(companyId)
  if (live.ok) {
    return { allowed: true, mode: 'live', environment: 'live', clientId: live.clientId }
  }

  const runtime = readPaypalRuntimeConfig()
  const { row, credentials, credentialsPresent } = await loadCompanyPaypalState(companyId)
  const internalViewer = await isInternalViewerForCompany(companyId)
  const sandboxAllowed = decideInternalSandboxCheckout({
    sandboxRuntimeAllowed: !runtime.productionBlocked && !runtime.liveBlocked,
    platformEnabled: runtime.enabled,
    companyConfigured: Boolean(row),
    companyEnvironment: row?.environment ? String(row.environment) : null,
    companyEnabled: row?.enabled === true,
    credentialsPresent,
    internalViewer,
  })
  if (sandboxAllowed && credentials.clientId) {
    return {
      allowed: true,
      mode: 'internal_sandbox',
      environment: 'sandbox',
      clientId: credentials.clientId,
    }
  }
  return { allowed: false, mode: 'blocked', error: live.error, reason: live.reason }
}

export function paypalLiveNotAvailableResponse() {
  return Response.json(
    { error: PAYPAL_LIVE_NOT_AVAILABLE, message: PAYPAL_LIVE_NOT_AVAILABLE_MESSAGE },
    { status: 403 },
  )
}

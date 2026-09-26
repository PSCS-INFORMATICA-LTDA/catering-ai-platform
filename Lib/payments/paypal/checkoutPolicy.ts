/**
 * Canonical PayPal checkout policy (pure, no I/O).
 *
 * Public/customer checkout FAILS CLOSED unless every LIVE condition is true.
 * PayPal Sandbox is only reachable by an authenticated internal operator of the
 * same company, and a Sandbox capture is always a TEST record — never money.
 */

export const PAYPAL_LIVE_NOT_AVAILABLE = 'PAYPAL_LIVE_NOT_AVAILABLE' as const
export const PAYPAL_LIVE_API_BASE = 'https://api-m.paypal.com'
export const PAYPAL_SANDBOX_API_BASE = 'https://api-m.sandbox.paypal.com'

/** Non-financial attempt status used to store an audited Sandbox capture. */
export const SANDBOX_TEST_CAPTURE_STATUS = 'approved' as const

export type PaypalPaymentEnvironment = 'live' | 'sandbox'

export type PublicPaypalBlockReason =
  | 'paypal_env_missing'
  | 'paypal_env_not_live'
  | 'paypal_production_runtime_required'
  | 'paypal_live_endpoint_inactive'
  | 'paypal_live_adapter_unavailable'
  | 'paypal_disabled'
  | 'paypal_public_checkout_off'
  | 'paypal_not_configured'
  | 'paypal_company_not_live'
  | 'paypal_company_disabled'
  | 'paypal_credentials_missing'
  | 'paypal_test_required'
  | 'paypal_webhook_required'

export type LiveCheckoutPolicyInput = {
  /** Raw PAYPAL_ENV. Only the exact value `live` is accepted. */
  requestedEnv: string | null | undefined
  /** Raw VERCEL_ENV (or NODE_ENV fallback when not on Vercel). */
  runtimeEnv: string | null | undefined
  /** API base the server adapter would actually call. */
  activeApiBase: string
  liveAdapterAvailable: boolean
  platformEnabled: boolean
  publicCheckoutFlag: boolean
  companyConfigured: boolean
  companyEnvironment: string | null | undefined
  companyEnabled: boolean
  credentialsPresent: boolean
  connectionValidated: boolean
  webhookConfigured: boolean
}

export type LiveCheckoutDecision =
  | { allowed: true; environment: 'live' }
  | { allowed: false; error: typeof PAYPAL_LIVE_NOT_AVAILABLE; reason: PublicPaypalBlockReason }

function deny(reason: PublicPaypalBlockReason): LiveCheckoutDecision {
  return { allowed: false, error: PAYPAL_LIVE_NOT_AVAILABLE, reason }
}

export function decideLivePaypalCheckout(input: LiveCheckoutPolicyInput): LiveCheckoutDecision {
  const requested = input.requestedEnv?.trim()
  if (!requested) return deny('paypal_env_missing')
  if (requested !== 'live') return deny('paypal_env_not_live')
  if (input.runtimeEnv?.trim() !== 'production') return deny('paypal_production_runtime_required')
  if (input.activeApiBase !== PAYPAL_LIVE_API_BASE) return deny('paypal_live_endpoint_inactive')
  if (!input.liveAdapterAvailable) return deny('paypal_live_adapter_unavailable')
  if (!input.platformEnabled) return deny('paypal_disabled')
  if (!input.publicCheckoutFlag) return deny('paypal_public_checkout_off')
  if (!input.companyConfigured) return deny('paypal_not_configured')
  if (input.companyEnvironment !== 'live') return deny('paypal_company_not_live')
  if (!input.companyEnabled) return deny('paypal_company_disabled')
  if (!input.credentialsPresent) return deny('paypal_credentials_missing')
  if (!input.connectionValidated) return deny('paypal_test_required')
  if (!input.webhookConfigured) return deny('paypal_webhook_required')
  return { allowed: true, environment: 'live' }
}

export type InternalSandboxPolicyInput = {
  sandboxRuntimeAllowed: boolean
  platformEnabled: boolean
  companyConfigured: boolean
  companyEnvironment: string | null | undefined
  companyEnabled: boolean
  credentialsPresent: boolean
  /** Authenticated staff session authorized for this invoice's company. */
  internalViewer: boolean
}

export function decideInternalSandboxCheckout(input: InternalSandboxPolicyInput): boolean {
  return (
    input.internalViewer &&
    input.sandboxRuntimeAllowed &&
    input.platformEnabled &&
    input.companyConfigured &&
    input.companyEnvironment === 'sandbox' &&
    input.companyEnabled &&
    input.credentialsPresent
  )
}

export type PaypalCheckoutMode = 'live' | 'internal_sandbox' | 'blocked'

function metadataObject(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {}
}

/**
 * Every PayPal row is Sandbox unless it was explicitly stamped LIVE. Rows
 * written before this stamp existed came from the Sandbox-only adapter.
 */
export function paypalPaymentEnvironment(metadata: unknown): PaypalPaymentEnvironment {
  return metadataObject(metadata).environment === 'live' ? 'live' : 'sandbox'
}

export function isSandboxTestPayment(payment: { provider: string; metadata?: unknown }): boolean {
  return payment.provider === 'paypal' && paypalPaymentEnvironment(payment.metadata) !== 'live'
}

/** Money that really moved: completed, and not a PayPal Sandbox/mock record. */
export function isRealFinancialPayment(payment: {
  provider: string
  status: string
  metadata?: unknown
}): boolean {
  return payment.status === 'completed' && !isSandboxTestPayment(payment)
}

export function isRecordedSandboxTestCapture(payment: {
  provider: string
  status: string
  metadata?: unknown
  provider_capture_id?: string | null
}): boolean {
  return (
    isSandboxTestPayment(payment) &&
    payment.status === SANDBOX_TEST_CAPTURE_STATUS &&
    metadataObject(payment.metadata).test_transaction === true &&
    Boolean(payment.provider_capture_id)
  )
}

/** Sandbox capture that is visible in Sandbox Control (new TEST rows + legacy completed). */
export function isSandboxCapturedPayment(payment: {
  provider: string
  status: string
  metadata?: unknown
  provider_capture_id?: string | null
}): boolean {
  return (
    isRecordedSandboxTestCapture(payment) ||
    (isSandboxTestPayment(payment) && payment.status === 'completed')
  )
}

/**
 * Stored environment must match the environment that is now attempting to
 * capture/confirm the order. Any mismatch fails closed.
 */
export function paypalEnvironmentMatches(
  storedMetadata: unknown,
  current: PaypalPaymentEnvironment,
): boolean {
  return paypalPaymentEnvironment(storedMetadata) === current
}

export function sandboxAmountByInvoice(
  payments: Array<{ invoice_id: string | null; provider: string; status: string; amount: number; metadata?: unknown }>,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const payment of payments) {
    if (!payment.invoice_id || payment.status !== 'completed') continue
    if (!isSandboxTestPayment(payment)) continue
    map.set(
      payment.invoice_id,
      Math.round(((map.get(payment.invoice_id) ?? 0) + Number(payment.amount || 0)) * 100) / 100,
    )
  }
  return map
}

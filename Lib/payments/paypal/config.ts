import 'server-only'

export const PAYPAL_ORDERS_API_VERSION = 'v2'
export const PAYPAL_JS_SDK_VERSION = '5'

export type PaypalEnvironment = 'sandbox' | 'live'

export type PaypalRuntimeConfig = {
  enabled: boolean
  publicCheckout: boolean
  environment: PaypalEnvironment
  clientId: string | null
  hasSecret: boolean
  webhookId: string | null
  liveBlocked: boolean
  productionBlocked: boolean
  credentialsPresent: boolean
  mode: 'disabled' | 'mock' | 'sandbox'
}

function read(name: string): string | null {
  const value = process.env[name]?.trim()
  return value || null
}

function enabledUnlessExplicitlyFalse(name: string): boolean {
  return read(name)?.toLowerCase() !== 'false'
}

function sandboxRuntimeAllowed(): boolean {
  const vercelEnv = read('VERCEL_ENV')?.toLowerCase()
  if (vercelEnv) return vercelEnv !== 'production'
  return process.env.NODE_ENV !== 'production'
}

/**
 * DEV/Preview + Sandbox only. Production is denied independently of copied env flags.
 * In non-production, the company provider is the primary kill switch. Optional env
 * flags can still force-disable PayPal globally by setting them to `false`.
 */
export function readPaypalRuntimeConfig(): PaypalRuntimeConfig {
  const requestedEnv = (read('PAYPAL_ENV') || 'sandbox').toLowerCase()
  const liveBlocked = requestedEnv === 'live'
  const productionBlocked = !sandboxRuntimeAllowed()
  const environment: PaypalEnvironment = 'sandbox'
  const enabledFlag =
    enabledUnlessExplicitlyFalse('PAYPAL_ENABLED') && !liveBlocked && !productionBlocked
  const clientId = read('PAYPAL_CLIENT_ID')
  const hasSecret = Boolean(read('PAYPAL_CLIENT_SECRET'))
  const credentialsPresent = Boolean(clientId && hasSecret)
  const webhookId = read('PAYPAL_WEBHOOK_ID')
  const publicCheckout =
    enabledFlag &&
    enabledUnlessExplicitlyFalse('PAYPAL_PUBLIC_CHECKOUT') &&
    !liveBlocked &&
    !productionBlocked
  const mode: PaypalRuntimeConfig['mode'] = !enabledFlag
    ? 'disabled'
    : credentialsPresent
      ? 'sandbox'
      : 'mock'

  return {
    enabled: enabledFlag,
    publicCheckout,
    environment,
    clientId,
    hasSecret,
    webhookId,
    liveBlocked,
    productionBlocked,
    credentialsPresent,
    mode,
  }
}

export function paypalApiBase(environment: PaypalEnvironment = 'sandbox') {
  return environment === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'
}

export function assertSandboxOnly(config = readPaypalRuntimeConfig()) {
  if (config.productionBlocked) throw new Error('PAYPAL_PRODUCTION_BLOCKED')
  if (config.liveBlocked) throw new Error('PAYPAL_LIVE_BLOCKED')
  if (config.environment !== 'sandbox') throw new Error('PAYPAL_SANDBOX_REQUIRED')
}

export function readPaypalClientSecret(): string | null {
  return read('PAYPAL_CLIENT_SECRET')
}

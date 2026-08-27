import 'server-only'

export const PAYPAL_ORDERS_API_VERSION = 'v2'
export const PAYPAL_JS_SDK_VERSION = '6'

export type PaypalEnvironment = 'sandbox' | 'live'

export type PaypalRuntimeConfig = {
  enabled: boolean
  publicCheckout: boolean
  environment: PaypalEnvironment
  clientId: string | null
  hasSecret: boolean
  webhookId: string | null
  liveBlocked: boolean
  credentialsPresent: boolean
  mode: 'disabled' | 'mock' | 'sandbox'
}

function flag(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === 'true'
}

function read(name: string): string | null {
  const value = process.env[name]?.trim()
  return value || null
}

/** Live PayPal is refused in this foundation. Sandbox only. */
export function readPaypalRuntimeConfig(): PaypalRuntimeConfig {
  const requestedEnv = (read('PAYPAL_ENV') || 'sandbox').toLowerCase()
  const liveBlocked = requestedEnv === 'live'
  const environment: PaypalEnvironment = 'sandbox'
  const enabledFlag = flag('PAYPAL_ENABLED') && !liveBlocked
  const clientId = read('PAYPAL_CLIENT_ID')
  const hasSecret = Boolean(read('PAYPAL_CLIENT_SECRET'))
  const credentialsPresent = Boolean(clientId && hasSecret)
  const webhookId = read('PAYPAL_WEBHOOK_ID')
  const publicCheckoutRequested = enabledFlag && flag('PAYPAL_PUBLIC_CHECKOUT')
  // This round: public checkout stays off even if the env flag is set.
  const publicCheckout = publicCheckoutRequested && false
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
  if (config.liveBlocked) {
    throw new Error('PAYPAL_LIVE_BLOCKED')
  }
  if (config.environment !== 'sandbox') {
    throw new Error('PAYPAL_SANDBOX_REQUIRED')
  }
}

export function readPaypalClientSecret(): string | null {
  return read('PAYPAL_CLIENT_SECRET')
}

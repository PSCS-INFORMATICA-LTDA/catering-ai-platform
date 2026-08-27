import 'server-only'

import {
  assertSandboxOnly,
  paypalApiBase,
  readPaypalClientSecret,
  readPaypalRuntimeConfig,
  type PaypalRuntimeConfig,
} from './config'

export type PaypalCreateOrderInput = {
  companyId: string
  invoiceId: string
  invoiceNumber: string
  amount: number
  currency: string
  purpose: 'deposit' | 'balance' | 'full'
  requestId: string
}

export type PaypalOrderResult = {
  provider: 'paypal'
  environment: 'sandbox'
  orderId: string
  status: string
  mock: boolean
}

export type PaypalCaptureResult = PaypalOrderResult & {
  captureId: string
  amount: number
  currency: string
}

export interface PaypalOrdersAdapter {
  createOrder(input: PaypalCreateOrderInput): Promise<PaypalOrderResult>
  captureOrder(input: {
    orderId: string
    requestId: string
  }): Promise<PaypalCaptureResult>
}

const mockOrders = new Map<string, PaypalCreateOrderInput>()

export class MockPaypalAdapter implements PaypalOrdersAdapter {
  async createOrder(input: PaypalCreateOrderInput): Promise<PaypalOrderResult> {
    const orderId = `MOCK-ORDER-${input.requestId.slice(0, 18)}`
    mockOrders.set(orderId, input)
    return {
      provider: 'paypal',
      environment: 'sandbox',
      orderId,
      status: 'CREATED',
      mock: true,
    }
  }

  async captureOrder(input: {
    orderId: string
    requestId: string
  }): Promise<PaypalCaptureResult> {
    const created = mockOrders.get(input.orderId)
    if (!created) {
      throw new Error('PAYPAL_ORDER_NOT_FOUND')
    }
    return {
      provider: 'paypal',
      environment: 'sandbox',
      orderId: input.orderId,
      captureId: `MOCK-CAPTURE-${input.requestId.slice(0, 16)}`,
      status: 'COMPLETED',
      amount: created.amount,
      currency: created.currency,
      mock: true,
    }
  }
}

async function paypalAccessToken(clientId: string, secret: string) {
  const response = await fetch(`${paypalApiBase('sandbox')}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })
  const data = (await response.json().catch(() => null)) as {
    access_token?: string
  } | null
  if (!response.ok || !data?.access_token) {
    throw new Error('PAYPAL_AUTH_FAILED')
  }
  return data.access_token
}

export class SandboxPaypalAdapter implements PaypalOrdersAdapter {
  constructor(
    private readonly clientId: string,
    private readonly secret: string,
  ) {}

  async createOrder(input: PaypalCreateOrderInput): Promise<PaypalOrderResult> {
    assertSandboxOnly()
    const token = await paypalAccessToken(this.clientId, this.secret)
    const response = await fetch(`${paypalApiBase('sandbox')}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': input.requestId,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: input.invoiceId,
            invoice_id: input.invoiceNumber,
            custom_id: `${input.companyId}:${input.purpose}`,
            amount: {
              currency_code: input.currency,
              value: input.amount.toFixed(2),
            },
          },
        ],
      }),
      cache: 'no-store',
    })
    const data = (await response.json().catch(() => null)) as {
      id?: string
      status?: string
    } | null
    if (!response.ok || !data?.id) {
      throw new Error('PAYPAL_CREATE_ORDER_FAILED')
    }
    return {
      provider: 'paypal',
      environment: 'sandbox',
      orderId: data.id,
      status: data.status || 'CREATED',
      mock: false,
    }
  }

  async captureOrder(input: {
    orderId: string
    requestId: string
  }): Promise<PaypalCaptureResult> {
    assertSandboxOnly()
    const token = await paypalAccessToken(this.clientId, this.secret)
    const response = await fetch(
      `${paypalApiBase('sandbox')}/v2/checkout/orders/${encodeURIComponent(input.orderId)}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': input.requestId,
          Prefer: 'return=representation',
        },
        cache: 'no-store',
      },
    )
    const data = (await response.json().catch(() => null)) as {
      id?: string
      status?: string
      purchase_units?: Array<{
        payments?: {
          captures?: Array<{
            id?: string
            amount?: { value?: string; currency_code?: string }
          }>
        }
      }>
    } | null
    const capture = data?.purchase_units?.[0]?.payments?.captures?.[0]
    if (!response.ok || !data?.id || !capture?.id) {
      throw new Error('PAYPAL_CAPTURE_FAILED')
    }
    return {
      provider: 'paypal',
      environment: 'sandbox',
      orderId: data.id,
      captureId: capture.id,
      status: data.status || 'COMPLETED',
      amount: Number(capture.amount?.value || 0),
      currency: capture.amount?.currency_code || 'USD',
      mock: false,
    }
  }
}

export async function getPaypalSandboxAccessToken(): Promise<string | null> {
  const config = readPaypalRuntimeConfig()
  const secret = readPaypalClientSecret()
  if (!config.clientId || !secret) return null
  try {
    return await paypalAccessToken(config.clientId, secret)
  } catch {
    return null
  }
}

export function createPaypalAdapter(
  config: PaypalRuntimeConfig = readPaypalRuntimeConfig(),
): PaypalOrdersAdapter {
  assertSandboxOnly(config)
  if (config.mode === 'sandbox' && config.clientId) {
    const secret = readPaypalClientSecret()
    if (secret) return new SandboxPaypalAdapter(config.clientId, secret)
  }
  return new MockPaypalAdapter()
}

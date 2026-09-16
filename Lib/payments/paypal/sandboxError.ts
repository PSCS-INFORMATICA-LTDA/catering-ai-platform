export type PaypalSandboxIssue = {
  code: string
  httpStatus: number | null
  paypalName: string | null
  debugId: string | null
  issue: string | null
  captureStatus: string | null
  orderId: string | null
  alreadyCaptured: boolean
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export function readPaypalDebugIdHeader(
  headers: { get(name: string): string | null } | null | undefined,
): string | null {
  if (!headers) return null
  return (
    asString(headers.get('paypal-debug-id')) ||
    asString(headers.get('PayPal-Debug-Id')) ||
    null
  )
}

export function parsePaypalSandboxError(input: {
  httpStatus?: number | null
  debugIdHeader?: string | null
  body?: unknown
  fallbackCode: string
  orderId?: string | null
}): PaypalSandboxIssue {
  const body = asRecord(input.body)
  const name = asString(body.name) || asString(body.error)
  const debugId = asString(body.debug_id) || asString(input.debugIdHeader)
  const details = Array.isArray(body.details) ? body.details : []
  const firstDetail = asRecord(details[0])
  const issue = asString(firstDetail.issue)
  const alreadyCaptured =
    issue === 'ORDER_ALREADY_CAPTURED' || name === 'ORDER_ALREADY_CAPTURED'

  return {
    code: alreadyCaptured ? 'PAYPAL_ORDER_ALREADY_CAPTURED' : input.fallbackCode,
    httpStatus: Number.isFinite(Number(input.httpStatus))
      ? Number(input.httpStatus)
      : null,
    paypalName: name,
    debugId,
    issue,
    captureStatus: asString(body.status),
    orderId: asString(input.orderId) || asString(body.id),
    alreadyCaptured,
  }
}

export class PaypalSandboxRequestError extends Error {
  readonly issue: PaypalSandboxIssue

  constructor(issue: PaypalSandboxIssue) {
    super(issue.code)
    this.name = 'PaypalSandboxRequestError'
    this.issue = issue
  }
}

export function isPaypalSandboxRequestError(
  error: unknown,
): error is PaypalSandboxRequestError {
  return error instanceof PaypalSandboxRequestError
}

export function issueFromUnknownCaptureError(
  error: unknown,
  orderId: string | null,
): PaypalSandboxIssue {
  if (isPaypalSandboxRequestError(error)) return error.issue
  return {
    code: 'PAYPAL_CAPTURE_FAILED',
    httpStatus: null,
    paypalName: null,
    debugId: null,
    issue: null,
    captureStatus: null,
    orderId,
    alreadyCaptured: false,
  }
}

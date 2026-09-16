const FORBIDDEN_KEY_RE =
  /secret|password|token|authorization|bearer|card|cvv|pan|access_token|client_secret|buyer|wrap_key|ciphertext/i

const ALLOWED_KEYS = new Set([
  'action',
  'requestId',
  'invoiceId',
  'purpose',
  'orderId',
  'environment',
  'httpStatus',
  'paypalName',
  'debugId',
  'captureStatus',
  'issue',
  'result',
])

function looksLikeSecretValue(value: string) {
  if (/Bearer\s+\S+/i.test(value)) return true
  if (/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(value)) return true
  if (/(?:^|\s)(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})(?:\s|$)/.test(value)) {
    return true
  }
  return false
}

export function sanitizePaypalSandboxLog(
  input: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = { environment: 'sandbox' }
  if (!input || typeof input !== 'object') return sanitized

  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN_KEY_RE.test(key)) continue
    if (!ALLOWED_KEYS.has(key)) continue
    if (value == null) continue
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      continue
    }
    if (typeof value === 'string') {
      if (looksLikeSecretValue(value)) continue
      sanitized[key] = value.slice(0, 120)
      continue
    }
    sanitized[key] = value
  }

  sanitized.environment = 'sandbox'
  return sanitized
}

export function logPaypalSandbox(input: Record<string, unknown>) {
  const sanitized = sanitizePaypalSandboxLog(input)
  console.info('[paypal-sandbox]', JSON.stringify(sanitized))
  return sanitized
}

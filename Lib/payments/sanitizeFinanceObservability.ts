const SENSITIVE_KEY_RE =
  /secret|password|token|authorization|vault|webhook_route_key|webhookRouteKey|access_token|refresh_token|bearer|buyer|ciphertext|wrap_key|route_key/i

const PAYMENT_METADATA_ALLOWLIST = new Set([
  'eventType',
  'eventId',
  'verifiedAmount',
  'verifiedCurrency',
  'paypal_order_status',
  'paypal_capture_status',
  'intent',
  'source',
  'environment',
  'purpose',
  'schedule_hold_id',
  'schedule_hold_status',
  'confirmation_channel',
  'payer_status',
])

const OUTBOX_PAYLOAD_ALLOWLIST = new Set([
  'invoice_id',
  'invoice_number',
  'invoice_kind',
  'parent_invoice_id',
  'service_order_id',
  'closeout_id',
  'quote_id',
  'quote_number',
  'payment_id',
  'provider',
  'provider_order_id',
  'provider_capture_id',
  'purpose',
  'amount',
  'currency',
  'occurred_at',
])

const FORBIDDEN_LEAK_KEYS = [
  'client_secret',
  'clientSecret',
  'token_hash',
  'tokenHash',
  'webhook_route_key',
  'webhookRouteKey',
  'buyer_password',
  'buyerPassword',
  'access_token',
  'accessToken',
  'authorization',
  'Authorization',
]

export function isSensitiveFinanceKey(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key)
}

export function summarizeIdempotencyKey(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  if (trimmed.length <= 16) return trimmed
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`
}

export function sanitizePaymentMetadataForBackoffice(
  metadata: unknown,
): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {}
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (isSensitiveFinanceKey(key)) continue
    if (!PAYMENT_METADATA_ALLOWLIST.has(key)) continue
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      sanitized[key] = value
    }
  }
  return sanitized
}

export function sanitizeJsonForObservability(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated]'
  if (Array.isArray(value)) {
    return value.slice(0, 40).map((item) => sanitizeJsonForObservability(item, depth + 1))
  }
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveFinanceKey(key)) continue
      output[key] = sanitizeJsonForObservability(nested, depth + 1)
    }
    return output
  }
  if (typeof value === 'string' && looksLikeSecretValue(value)) {
    return '[redacted]'
  }
  return value
}

export function sanitizeOutboxPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {}
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (isSensitiveFinanceKey(key)) continue
    if (!OUTBOX_PAYLOAD_ALLOWLIST.has(key)) continue
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      sanitized[key] = value
    }
  }
  return sanitized
}

export function sanitizePaypalProviderForObservability(input: {
  enabled: boolean
  environment: string | null | undefined
  publicClientId: string | null | undefined
  webhookRouteKey: string | null | undefined
  metadata: unknown
  secretConfigured: boolean
}): {
  enabled: boolean
  environment: string
  sandbox: boolean
  connection_status: string
  credentials_configured: boolean
  public_client_id_state: 'configured' | 'missing'
  webhook_configured: boolean
  last_tested_at: string | null
  last_test_status: string | null
} {
  const metadata =
    input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
      ? (input.metadata as Record<string, unknown>)
      : {}
  const environment = String(input.environment || '').trim().toLowerCase() || 'unknown'
  const publicClientConfigured = Boolean(String(input.publicClientId || '').trim())
  return {
    enabled: input.enabled === true,
    environment,
    sandbox: environment === 'sandbox',
    connection_status: String(metadata.connection_status || (publicClientConfigured && input.secretConfigured ? 'configured' : 'not_configured')),
    credentials_configured: publicClientConfigured && input.secretConfigured,
    public_client_id_state: publicClientConfigured ? 'configured' : 'missing',
    webhook_configured: Boolean(metadata.webhook_id) || Boolean(String(input.webhookRouteKey || '').trim()),
    last_tested_at: metadata.last_tested_at ? String(metadata.last_tested_at) : null,
    last_test_status: metadata.last_test_status ? String(metadata.last_test_status) : null,
  }
}

export function collectSensitiveFinanceLeaks(value: unknown): string[] {
  const found = new Set<string>()
  walkForLeaks(value, found)
  return [...found]
}

function walkForLeaks(value: unknown, found: Set<string>, depth = 0) {
  if (depth > 8 || value == null) return
  if (typeof value === 'string') {
    for (const key of FORBIDDEN_LEAK_KEYS) {
      if (value.includes(key)) found.add(key)
    }
    return
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 80)) walkForLeaks(item, found, depth + 1)
    return
  }
  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_LEAK_KEYS.includes(key)) found.add(key)
      walkForLeaks(nested, found, depth + 1)
    }
  }
}

function looksLikeSecretValue(value: string) {
  if (/Bearer\s+\S+/i.test(value)) return true
  if (/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(value)) return true
  return false
}

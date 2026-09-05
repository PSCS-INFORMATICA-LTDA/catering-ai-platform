export type SanitizedProviderError = {
  status: string | null
  code: string
  type: string | null
}

const ALLOWED_CODES = new Set([
  'openai_api_key_missing',
  'invalid_api_key',
  'insufficient_quota',
  'credit_balance_exhausted',
  'project_spend_limit_exceeded',
  'model_not_found',
  'timeout',
  'unknown_provider_error',
])

const ALLOWED_TYPES = new Set([
  'missing_env',
  'invalid_request_error',
  'authentication_error',
  'permission_error',
  'rate_limit_error',
  'timeout',
  'api_error',
  'unknown_provider_error',
])

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function readStatus(error: unknown): number | null {
  const record = asRecord(error)
  const raw = record?.status
  const status = typeof raw === 'number' ? raw : Number(raw)
  if (Number.isInteger(status) && status >= 100 && status <= 599) return status
  return null
}

function readString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function nestedError(error: unknown): Record<string, unknown> | null {
  const record = asRecord(error)
  return asRecord(record?.error)
}

/** Use only for classification. Never persist or return to the client. */
function classifyHaystack(error: unknown): string {
  const record = asRecord(error)
  const nested = nestedError(error)
  const message =
    error instanceof Error
      ? error.message.replace(/sk-[a-zA-Z0-9_-]+/gi, '[redacted]').slice(0, 180)
      : ''
  return [
    record?.code,
    record?.type,
    nested?.code,
    nested?.type,
    nested?.message,
    message,
  ]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase()
}

function sanitizeCode(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/[^\w]+/g, '_')
  return ALLOWED_CODES.has(normalized) ? normalized : null
}

function sanitizeType(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/[^\w]+/g, '_')
  return ALLOWED_TYPES.has(normalized) ? normalized : null
}

export function classifyProviderError(error: unknown): SanitizedProviderError {
  if (error instanceof Error && error.message === 'openai_api_key_missing') {
    return { status: null, code: 'openai_api_key_missing', type: 'missing_env' }
  }

  const record = asRecord(error)
  const nested = nestedError(error)
  const status = readStatus(error)
  const rawCode = readString(record?.code, nested?.code)
  const rawType = readString(record?.type, nested?.type)
  const hay = classifyHaystack(error)

  if (status === 401 || /invalid_api_key|unauthorized|authentication/i.test(hay)) {
    return {
      status: String(status ?? 401),
      code: 'invalid_api_key',
      type: sanitizeType(rawType) ?? 'authentication_error',
    }
  }
  if (/credit_balance_exhausted|insufficient_funds|credit balance/i.test(hay)) {
    return {
      status: status ? String(status) : '429',
      code: 'credit_balance_exhausted',
      type: sanitizeType(rawType) ?? 'rate_limit_error',
    }
  }
  if (/project_spend_limit/i.test(hay)) {
    return {
      status: status ? String(status) : '429',
      code: 'project_spend_limit_exceeded',
      type: sanitizeType(rawType) ?? 'rate_limit_error',
    }
  }
  if (status === 429 || /insufficient_quota|rate[_ ]limit/i.test(hay)) {
    return {
      status: '429',
      code: 'insufficient_quota',
      type: sanitizeType(rawType) ?? 'rate_limit_error',
    }
  }
  if (
    status === 404 ||
    /model_not_found|does not exist|unknown model|invalid model/i.test(hay)
  ) {
    return {
      status: String(status ?? 404),
      code: 'model_not_found',
      type: sanitizeType(rawType) ?? 'invalid_request_error',
    }
  }
  if (/timeout|etimedout|timed out/i.test(hay)) {
    return { status: status ? String(status) : null, code: 'timeout', type: 'timeout' }
  }

  return {
    status: status ? String(status) : null,
    code: sanitizeCode(rawCode) ?? 'unknown_provider_error',
    type: sanitizeType(rawType) ?? 'unknown_provider_error',
  }
}

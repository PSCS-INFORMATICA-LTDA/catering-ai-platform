/**
 * Accept only same-origin relative paths (block open redirects).
 * Rejects protocol-relative (`//…`), backslashes, and non-path values.
 */
export function safeInternalNext(
  value: string | null | undefined,
  fallback = '/quotes',
): string {
  if (!value) return fallback
  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) return fallback
  if (trimmed.startsWith('//')) return fallback
  if (trimmed.includes('\\')) return fallback
  if (trimmed.includes('://')) return fallback
  if (/[\x00-\x1f]/.test(trimmed)) return fallback
  return trimmed
}

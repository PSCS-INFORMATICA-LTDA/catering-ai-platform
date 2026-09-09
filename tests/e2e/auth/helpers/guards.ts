import { PROTECTED_EMAIL_PATTERNS, PROD_SUPABASE_REF, QA_EMAIL_PREFIX } from './constants'

export function assertQaEmail(email: string): void {
  const normalized = email.trim().toLowerCase()
  if (!normalized.startsWith(QA_EMAIL_PREFIX) || !normalized.endsWith('@gmail.com')) {
    throw new Error(`Refusing non-QA email: ${maskEmail(normalized)}`)
  }
  for (const pattern of PROTECTED_EMAIL_PATTERNS) {
    if (pattern.test(normalized)) {
      throw new Error(`Refusing protected email pattern: ${maskEmail(normalized)}`)
    }
  }
}

export function assertDevSupabaseRef(url: string): void {
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]
  if (ref === PROD_SUPABASE_REF) {
    throw new Error('PROD Supabase ref detected — aborting')
  }
  if (ref !== 'yasprgtlqclwsjcshtls') {
    throw new Error(`Refusing non-DEV Supabase ref: ${ref ?? 'unknown'}`)
  }
}

export function assertDevBaseUrl(baseUrl: string): void {
  const host = new URL(baseUrl).hostname
  if (host.includes('eapwtirhevxrqinytans') || host.includes('cateringai.app')) {
    throw new Error(`Refusing PROD-like host: ${host}`)
  }
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!domain) return '(invalid)'
  const visible = user.length <= 4 ? user[0] : user.slice(0, 4)
  return `${visible}***@${domain}`
}

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    for (const key of ['token', 'code', 'access_token', 'refresh_token', 'token_hash']) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, '[REDACTED]')
      }
    }
    return parsed.toString()
  } catch {
    return '[invalid-url]'
  }
}

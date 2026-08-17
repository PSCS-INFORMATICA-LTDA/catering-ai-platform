import 'server-only'

import { createHash, createHmac, randomBytes } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'
import { PUBLIC_QUOTE_LOCALES, type PublicQuoteLocale } from './types'

export const PUBLIC_QUOTE_COOKIE = 'catering_public_quote'
export const PUBLIC_QUOTE_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
export const MAX_PUBLIC_QUOTE_JSON_BYTES = 96 * 1024
export const MAX_PUBLIC_QUOTE_IMAGE_BYTES = 5 * 1024 * 1024
export const PUBLIC_QUOTE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

export class PublicQuoteHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code:
      | 'invalid_payload'
      | 'invalid_origin'
      | 'not_found'
      | 'expired'
      | 'rate_limited'
      | 'already_submitted'
      | 'conflict'
      | 'server_error',
    message = code,
  ) {
    super(message)
  }
}

export function parsePublicQuoteLocale(value: unknown): PublicQuoteLocale | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return PUBLIC_QUOTE_LOCALES.includes(normalized as PublicQuoteLocale)
    ? (normalized as PublicQuoteLocale)
    : null
}

export function normalizePublicCompanySlug(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(normalized)
    ? normalized
    : null
}

export function createPublicSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function stableJsonHash(value: unknown): string {
  return sha256(JSON.stringify(value))
}

export function requestFingerprint(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = request.headers.get('x-real-ip')?.trim()
  const agent = request.headers.get('user-agent')?.slice(0, 200) || 'unknown'
  const secret =
    process.env.PUBLIC_QUOTE_FINGERPRINT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new PublicQuoteHttpError(500, 'server_error')
  }
  return createHmac('sha256', secret)
    .update(`${forwarded || realIp || 'unknown'}|${agent}`)
    .digest('hex')
}

export function assertRequestOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin) return
  const requestUrl = new URL(request.url)
  const expectedOrigins = new Set([requestUrl.origin])
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost || request.headers.get('host')?.trim()
  const forwardedProtocol = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
  if (host) {
    expectedOrigins.add(`${forwardedProtocol || requestUrl.protocol.slice(0, -1)}://${host}`)
  }
  if (expectedOrigins.has(origin)) return

  if (process.env.NODE_ENV !== 'production' && URL.canParse(origin)) {
    const supplied = new URL(origin)
    const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]'])
    const expectedIsLoopback = loopbackHosts.has(requestUrl.hostname)
    const suppliedIsLoopback = loopbackHosts.has(supplied.hostname)
    if (
      expectedIsLoopback &&
      suppliedIsLoopback &&
      supplied.protocol === requestUrl.protocol &&
      supplied.port === requestUrl.port
    ) {
      return
    }
  }

  throw new PublicQuoteHttpError(403, 'invalid_origin')
}

export async function readLimitedJson<T>(
  request: NextRequest,
  maxBytes = MAX_PUBLIC_QUOTE_JSON_BYTES,
): Promise<T> {
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (declaredLength > maxBytes) {
    throw new PublicQuoteHttpError(413, 'invalid_payload')
  }
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new PublicQuoteHttpError(413, 'invalid_payload')
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new PublicQuoteHttpError(400, 'invalid_payload')
  }
}

export function assertHoneypot(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    throw new PublicQuoteHttpError(400, 'invalid_payload')
  }
}

export function setPublicSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
) {
  response.cookies.set(PUBLIC_QUOTE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    maxAge: PUBLIC_QUOTE_SESSION_TTL_SECONDS,
  })
}

export function clearPublicSessionCookie(response: NextResponse) {
  response.cookies.set(PUBLIC_QUOTE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export function publicErrorResponse(error: unknown): {
  status: number
  body: { error: string; code: string }
} {
  if (error instanceof PublicQuoteHttpError) {
    return {
      status: error.status,
      body: { error: 'Request could not be processed.', code: error.code },
    }
  }
  console.error('[public-quote] request failed', {
    name: error instanceof Error ? error.name : 'unknown',
  })
  return {
    status: 500,
    body: { error: 'Request could not be processed.', code: 'server_error' },
  }
}

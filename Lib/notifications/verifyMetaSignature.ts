import { createHmac, timingSafeEqual } from 'node:crypto'

const HEX_PREFIX = 'sha256='

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export function metaAppSecret() {
  return (
    process.env.WHATSAPP_APP_SECRET?.trim() ||
    process.env.META_APP_SECRET?.trim() ||
    process.env.FACEBOOK_APP_SECRET?.trim() ||
    ''
  )
}

export function computeMetaSignatureHex(rawBody: string | Uint8Array, appSecret: string) {
  const hmac = createHmac('sha256', appSecret)
  hmac.update(typeof rawBody === 'string' ? rawBody : Buffer.from(rawBody))
  return hmac.digest('hex')
}

/** Verify X-Hub-Signature-256 over the raw POST body. GET verify token is not a substitute. */
export function verifyMetaHubSignature(input: {
  rawBody: string | Uint8Array
  signatureHeader: string | null | undefined
  appSecret?: string | null
}): { ok: true } | { ok: false; error: string } {
  const secret = String(input.appSecret || '').trim() || metaAppSecret()
  if (!secret) {
    return { ok: false, error: 'meta_app_secret_missing' }
  }
  const header = String(input.signatureHeader || '').trim()
  if (!header) {
    return { ok: false, error: 'signature_missing' }
  }
  const provided = header.startsWith(HEX_PREFIX) ? header.slice(HEX_PREFIX.length) : header
  if (!/^[0-9a-fA-F]+$/.test(provided) || provided.length % 2 !== 0) {
    return { ok: false, error: 'signature_invalid' }
  }
  const expectedHex = computeMetaSignatureHex(input.rawBody, secret)
  const providedBytes = hexToBytes(provided.toLowerCase())
  const expectedBytes = hexToBytes(expectedHex)
  if (providedBytes.length !== expectedBytes.length) {
    return { ok: false, error: 'signature_invalid' }
  }
  if (!timingSafeEqual(providedBytes, expectedBytes)) {
    return { ok: false, error: 'signature_invalid' }
  }
  return { ok: true }
}

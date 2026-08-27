import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

function wrapKey() {
  const material =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.PAYPAL_SECRET_WRAP_KEY ||
    'catering-dev-secret-wrap'
  return createHash('sha256').update(material).digest()
}

export function encryptProviderSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', wrapKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptProviderSecret(ciphertext: string): string {
  const raw = Buffer.from(ciphertext, 'base64')
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const encrypted = raw.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', wrapKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export async function storeCompanyPaypalSecret(
  companyId: string,
  secret: string,
): Promise<{ id: string }> {
  const ciphertext = encryptProviderSecret(secret)
  const { data, error } = await getSupabaseServerClient().rpc(
    'store_company_paypal_secret',
    { p_company_id: companyId, p_ciphertext: ciphertext },
  )
  if (error || !data) {
    throw new Error(error?.message || 'secret_store_failed')
  }
  return { id: String(data) }
}

export async function loadCompanyPaypalSecret(
  companyId: string,
): Promise<string | null> {
  const { data, error } = await getSupabaseServerClient().rpc(
    'read_company_paypal_secret',
    { p_company_id: companyId },
  )
  if (error || !data) return null
  try {
    return decryptProviderSecret(String(data))
  } catch {
    return null
  }
}

export async function hasCompanyPaypalSecret(companyId: string): Promise<boolean> {
  const { data } = await getSupabaseServerClient().rpc(
    'read_company_paypal_secret',
    { p_company_id: companyId },
  )
  return Boolean(data)
}

import {
  CATERING_DEV_SUPABASE_REF,
  CATERING_PROD_SUPABASE_REF,
  supabaseProjectRefFromUrl,
} from '../pscs-one/devSupabaseGuard.ts'

export const BRASINHA_WHATSAPP_ENV_NAMES = [
  'WHATSAPP_ENABLED',
  'WHATSAPP_PROVIDER',
  'META_WHATSAPP_PHONE_NUMBER_ID',
  'META_WHATSAPP_BUSINESS_ACCOUNT_ID',
  'META_WHATSAPP_ACCESS_TOKEN',
  'META_WHATSAPP_VERIFY_TOKEN',
  'META_APP_SECRET',
] as const

export function supabaseRefFromEnv(
  source: Record<string, string | undefined> = process.env,
): string | null {
  return supabaseProjectRefFromUrl(source.NEXT_PUBLIC_SUPABASE_URL)
}

/** Simulator and write-adjacent APIs never run against PROD or Vercel production. */
export function isBrasinhaDevRuntimeAllowed(
  source: Record<string, string | undefined> = process.env,
): boolean {
  const ref = supabaseRefFromEnv(source)
  if (!ref || ref === CATERING_PROD_SUPABASE_REF) return false
  if (source.VERCEL_ENV === 'production') return false
  return ref === CATERING_DEV_SUPABASE_REF
}

export function isWhatsAppChannelEnabled(
  source: Record<string, string | undefined> = process.env,
): boolean {
  return false && source.WHATSAPP_ENABLED === 'true'
}

export function assertBrasinhaDevRuntime(
  source: Record<string, string | undefined> = process.env,
): void {
  if (!isBrasinhaDevRuntimeAllowed(source)) {
    throw new Error('brasinha_dev_runtime_forbidden')
  }
}

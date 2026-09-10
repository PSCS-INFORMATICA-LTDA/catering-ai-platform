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

/**
 * Sidebar / DEV entry. Hidden when the runtime is PROD or not Catering DEV.
 * Read NEXT_PUBLIC_* via static access so the client bundle keeps the inlined values.
 * Spreading `process.env` in the browser drops those keys.
 */
export function isBrasinhaDevNavVisible(
  source: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  },
): boolean {
  return isBrasinhaDevRuntimeAllowed({
    ...source,
    VERCEL_ENV: source.VERCEL_ENV || source.NEXT_PUBLIC_VERCEL_ENV,
  })
}

export function assertBrasinhaDevRuntime(
  source: Record<string, string | undefined> = process.env,
): void {
  if (!isBrasinhaDevRuntimeAllowed(source)) {
    throw new Error('brasinha_dev_runtime_forbidden')
  }
}

export const BRASINHA_AI_PROVIDER_DEFAULT = 'openai'
export const BRASINHA_OPENAI_MODEL_DEFAULT = 'gpt-5.6-luna'

/** Server-side only. Off unless explicitly `true` so tests run without a provider. */
export function isBrasinhaAiEnabled(
  source: Record<string, string | undefined> = process.env,
): boolean {
  return source.BRASINHA_AI_ENABLED === 'true'
}

export function resolveBrasinhaAiProvider(
  source: Record<string, string | undefined> = process.env,
): string {
  return source.BRASINHA_AI_PROVIDER?.trim() || BRASINHA_AI_PROVIDER_DEFAULT
}

export function resolveBrasinhaOpenAiModel(
  source: Record<string, string | undefined> = process.env,
): string {
  return source.BRASINHA_OPENAI_MODEL?.trim() || BRASINHA_OPENAI_MODEL_DEFAULT
}

/** Presence only — never return or log the key value. */
export function hasOpenAiApiKey(
  source: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(source.OPENAI_API_KEY?.trim())
}

export function isBrasinhaOpenAiReady(
  source: Record<string, string | undefined> = process.env,
): boolean {
  return (
    isBrasinhaAiEnabled(source) &&
    resolveBrasinhaAiProvider(source) === 'openai' &&
    hasOpenAiApiKey(source)
  )
}

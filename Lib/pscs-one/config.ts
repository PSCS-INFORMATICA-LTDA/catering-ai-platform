import {
  evaluateCateringSsoSupabase,
} from './devSupabaseGuard.ts'

export const PSCS_ONE_MAPPED_COMPANY_COOKIE = 'pscs_one_mapped_company_id'

export function isPscsOneSsoEnabled(
  source: Record<string, string | undefined> = process.env,
): boolean {
  return evaluateCateringSsoSupabase(source).ok
}

export function pscsOneTokenUrl(
  source: Record<string, string | undefined> = process.env,
): string {
  return (
    source.PSCS_ONE_TOKEN_URL?.trim() ||
    'https://pscs-core.vercel.app/api/integrations/sso/token'
  )
}

export function pscsOneClientId(
  source: Record<string, string | undefined> = process.env,
): string {
  return source.PSCS_ONE_CLIENT_ID?.trim() || 'catering_ai'
}

export function pscsOneCallbackUri(
  source: Record<string, string | undefined> = process.env,
): string {
  return (
    source.PSCS_ONE_REDIRECT_URI?.trim() ||
    'https://catering-ai-agenda-dev.vercel.app/auth/pscs-one/callback'
  )
}

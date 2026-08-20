export const CATERING_DEV_SUPABASE_REF = 'yasprgtlqclwsjcshtls'
export const CATERING_PROD_SUPABASE_REF = 'eapwtirhevxrqinytans'

export function supabaseProjectRefFromUrl(url: string | undefined): string | null {
  const match = url?.trim().match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i)
  if (match?.[1]) return match[1]
  const loose = url?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)
  return loose?.[1] ?? null
}

export type CateringSsoSupabaseDecision =
  | { ok: true; ref: string }
  | { ok: false; reason: 'sso_disabled' | 'supabase_prod_forbidden' | 'supabase_project_denied' | 'supabase_url_missing' }

export function evaluateCateringSsoSupabase(
  source: Record<string, string | undefined> = process.env,
): CateringSsoSupabaseDecision {
  if (source.PSCS_ONE_SSO_ENABLED !== 'true') {
    return { ok: false, reason: 'sso_disabled' }
  }
  const ref = supabaseProjectRefFromUrl(source.NEXT_PUBLIC_SUPABASE_URL)
  if (!ref) {
    return { ok: false, reason: 'supabase_url_missing' }
  }
  if (ref === CATERING_PROD_SUPABASE_REF) {
    return { ok: false, reason: 'supabase_prod_forbidden' }
  }
  if (ref !== CATERING_DEV_SUPABASE_REF) {
    return { ok: false, reason: 'supabase_project_denied' }
  }
  return { ok: true, ref }
}

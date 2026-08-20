export function publicPscsOneSsoReason(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'sso_failed'
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, 180)

  if (/service role|sso_admin_unconfigured|admin_unconfigured/i.test(text)) {
    return 'sso_admin_unconfigured'
  }
  if (/pscs_one_user_id|schema cache|could not find the .* column/i.test(text)) {
    return 'identity_schema_mismatch'
  }
  if (/null value in column ["']?company_id/i.test(text)) {
    return 'identity_company_missing'
  }
  if (/already been registered|duplicate key|already exists/i.test(text)) {
    return 'identity_conflict'
  }
  if (/row-level security|violates row-level/i.test(text)) {
    return 'identity_policy_denied'
  }
  if (/redirect url|redirect_to/i.test(text)) {
    return 'session_redirect_denied'
  }
  if (/create_user_failed|user not allowed/i.test(text)) {
    return 'create_user_failed'
  }
  if (/session_link_failed|hashed_token|verifyotp|otp/i.test(text)) {
    return 'session_link_failed'
  }
  if (
    /denied|revoked|expired|replay|invalid|mismatch|conflict|missing|unconfigured|disabled/i.test(
      text,
    )
  ) {
    return text.slice(0, 80)
  }
  return 'sso_failed'
}

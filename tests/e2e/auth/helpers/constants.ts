export const DEV_SUPABASE_REF = 'yasprgtlqclwsjcshtls'
export const PROD_SUPABASE_REF = 'eapwtirhevxrqinytans'
export const CDL_DEV_COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
export const CDL_DEV_COMPANY_NAME = 'CDL Services BBQ At Home DEV'

export const CANONICAL_DEV_URL =
  process.env.E2E_BASE_URL?.trim() ||
  'https://catering-ai-agenda-dev.vercel.app'

export const QA_EMAIL_PREFIX = 'pscs.solutions+catering.qa.'
export const QA_EMAIL_DOMAIN = '@gmail.com'

export const PROTECTED_EMAIL_PATTERNS = [
  /caio/i,
  /dani/i,
  /juninho/i,
  /philippe/i,
  /^pscs\.solutions@/i,
  /caioh381@gmail\.com/i,
  /danielle@/i,
]

export const INVITE_ENTRY = '/api/users (POST)'
export const INVITE_ACCEPTANCE_ENTRY = '/auth/callback'
export const LOGIN_ENTRY = '/login'
export const FORGOT_PASSWORD_ENTRY = '/auth/forgot-password'
export const RESET_PASSWORD_ENTRY = '/auth/reset-password'

export const STATE_FILE = 'tests/e2e/auth/.runtime-state.json'
export const REPORT_FILE = 'tests/e2e/auth/.e2e-report.json'

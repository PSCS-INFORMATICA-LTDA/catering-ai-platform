import { existsSync } from 'fs'
import { execSync } from 'child_process'
import { CANONICAL_DEV_URL, STATE_FILE } from './helpers/constants'
import { assertDevBaseUrl, assertDevSupabaseRef } from './helpers/guards'
import { validateMailboxConnection } from './helpers/mailbox'
import { loadState, mergeReport, saveState, type RuntimeState } from './helpers/report'
import { createQaIdentities, createRunId } from './helpers/testIdentity'
import { assertDevEnvironment } from './helpers/supabaseAdmin'
import { adminSignIn } from './helpers/authFlow'

const CANONICAL_BRANCH = 'feat/brasinha-foundation-v0-dev'
const QA_BRANCH = 'feat/internal-auth-e2e-qa-canonical-dev'

function resolveCanonicalSha(): string {
  try {
    return execSync(`git rev-parse origin/${CANONICAL_BRANCH}`, { encoding: 'utf8' }).trim()
  } catch {
    return '8a2b963ce9d1442e05207f40f17b0277e95a2bd2'
  }
}

function currentHead(): string {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
}

export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required for E2E auth harness')
  assertDevSupabaseRef(url)
  assertDevEnvironment()
  assertDevBaseUrl(CANONICAL_DEV_URL)

  const mailbox = await validateMailboxConnection()
  const adminSession = await adminSignIn().catch((error) => {
    throw new Error(
      `Admin sign-in failed — cannot create/test invites: ${error instanceof Error ? error.message : error}`,
    )
  })

  const resume = process.env.QA_E2E_RESUME === '1' && existsSync(STATE_FILE)
  let state: RuntimeState

  if (resume) {
    state = loadState()
    state.adminSession = adminSession
    state.mailboxAvailable = mailbox.available
    state.mailboxReason = mailbox.reason
    state.mailboxProvider = mailbox.provider
    saveState(state)
  } else {
    const runId = createRunId()
    const { qaUser1, qaUser2, qaUserResend } = createQaIdentities(runId)
    state = {
      runId,
      adminSession,
      mailboxAvailable: mailbox.available,
      mailboxReason: mailbox.reason,
      mailboxProvider: mailbox.provider,
      qaUser1: { email: qaUser1.email, role: qaUser1.role, password: qaUser1.password },
      qaUser2: { email: qaUser2.email, role: qaUser2.role, password: qaUser2.password },
      qaUserResend: {
        email: qaUserResend.email,
        role: qaUserResend.role,
        password: qaUserResend.password,
      },
      emailEvents: [],
    }
    saveState(state)
  }

  const mailboxFinding = mailbox.available
    ? mailbox.reason
    : `${mailbox.reason} Run can be resumed with QA_E2E_RESUME=1 after supplying the real email links.`

  mergeReport({
    canonicalBranch: CANONICAL_BRANCH,
    canonicalSha: resolveCanonicalSha(),
    qaBranch: QA_BRANCH,
    qaHead: currentHead(),
    pr: '',
    qaUser1: state.qaUser1?.email ?? '',
    qaUser1Role: state.qaUser1?.role ?? 'admin',
    qaUser2: state.qaUser2?.email ?? '',
    qaUser2Role: state.qaUser2?.role ?? 'operator',
    mailboxProvider: mailbox.provider,
    emailGateResumable: 'YES',
    smtpRateLimitBlocked: 'NO',
    aggressiveRetry: 'NO',
    emailHumanGateRequired: mailbox.available ? 'NO' : 'YES',
    humanGateRequired: mailbox.available ? 'NO' : 'YES',
    caioEmailSent: 'NO',
    daniEmailSent: 'NO',
    juninhoEmailSent: 'NO',
    caioDataTouched: 'NO',
    daniDataTouched: 'NO',
    juninhoDataTouched: 'NO',
    prodTouched: 'NO',
    findingsBlocker: mailbox.available ? [] : ['Real mailbox/email link unavailable for full E2E'],
    findingsHigh: [],
    findingsMedium: [],
    findingsLow: [],
    findingsInfo: [mailboxFinding, resume ? 'QA_E2E_RESUME=1: existing synthetic identities preserved' : 'Fresh synthetic QA identities created'],
    readyForIndependentReview: 'NO',
  })
}

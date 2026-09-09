import { execSync } from 'child_process'
import { CANONICAL_DEV_URL } from './helpers/constants'
import { assertDevBaseUrl, assertDevSupabaseRef } from './helpers/guards'
import { validateMailboxConnection } from './helpers/mailbox'
import { mergeReport, saveState, type RuntimeState } from './helpers/report'
import { createQaIdentities, createRunId } from './helpers/testIdentity'
import { assertDevEnvironment } from './helpers/supabaseAdmin'
import { adminSignIn } from './helpers/authFlow'

export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required for E2E auth harness')
  assertDevSupabaseRef(url)
  assertDevEnvironment()
  assertDevBaseUrl(CANONICAL_DEV_URL)

  const runId = createRunId()
  const { qaUser1, qaUser2, qaUserResend } = createQaIdentities(runId)
  const mailbox = await validateMailboxConnection()

  let adminSession
  try {
    adminSession = await adminSignIn()
  } catch (error) {
    throw new Error(
      `Admin sign-in failed — cannot create invites: ${error instanceof Error ? error.message : error}`,
    )
  }

  const canonicalBranch = 'feat/auth-users-rbac-catering-dev'
  let canonicalSha = ''
  try {
    canonicalSha = execSync(`git rev-parse origin/${canonicalBranch}`, {
      encoding: 'utf8',
    }).trim()
  } catch {
    canonicalSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  }

  const state: RuntimeState = {
    runId,
    adminSession,
    mailboxAvailable: mailbox.available,
    mailboxReason: mailbox.reason,
    qaUser1: {
      email: qaUser1.email,
      role: qaUser1.role,
      password: qaUser1.password,
    },
    qaUser2: {
      email: qaUser2.email,
      role: qaUser2.role,
      password: qaUser2.password,
    },
    qaUserResend: {
      email: qaUserResend.email,
      role: qaUserResend.role,
      password: qaUserResend.password,
    },
    emailEvents: [],
  }

  saveState(state)

  mergeReport({
    canonicalBranch,
    canonicalSha,
    qaBranch: 'feat/internal-auth-e2e-qa-dev',
    qaHead: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
    pr: '',
    qaUser1: qaUser1.email,
    qaUser1Role: qaUser1.role,
    qaUser2: qaUser2.email,
    qaUser2Role: qaUser2.role,
    emailHumanGateRequired: mailbox.available ? 'NO' : 'YES',
    humanGateRequired: 'NO',
    caioEmailSent: 'NO',
    daniEmailSent: 'NO',
    juninhoEmailSent: 'NO',
    caioDataTouched: 'NO',
    daniDataTouched: 'NO',
    juninhoDataTouched: 'NO',
    prodTouched: 'NO',
    findingsBlocker: mailbox.available ? [] : ['Gmail IMAP mailbox automation unavailable'],
    findingsHigh: [],
    findingsMedium: [],
    findingsLow: [],
    findingsInfo: [mailbox.reason],
  })
}

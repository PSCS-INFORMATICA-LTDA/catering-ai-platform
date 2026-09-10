import { existsSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { cleanupQaUser } from './helpers/supabaseAssertions'
import { formatFinalReport, loadReport, mergeReport, loadState, computeReady } from './helpers/report'
import { REPORT_FILE, STATE_FILE } from './helpers/constants'

const CANONICAL_BRANCH = 'feat/brasinha-foundation-v0-dev'
const QA_BRANCH = 'feat/internal-auth-e2e-qa-canonical-dev'

function finalizeReport() {
  const report = loadReport()
  const formatted = formatFinalReport({
    ...report,
    canonicalBranch: report.canonicalBranch ?? CANONICAL_BRANCH,
    canonicalSha: report.canonicalSha ?? '8a2b963ce9d1442e05207f40f17b0277e95a2bd2',
    qaBranch: report.qaBranch ?? QA_BRANCH,
    qaHead: report.qaHead ?? '',
    pr: report.pr ?? '',
    qaUser1: report.qaUser1 ?? '',
    qaUser1Role: report.qaUser1Role ?? 'admin',
    qaUser2: report.qaUser2 ?? '',
    qaUser2Role: report.qaUser2Role ?? 'operator',
    mailboxProvider: report.mailboxProvider ?? 'none',
    emailGateResumable: report.emailGateResumable ?? 'YES',
    smtpRateLimitBlocked: report.smtpRateLimitBlocked ?? 'NO',
    aggressiveRetry: 'NO',
    emailHumanGateRequired: report.emailHumanGateRequired ?? 'YES',
    humanGateRequired: report.humanGateRequired ?? 'NO',
    caioEmailSent: 'NO',
    daniEmailSent: 'NO',
    juninhoEmailSent: 'NO',
    caioDataTouched: 'NO',
    daniDataTouched: 'NO',
    juninhoDataTouched: 'NO',
    prodTouched: 'NO',
    findingsBlocker: report.findingsBlocker ?? [],
    findingsHigh: report.findingsHigh ?? [],
    findingsMedium: report.findingsMedium ?? [],
    findingsLow: report.findingsLow ?? [],
    findingsInfo: report.findingsInfo ?? [],
    readyForIndependentReview: report.readyForIndependentReview ?? 'NO',
  } as import('./helpers/report').E2eReport)

  writeFileSync(REPORT_FILE.replace('.json', '.txt'), formatted)
  console.log('\n========== E2E AUTH FINAL REPORT ==========\n')
  console.log(formatted)
}

export default async function globalTeardown() {
  if (!existsSync(STATE_FILE)) return

  const current = loadReport()
  const preserveForResume =
    process.env.QA_E2E_PRESERVE_STATE === '1' ||
    current.emailHumanGateRequired === 'YES' ||
    current.smtpRateLimitBlocked === 'YES'

  if (preserveForResume) {
    mergeReport({
      readyForIndependentReview: 'NO',
      emailGateResumable: 'YES',
      findingsInfo: [
        ...(current.findingsInfo ?? []),
        'Synthetic QA state preserved for resume; rerun with QA_E2E_RESUME=1 after email/SMTP gate is cleared.',
      ],
    })
    finalizeReport()
    return
  }

  const state = loadState()
  const emails = [state.qaUser1?.email, state.qaUser2?.email, state.qaUserResend?.email].filter(
    Boolean,
  ) as string[]

  for (const email of emails) {
    if (!email.startsWith('pscs.solutions+catering.qa.')) {
      throw new Error(`Cleanup fail-closed: refusing ${email}`)
    }
    try {
      await cleanupQaUser(email)
    } catch (error) {
      mergeReport({
        findingsHigh: [
          ...(loadReport().findingsHigh ?? []),
          `Cleanup failed for ${email}: ${error instanceof Error ? error.message : error}`,
        ],
      })
    }
  }

  const updated = loadReport()
  mergeReport({ readyForIndependentReview: computeReady(updated) })
  finalizeReport()

  try {
    execSync('git diff --check', { stdio: 'pipe' })
  } catch {
    /* diff check is reported separately; do not mutate customer/runtime state */
  }
}

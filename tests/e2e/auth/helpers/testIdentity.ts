import { QA_EMAIL_DOMAIN, QA_EMAIL_PREFIX } from './constants'
import { assertQaEmail } from './guards'

export type QaUserIdentity = {
  key: 'QA_USER_1' | 'QA_USER_2' | 'QA_USER_RESEND'
  email: string
  role: 'admin' | 'operator'
  password: string
  newPassword?: string
}

function randomSuffix(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `${ts}${rand}`
}

export function generateQaPassword(label: string): string {
  return `QaE2e-${label}-${Math.random().toString(36).slice(2, 10)}-A1!`
}

export function createQaIdentities(runId: string): {
  qaUser1: QaUserIdentity
  qaUser2: QaUserIdentity
  qaUserResend: QaUserIdentity
} {
  const qaUser1: QaUserIdentity = {
    key: 'QA_USER_1',
    email: `${QA_EMAIL_PREFIX}${runId}.001${QA_EMAIL_DOMAIN}`,
    role: 'admin',
    password: generateQaPassword('admin'),
  }
  const qaUser2: QaUserIdentity = {
    key: 'QA_USER_2',
    email: `${QA_EMAIL_PREFIX}${runId}.002${QA_EMAIL_DOMAIN}`,
    role: 'operator',
    password: generateQaPassword('operator'),
  }
  const qaUserResend: QaUserIdentity = {
    key: 'QA_USER_RESEND',
    email: `${QA_EMAIL_PREFIX}${runId}.resend${QA_EMAIL_DOMAIN}`,
    role: 'operator',
    password: generateQaPassword('resend'),
  }

  for (const identity of [qaUser1, qaUser2, qaUserResend]) {
    assertQaEmail(identity.email)
  }

  return { qaUser1, qaUser2, qaUserResend }
}

export function createRunId(): string {
  return randomSuffix()
}

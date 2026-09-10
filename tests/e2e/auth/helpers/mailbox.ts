import { existsSync, readFileSync } from 'fs'
import { CANONICAL_DEV_URL } from './constants'
import { maskEmail, sanitizeUrl } from './guards'

export type EmailPurpose = 'invite' | 'reset' | 'unknown'

export type EmailEvent = {
  recipient: string
  purpose: EmailPurpose
  sentAt: string
  subject: string
  linkHost: string | null
  callbackPath: string | null
  deliveryEvidence: string
  sanitizedLink: string | null
}

export type EmailLookupResult = {
  event: EmailEvent
  rawLink: string
}

type ExternalLinkEntry = {
  invite?: string
  reset?: string
}

type ExternalLinkMap = Record<string, ExternalLinkEntry | string>

export type MailboxConfig = {
  user: string
  password: string
  host: string
  port: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function getMailboxConfig(): MailboxConfig | null {
  const user =
    process.env.QA_GMAIL_IMAP_USER?.trim() ||
    process.env.QA_GMAIL_USER?.trim() ||
    'pscs.solutions@gmail.com'
  const password =
    process.env.QA_GMAIL_IMAP_APP_PASSWORD?.trim() ||
    process.env.QA_GMAIL_APP_PASSWORD?.trim() ||
    ''

  if (!password) return null

  return {
    user,
    password,
    host: process.env.QA_GMAIL_IMAP_HOST?.trim() || 'imap.gmail.com',
    port: Number(process.env.QA_GMAIL_IMAP_PORT || 993),
  }
}

function externalProviderConfigured(): boolean {
  return Boolean(
    process.env.QA_EMAIL_LINKS_FILE?.trim() ||
      process.env.QA_EMAIL_LINKS_JSON?.trim() ||
      process.env.QA_MAILBOX_PROVIDER?.trim().toLowerCase() === 'external',
  )
}

function readExternalLinks(): ExternalLinkMap {
  const inline = process.env.QA_EMAIL_LINKS_JSON?.trim()
  const file = process.env.QA_EMAIL_LINKS_FILE?.trim()
  let raw = inline ?? ''

  if (!raw && file && existsSync(file)) {
    raw = readFileSync(file, 'utf8')
  }

  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as ExternalLinkMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function externalLinkFor(recipient: string, purpose: EmailPurpose): string | null {
  const links = readExternalLinks()
  const normalized = recipient.trim().toLowerCase()
  const direct = links[normalized]
  if (!direct) return null
  if (typeof direct === 'string') return direct
  if (purpose === 'invite') return direct.invite?.trim() || null
  if (purpose === 'reset') return direct.reset?.trim() || null
  return direct.invite?.trim() || direct.reset?.trim() || null
}

function eventFromRawLink(input: {
  recipient: string
  purpose: EmailPurpose
  rawLink: string
  deliveryEvidence: string
  subject?: string
  sentAt?: string
}): EmailLookupResult | null {
  try {
    const parsed = new URL(input.rawLink.replace(/&amp;/g, '&'))
    return {
      rawLink: parsed.toString(),
      event: {
        recipient: input.recipient,
        purpose: input.purpose,
        sentAt: input.sentAt ?? new Date().toISOString(),
        subject: input.subject ?? `Externally supplied ${input.purpose} auth link`,
        linkHost: parsed.host,
        callbackPath: `${parsed.pathname}${parsed.search}`,
        deliveryEvidence: input.deliveryEvidence,
        sanitizedLink: sanitizeUrl(parsed.toString()),
      },
    }
  } catch {
    return null
  }
}

async function dynamicImport(specifier: string): Promise<any> {
  // Keep IMAP as an optional provider without making the canonical app depend on
  // imapflow/mailparser. The modules are loaded only when IMAP credentials exist.
  const loader = Function('s', 'return import(s)') as (s: string) => Promise<any>
  return loader(specifier)
}

export async function validateMailboxConnection(): Promise<{
  available: boolean
  resumable: boolean
  provider: 'external' | 'imap' | 'none'
  reason: string
}> {
  if (externalProviderConfigured()) {
    return {
      available: true,
      resumable: true,
      provider: 'external',
      reason: 'External resumable mailbox provider configured',
    }
  }

  const config = getMailboxConfig()
  if (!config) {
    return {
      available: false,
      resumable: true,
      provider: 'none',
      reason:
        'No mailbox provider configured. Set QA_MAILBOX_PROVIDER=external with QA_EMAIL_LINKS_FILE/JSON, or optional Gmail IMAP credentials.',
    }
  }

  try {
    const { ImapFlow } = await dynamicImport('imapflow')
    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: true,
      auth: { user: config.user, pass: config.password },
      logger: false,
    })
    await client.connect()
    await client.logout()
    return {
      available: true,
      resumable: true,
      provider: 'imap',
      reason: `IMAP connected for ${maskEmail(config.user)}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown IMAP error'
    return {
      available: false,
      resumable: true,
      provider: 'none',
      reason: `Optional IMAP unavailable: ${message}`,
    }
  }
}

function extractLinksFromBody(body: string): string[] {
  const links: string[] = []
  const hrefRegex = /href=["']([^"']+)["']/gi
  const urlRegex = /https?:\/\/[^\s<>"']+/gi

  let match: RegExpExecArray | null
  while ((match = hrefRegex.exec(body)) !== null) links.push(match[1])
  for (const url of body.match(urlRegex) ?? []) links.push(url)
  return [...new Set(links)]
}

function classifyPurpose(subject: string, body: string): EmailPurpose {
  const hay = `${subject} ${body}`.toLowerCase()
  if (hay.includes('invite') || hay.includes('convite') || hay.includes('invited')) return 'invite'
  if (hay.includes('reset') || hay.includes('password') || hay.includes('senha')) return 'reset'
  return 'unknown'
}

function pickAuthLink(links: string[], purpose: EmailPurpose): string | null {
  const devHost = new URL(CANONICAL_DEV_URL).host
  const candidates = links.filter((link) => {
    try {
      const url = new URL(link.replace(/&amp;/g, '&'))
      return (
        url.host.includes(devHost) ||
        url.host.includes('supabase.co') ||
        url.pathname.includes('/auth/callback')
      )
    } catch {
      return false
    }
  })

  if (purpose === 'invite') {
    return candidates.find((l) => l.includes('type=invite') || l.includes('/auth/callback')) ?? candidates[0] ?? null
  }
  if (purpose === 'reset') {
    return candidates.find((l) => l.includes('recovery') || l.includes('reset-password')) ?? candidates[0] ?? null
  }
  return candidates[0] ?? null
}

async function searchImap(
  config: MailboxConfig,
  recipient: string,
  purpose: EmailPurpose,
  since: Date,
): Promise<EmailLookupResult | null> {
  const { ImapFlow } = await dynamicImport('imapflow')
  const { simpleParser } = await dynamicImport('mailparser')
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.password },
    logger: false,
  })

  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      const searched = await client.search({ since })
      const uids: number[] = Array.isArray(searched) ? searched : []
      for (const uid of uids.slice(-50).reverse()) {
        const msg = await client.fetchOne(uid, { source: true, envelope: true })
        if (!msg?.source) continue
        const parsed = await simpleParser(msg.source)
        const body = `${parsed.text ?? ''}\n${parsed.html ?? ''}`
        const recipientLower = recipient.toLowerCase()
        const headers = `${parsed.headers?.get?.('delivered-to') ?? ''} ${parsed.headers?.get?.('x-original-to') ?? ''}`.toLowerCase()
        const envelopeTo = JSON.stringify(parsed.to ?? '').toLowerCase()
        if (!body.toLowerCase().includes(recipientLower) && !headers.includes(recipientLower) && !envelopeTo.includes(recipientLower)) {
          continue
        }

        const detectedPurpose = classifyPurpose(parsed.subject ?? '', body)
        if (purpose !== 'unknown' && detectedPurpose !== purpose) continue
        const rawLink = pickAuthLink(extractLinksFromBody(body), detectedPurpose)
        if (!rawLink) continue

        return eventFromRawLink({
          recipient,
          purpose: detectedPurpose,
          rawLink,
          sentAt: (parsed.date ?? new Date()).toISOString(),
          subject: parsed.subject ?? '(no subject)',
          deliveryEvidence: `IMAP uid=${uid}`,
        })
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }
  return null
}

export async function waitForEmailLink(input: {
  recipient: string
  purpose: EmailPurpose
  since: Date
  timeoutMs?: number
  pollIntervalMs?: number
}): Promise<EmailLookupResult | null> {
  const timeoutMs = input.timeoutMs ?? 120_000
  const pollIntervalMs = input.pollIntervalMs ?? 5_000
  const deadline = Date.now() + timeoutMs
  const config = getMailboxConfig()

  while (Date.now() < deadline) {
    const external = externalLinkFor(input.recipient, input.purpose)
    if (external) {
      const result = eventFromRawLink({
        recipient: input.recipient,
        purpose: input.purpose,
        rawLink: external,
        deliveryEvidence: 'external resumable mailbox provider',
      })
      if (result) return result
    }

    if (config) {
      try {
        const result = await searchImap(config, input.recipient, input.purpose, input.since)
        if (result) return result
      } catch {
        // IMAP is optional. Keep polling external injection rather than failing the run.
      }
    }

    await sleep(pollIntervalMs)
  }

  return null
}

export async function waitForEmail(input: {
  recipient: string
  purpose: EmailPurpose
  since: Date
  timeoutMs?: number
  pollIntervalMs?: number
}): Promise<EmailEvent | null> {
  return (await waitForEmailLink(input))?.event ?? null
}

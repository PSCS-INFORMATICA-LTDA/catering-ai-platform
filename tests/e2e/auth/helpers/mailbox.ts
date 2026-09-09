import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { CANONICAL_DEV_URL } from './constants'
import { maskEmail, sanitizeUrl } from './guards'

export type EmailEvent = {
  recipient: string
  purpose: 'invite' | 'reset' | 'unknown'
  sentAt: string
  subject: string
  linkHost: string | null
  callbackPath: string | null
  deliveryEvidence: string
  sanitizedLink: string | null
}

export type MailboxConfig = {
  user: string
  password: string
  host: string
  port: number
}

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

export async function validateMailboxConnection(): Promise<{
  available: boolean
  reason: string
}> {
  const config = getMailboxConfig()
  if (!config) {
    return {
      available: false,
      reason: 'No QA_GMAIL_IMAP_APP_PASSWORD or QA_GMAIL_APP_PASSWORD configured',
    }
  }

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.password },
    logger: false,
  })

  try {
    await client.connect()
    await client.logout()
    return { available: true, reason: `IMAP connected for ${maskEmail(config.user)}` }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown IMAP error'
    return { available: false, reason: `IMAP failed: ${message}` }
  }
}

function extractLinksFromBody(body: string): string[] {
  const links: string[] = []
  const hrefRegex = /href=["']([^"']+)["']/gi
  const urlRegex = /https?:\/\/[^\s<>"']+/gi

  let match: RegExpExecArray | null
  while ((match = hrefRegex.exec(body)) !== null) {
    links.push(match[1])
  }
  for (const url of body.match(urlRegex) ?? []) {
    links.push(url)
  }

  return [...new Set(links)]
}

function classifyPurpose(subject: string, body: string): EmailEvent['purpose'] {
  const hay = `${subject} ${body}`.toLowerCase()
  if (hay.includes('invite') || hay.includes('convite') || hay.includes('invited')) {
    return 'invite'
  }
  if (hay.includes('reset') || hay.includes('password') || hay.includes('senha')) {
    return 'reset'
  }
  return 'unknown'
}

function pickAuthLink(links: string[], purpose: EmailEvent['purpose']): string | null {
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
    return (
      candidates.find((l) => l.includes('type=invite') || l.includes('/auth/callback')) ??
      candidates[0] ??
      null
    )
  }

  if (purpose === 'reset') {
    return (
      candidates.find((l) => l.includes('recovery') || l.includes('reset-password')) ??
      candidates[0] ??
      null
    )
  }

  return candidates[0] ?? null
}

export async function waitForEmail(input: {
  recipient: string
  purpose: EmailEvent['purpose']
  since: Date
  timeoutMs?: number
  pollIntervalMs?: number
}): Promise<EmailEvent | null> {
  const config = getMailboxConfig()
  if (!config) return null

  const timeoutMs = input.timeoutMs ?? 120_000
  const pollIntervalMs = input.pollIntervalMs ?? 5_000
  const deadline = Date.now() + timeoutMs
  const recipient = input.recipient.trim().toLowerCase()

  while (Date.now() < deadline) {
    const event = await searchMailbox(config, recipient, input.purpose, input.since)
    if (event) return event
    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }

  return null
}

async function searchMailbox(
  config: MailboxConfig,
  recipient: string,
  purpose: EmailEvent['purpose'],
  since: Date,
): Promise<EmailEvent | null> {
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
      const messages = await client.search({
        since,
        to: recipient,
      })

      if (!Array.isArray(messages) || messages.length === 0) {
        // Gmail plus-alias: also search delivered-to / subject containing token
        const allRecent = await client.search({ since })
        if (!Array.isArray(allRecent) || allRecent.length === 0) return null

        for (const uid of allRecent.slice(-30).reverse()) {
          const msg = await client.fetchOne(uid, { source: true, envelope: true })
          if (!msg || !('source' in msg) || !msg.source) continue
          const parsed = await simpleParser(msg.source)
          const toValue = Array.isArray(parsed.to) ? parsed.to : parsed.to?.value ?? []
          const toAddrs = [
            ...toValue.map((v: { address?: string }) => v.address?.toLowerCase()),
            ...(parsed.headers.get('delivered-to') as string[] | undefined)?.map((v: string) =>
              v.toLowerCase(),
            ) ?? [],
          ].filter(Boolean) as string[]

          const body = `${parsed.text ?? ''}\n${parsed.html ?? ''}`
          if (!toAddrs.includes(recipient) && !body.toLowerCase().includes(recipient)) {
            continue
          }

          const detectedPurpose = classifyPurpose(parsed.subject ?? '', body)
          if (purpose !== 'unknown' && detectedPurpose !== purpose) continue

          const links = extractLinksFromBody(body)
          const authLink = pickAuthLink(links, detectedPurpose)
          if (!authLink) continue

          const linkUrl = new URL(authLink.replace(/&amp;/g, '&'))
          return {
            recipient,
            purpose: detectedPurpose,
            sentAt: (parsed.date ?? new Date()).toISOString(),
            subject: parsed.subject ?? '(no subject)',
            linkHost: linkUrl.host,
            callbackPath: linkUrl.pathname + linkUrl.search,
            deliveryEvidence: `IMAP uid=${uid} to=${toAddrs.join(',')}`,
            sanitizedLink: sanitizeUrl(authLink),
          }
        }
        return null
      }

      for (const uid of messages.reverse()) {
        const msg = await client.fetchOne(uid, { source: true, envelope: true })
        if (!msg || !('source' in msg) || !msg.source) continue
        const parsed = await simpleParser(msg.source)
        const body = `${parsed.text ?? ''}\n${parsed.html ?? ''}`
        const detectedPurpose = classifyPurpose(parsed.subject ?? '', body)
        if (purpose !== 'unknown' && detectedPurpose !== purpose) continue

        const links = extractLinksFromBody(body)
        const authLink = pickAuthLink(links, detectedPurpose)
        if (!authLink) continue

        const linkUrl = new URL(authLink.replace(/&amp;/g, '&'))
        return {
          recipient,
          purpose: detectedPurpose,
          sentAt: (parsed.date ?? new Date()).toISOString(),
          subject: parsed.subject ?? '(no subject)',
          linkHost: linkUrl.host,
          deliveryEvidence: `IMAP uid=${uid}`,
          callbackPath: linkUrl.pathname + linkUrl.search,
          sanitizedLink: sanitizeUrl(authLink),
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }

  return null
}

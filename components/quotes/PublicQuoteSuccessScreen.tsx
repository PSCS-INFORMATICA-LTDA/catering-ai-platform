'use client'

import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { PublicQuoteSubmissionResult } from '@/app/quotes/new/QuoteWizard'
import { resolvePublicCompanyContacts } from '@/Lib/publicQuote/companyContacts'
import { displayPublicPhone } from '@/Lib/publicQuote/phone'
import { scrollPublicQuoteToTop } from '@/Lib/publicQuote/scrollPublicQuoteToTop'
import { publicSuccessCopy } from '@/Lib/publicQuote/successCopy'
import { resolvePublicSuccessFireLogoSrc } from '@/Lib/publicQuote/successHeroMedia'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import CdlFireSignature from '@/components/quotes/CdlFireSignature'
import PublicLandingTitle from '@/components/quotes/PublicLandingTitle'

function formatSuccessMoney(
  value: number,
  locale: QuoteLanguage,
  currency: string,
) {
  const languageTag = locale === 'en' ? 'en-US' : locale === 'es' ? 'es-US' : 'pt-BR'
  return new Intl.NumberFormat(languageTag, {
    style: 'currency',
    currency,
  }).format(value)
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="public-success-contact-icon" aria-hidden>
      <path
        fill="currentColor"
        d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.74.46 3.44 1.34 4.94L2 22l5.38-1.4a10.1 10.1 0 0 0 4.66 1.12h.01c5.46 0 9.89-4.4 9.89-9.84C21.94 6.4 17.5 2 12.04 2m0 17.95h-.01a8.4 8.4 0 0 1-4.28-1.17l-.31-.18-3.19.83.85-3.1-.2-.32a8.27 8.27 0 0 1-1.27-4.4c0-4.6 3.77-8.34 8.41-8.34 4.64 0 8.41 3.74 8.41 8.34 0 4.6-3.77 8.34-8.41 8.34m4.62-6.24c-.25-.13-1.49-.73-1.72-.82-.23-.08-.4-.12-.57.13-.17.25-.65.82-.8.99-.15.17-.3.19-.55.06-.25-.13-1.06-.39-2.02-1.24-.75-.66-1.25-1.48-1.4-1.73-.15-.25-.02-.38.11-.51.12-.12.25-.3.38-.45.12-.15.17-.25.25-.42.08-.17.04-.32-.02-.45-.06-.13-.57-1.37-.78-1.87-.2-.48-.41-.42-.57-.42h-.49c-.17 0-.45.06-.68.32-.23.25-.89.87-.89 2.12 0 1.25.91 2.46 1.04 2.63.13.17 1.79 2.73 4.33 3.83.61.26 1.08.42 1.45.54.61.19 1.16.17 1.6.1.49-.07 1.49-.61 1.7-1.2.21-.58.21-1.09.15-1.2-.06-.1-.23-.17-.48-.3"
      />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="public-success-contact-icon" aria-hidden>
      <path
        fill="currentColor"
        d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2m0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5A4.25 4.25 0 0 0 16.25 3.5zm8.75 2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10m0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7"
      />
    </svg>
  )
}

export default function PublicQuoteSuccessScreen({
  locale,
  companySlug,
  companyName,
  currencyCode,
  emblemSrc,
  support,
  success,
  restartHref,
  onRestart,
}: {
  locale: QuoteLanguage
  companySlug: string
  companyName: string
  currencyCode: string
  emblemSrc: string | null
  support: {
    phone: string | null
    whatsappUrl: string | null
    email?: string | null
    instagramUrl?: string | null
    instagramHandle?: string | null
  }
  success: PublicQuoteSubmissionResult
  restartHref: string
  onRestart: () => void
}) {
  const copy = publicSuccessCopy(locale)
  const contacts = resolvePublicCompanyContacts(support, companySlug)
  const rootRef = useRef<HTMLElement>(null)
  const fireLogoSrc = emblemSrc || resolvePublicSuccessFireLogoSrc()
  const phoneDisplay = displayPublicPhone(contacts.phone) || contacts.phone
  const whatsappHref =
    contacts.whatsappUrl || (contacts.phone ? `tel:${contacts.phone}` : null)

  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration
    try {
      window.history.scrollRestoration = 'manual'
    } catch {
      /* ignore unsupported browsers */
    }
    scrollPublicQuoteToTop(rootRef.current)
    const frame = window.requestAnimationFrame(() => {
      scrollPublicQuoteToTop(rootRef.current)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      try {
        window.history.scrollRestoration = previous
      } catch {
        /* ignore */
      }
    }
  }, [success.quote.id])

  useEffect(() => {
    const reset = () => scrollPublicQuoteToTop(rootRef.current)
    const onPageShow = () => reset()
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [success.quote.id])

  return (
    <main
      ref={rootRef}
      data-success-screen
      data-public-success
      data-success-hero-mode="clean"
      data-success-logo-first="true"
      className="public-success"
    >
      <div data-success-signature-cluster className="public-success-signature-cluster">
        {fireLogoSrc ? <CdlFireSignature src={fireLogoSrc} alt={companyName} /> : null}
      </div>

      <section className="public-success-confirm" data-success-confirm>
        <p className="public-cinematic-eyebrow public-success-kicker">{copy.kicker}</p>
        <PublicLandingTitle
          as="h1"
          className="public-cinematic-display public-success-title"
          parts={[
            { text: copy.title, breakAfter: true },
            { text: copy.titleMark, highlight: 'red' },
          ]}
        />
        <p className="public-cinematic-lead public-success-body-copy">{copy.body}</p>
      </section>

      <section className="public-success-panel" data-success-summary>
        <dl className="public-success-summary">
          <div>
            <dt>{copy.quote}</dt>
            <dd>{success.quote.number || '—'}</dd>
          </div>
          <div>
            <dt>{copy.date}</dt>
            <dd>{success.quote.eventDate}</dd>
          </div>
          <div>
            <dt>{copy.name}</dt>
            <dd>{success.quote.eventName}</dd>
          </div>
          {typeof success.quote.total === 'number' ? (
            <div>
              <dt>{copy.total}</dt>
              <dd>
                {formatSuccessMoney(
                  success.quote.total,
                  locale,
                  success.quote.currency || currencyCode,
                )}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="public-success-actions">
          <Link
            href={restartHref}
            data-success-restart
            onClick={onRestart}
            className="public-cinematic-cta public-success-cta"
          >
            {copy.restart}
          </Link>
        </div>
      </section>

      <section className="public-success-contact-block">
        <div data-success-contacts className="public-success-contacts">
          <p data-success-contact-heading className="public-success-contact-heading">
            {copy.contactTeam}
          </p>
          <ul>
            {contacts.phone || contacts.whatsappUrl ? (
              <li>
                <a
                  href={whatsappHref || undefined}
                  target={contacts.whatsappUrl ? '_blank' : undefined}
                  rel={contacts.whatsappUrl ? 'noreferrer' : undefined}
                  data-success-whatsapp
                  aria-label={phoneDisplay || copy.phone}
                >
                  <WhatsAppIcon />
                  <span>{phoneDisplay || companyName}</span>
                </a>
              </li>
            ) : null}
            {contacts.email ? (
              <li>
                <a
                  href={`mailto:${contacts.email}`}
                  data-success-email
                  aria-label={contacts.email}
                >
                  <span>{contacts.email}</span>
                </a>
              </li>
            ) : null}
            {contacts.instagramUrl ? (
              <li>
                <a
                  href={contacts.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  data-success-instagram
                  aria-label={contacts.instagramHandle || copy.instagram}
                >
                  <InstagramIcon />
                  <span>{contacts.instagramHandle || companyName}</span>
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </section>
    </main>
  )
}

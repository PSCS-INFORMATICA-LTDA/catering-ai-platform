'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import QuoteWizardCore, {
  type CatalogItem,
  type Package,
  type PublicQuoteSubmissionResult,
} from '@/app/quotes/new/QuoteWizard'
import type {
  PackageItem,
  PackageSideItem,
} from '@/Lib/packageConfiguration'
import type {
  PackageOptionGroupItem,
  PackageOptionGroupRecord,
} from '@/Lib/packageOptionGroups'
import {
  createInitialWizardState,
  type QuoteLanguage,
  type WizardState,
} from '@/Lib/quoteWizardTypes'
import type { CommercialRulesSnapshot } from '@/Lib/supabaseCommercialRules'

export type PublicQuotePageBootstrap = {
  company: {
    id: string
    slug: string
    name: string
    logoUrl: string | null
    primaryColor: string
    accentColor: string
    currencyCode: string
  }
  settings: {
    enabled: boolean
    defaultLocale: QuoteLanguage
    allowedLocales: QuoteLanguage[]
    allowedCountries: string[]
    heroImageUrl: string | null
    landing: {
      eyebrow: string
      title: string
      subtitle: string
      intro: string
      cta: string
    }
    consent: {
      version: string
      label: string
      privacyUrl: string | null
    }
    support: {
      phone: string | null
      whatsappUrl: string | null
    }
  }
  branches: Array<{
    id: string
    name: string
    isDefault: boolean
    country: string | null
  }>
  packages: Package[]
  catalogItems: CatalogItem[]
  packageItems: PackageItem[]
  packageSideItems: PackageSideItem[]
  optionGroups: PackageOptionGroupRecord[]
  optionGroupItems: PackageOptionGroupItem[]
  commercialRules: CommercialRulesSnapshot
}

type IntakeDraft = {
  locale?: QuoteLanguage
  contact?: {
    firstName?: string
    lastName?: string
    phone?: string
    email?: string | null
  }
  event?: {
    eventName?: string
    eventDate?: string
    startTime?: string
    endTime?: string
    adultCount?: number
    childrenUnder3Count?: number
    children4To12Count?: number
    address?: {
      route?: string
      number?: string
      city?: string
      region?: string
      postalCode?: string
      country?: string
      formattedAddress?: string
      placeId?: string | null
      latitude?: number | null
      longitude?: number | null
      source?: 'google' | 'manual' | null
    }
  }
  selection?: {
    packageId?: string | null
    packageSelections?: Record<string, string>
    additionals?: Array<{ itemId: string; quantity: number }>
  }
  grill?: {
    hasGrill?: boolean
    photoReference?: string | null
    rentalRequired?: boolean
    rentalQty?: number
    notes?: string | null
  }
}

const UI_COPY = {
  pt: {
    secure: 'Orçamento online seguro',
    startError: 'Não foi possível iniciar agora. Atualize a página e tente novamente.',
    feature1: 'Monte seu evento no seu ritmo',
    feature2: 'Preço estimado calculado com as regras atuais',
    feature3: 'Nossa equipe revisa tudo antes de confirmar',
    successEyebrow: 'Solicitação recebida',
    successTitle: 'Seu evento já está com a nossa equipe',
    successBody: 'Vamos revisar os detalhes e entrar em contato. Guarde este resumo.',
    quote: 'Solicitação',
    date: 'Data',
    name: 'Evento',
    total: 'Estimativa',
    whatsapp: 'Falar no WhatsApp',
    restart: 'Criar outra solicitação',
    privacy: 'Privacidade',
    support: 'Precisa de ajuda?',
  },
  en: {
    secure: 'Secure online quote',
    startError: 'We could not start right now. Refresh the page and try again.',
    feature1: 'Build your event at your own pace',
    feature2: 'Estimate calculated with current pricing rules',
    feature3: 'Our team reviews everything before confirmation',
    successEyebrow: 'Request received',
    successTitle: 'Your event is now with our team',
    successBody: 'We will review the details and get in touch. Keep this summary.',
    quote: 'Request',
    date: 'Date',
    name: 'Event',
    total: 'Estimate',
    whatsapp: 'Chat on WhatsApp',
    restart: 'Create another request',
    privacy: 'Privacy',
    support: 'Need help?',
  },
  es: {
    secure: 'Cotización online segura',
    startError: 'No pudimos iniciar ahora. Actualiza la página e inténtalo de nuevo.',
    feature1: 'Arma tu evento a tu ritmo',
    feature2: 'Estimación calculada con las reglas actuales',
    feature3: 'Nuestro equipo revisa todo antes de confirmar',
    successEyebrow: 'Solicitud recibida',
    successTitle: 'Tu evento ya está con nuestro equipo',
    successBody: 'Revisaremos los detalles y nos pondremos en contacto. Guarda este resumen.',
    quote: 'Solicitud',
    date: 'Fecha',
    name: 'Evento',
    total: 'Estimación',
    whatsapp: 'Hablar por WhatsApp',
    restart: 'Crear otra solicitud',
    privacy: 'Privacidad',
    support: '¿Necesitas ayuda?',
  },
} as const

function hydrateDraft(
  rules: CommercialRulesSnapshot,
  locale: QuoteLanguage,
  branchId: string | null,
  consentVersion: string,
  draft?: IntakeDraft | null,
): WizardState {
  const base = createInitialWizardState(rules)
  if (!draft) {
    return {
      ...base,
      language: locale,
      branchId,
      publicConsentVersion: consentVersion,
    }
  }
  const additionals = Object.fromEntries(
    (draft.selection?.additionals ?? [])
      .filter((line) => line.itemId && line.quantity > 0)
      .map((line) => [line.itemId, line.quantity]),
  )
  const firstName = draft.contact?.firstName?.trim() || ''
  const lastName = draft.contact?.lastName?.trim() || ''
  const address = draft.event?.address
  const photoReference = draft.grill?.photoReference?.trim() || null
  const hasGrill = Boolean(draft.grill?.hasGrill)

  return {
    ...base,
    language: locale,
    branchId,
    customerFirstName: firstName,
    customerLastName: lastName,
    customerDraftName: [firstName, lastName].filter(Boolean).join(' '),
    customerDraftPhone: draft.contact?.phone || '',
    customerDraftEmail: draft.contact?.email || '',
    eventName:
      draft.event?.eventName || [firstName, lastName].filter(Boolean).join(' '),
    eventDate: draft.event?.eventDate || '',
    startTime: draft.event?.startTime || '',
    endTime: draft.event?.endTime || '',
    adultCount: draft.event?.adultCount || 0,
    childrenUnder3Count: draft.event?.childrenUnder3Count || 0,
    children4To12Count: draft.event?.children4To12Count || 0,
    address: address?.route || '',
    addressNumber: address?.number || '',
    city: address?.city || '',
    state: address?.region || '',
    zipCode: address?.postalCode || '',
    addressCountry: address?.country || '',
    addressFormatted: address?.formattedAddress || '',
    addressPlaceId: address?.placeId || null,
    addressLatitude: address?.latitude ?? null,
    addressLongitude: address?.longitude ?? null,
    addressSource: address?.source || null,
    packageId: draft.selection?.packageId || null,
    packageSelections: draft.selection?.packageSelections || {},
    additionals,
    hasGrill,
    grillSetupAnswered:
      typeof draft.grill?.hasGrill === 'boolean',
    grillPhotoRequired: hasGrill,
    grillPhotoStatus: hasGrill
      ? photoReference
        ? 'received'
        : 'pending'
      : 'not_applicable',
    grillPhotoAnswered: !hasGrill || Boolean(photoReference),
    grillPhotoReference: photoReference,
    grillRentalRequired: Boolean(draft.grill?.rentalRequired),
    grillRentalQty: draft.grill?.rentalQty || 0,
    grillNotes: draft.grill?.notes || '',
    publicConsentVersion: consentVersion,
  }
}

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

export default function PublicQuoteExperience({
  bootstrap,
  locale,
}: {
  bootstrap: PublicQuotePageBootstrap
  locale: QuoteLanguage
}) {
  const copy = UI_COPY[locale]
  const [started, setStarted] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState(false)
  const [restoredDraft, setRestoredDraft] = useState<IntakeDraft | null>(null)
  const [success, setSuccess] =
    useState<PublicQuoteSubmissionResult | null>(null)
  const defaultBranch =
    bootstrap.branches.find((branch) => branch.isDefault) ??
    bootstrap.branches[0] ??
    null
  const initialState = useMemo(
    () =>
      hydrateDraft(
        bootstrap.commercialRules,
        locale,
        defaultBranch?.id ?? null,
        bootstrap.settings.consent.version,
        restoredDraft,
      ),
    [
      bootstrap.commercialRules,
      bootstrap.settings.consent.version,
      defaultBranch?.id,
      locale,
      restoredDraft,
    ],
  )

  async function startQuote() {
    if (starting) return
    setStarting(true)
    setStartError(false)
    try {
      const response = await fetch('/api/public/quote-intake/session', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companySlug: bootstrap.company.slug,
          locale,
          website: '',
        }),
      })
      const result = (await response.json().catch(() => null)) as
        | { session?: { draft?: IntakeDraft | null } }
        | { error?: string }
        | null
      if (!response.ok || !result || !('session' in result)) {
        throw new Error('session_start_failed')
      }
      setRestoredDraft(result.session?.draft ?? null)
      setStarted(true)
    } catch {
      setStartError(true)
    } finally {
      setStarting(false)
    }
  }

  const style = {
    '--brand-primary': bootstrap.company.primaryColor,
    '--brand-primary-2': bootstrap.company.accentColor,
  } as React.CSSProperties

  return (
    <div style={style} className="min-h-screen bg-cdl-bg text-cdl-fg">
      <header className="sticky top-0 z-40 border-b border-cdl-border/80 bg-cdl-bg/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {bootstrap.company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bootstrap.company.logoUrl}
                alt=""
                className="h-10 w-10 rounded-xl object-contain"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-primary)] text-sm font-black text-white">
                {bootstrap.company.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-cdl-title">
                {bootstrap.company.name}
              </p>
              <p className="truncate text-[11px] text-cdl-muted">{copy.secure}</p>
            </div>
          </div>
          <nav className="flex items-center gap-1" aria-label="Language">
            {bootstrap.settings.allowedLocales.map((language) => (
              <Link
                key={language}
                href={`/quote/${bootstrap.company.slug}/${language}`}
                aria-current={language === locale ? 'page' : undefined}
                className={`rounded-lg px-2.5 py-2 text-xs font-black uppercase ${
                  language === locale
                    ? 'bg-[var(--brand-primary)] text-white'
                    : 'text-cdl-muted hover:bg-cdl-hover'
                }`}
              >
                {language}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {success ? (
        <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center px-4 py-12 sm:px-8">
          <section className="w-full rounded-[2rem] border border-cdl-border bg-cdl-surface p-7 shadow-xl sm:p-10">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
              ✓
            </span>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-[var(--brand-primary)]">
              {copy.successEyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-cdl-title sm:text-4xl">
              {copy.successTitle}
            </h1>
            <p className="mt-3 text-cdl-muted">{copy.successBody}</p>
            <dl className="mt-8 grid gap-3 rounded-2xl bg-cdl-inset p-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold uppercase text-cdl-muted">{copy.quote}</dt>
                <dd className="mt-1 font-black text-cdl-title">
                  {success.quote.number || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-cdl-muted">{copy.date}</dt>
                <dd className="mt-1 font-black text-cdl-title">{success.quote.eventDate}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-cdl-muted">{copy.name}</dt>
                <dd className="mt-1 font-black text-cdl-title">{success.quote.eventName}</dd>
              </div>
              {typeof success.quote.total === 'number' ? (
                <div>
                  <dt className="text-xs font-bold uppercase text-cdl-muted">{copy.total}</dt>
                  <dd className="mt-1 font-black text-cdl-title">
                    {formatSuccessMoney(
                      success.quote.total,
                      locale,
                      success.quote.currency || bootstrap.company.currencyCode,
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {bootstrap.settings.support.whatsappUrl ? (
                <a
                  href={bootstrap.settings.support.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="cdl-btn-primary inline-flex min-h-12 items-center justify-center px-6"
                >
                  {copy.whatsapp}
                </a>
              ) : null}
              <Link
                href={`/quote/${bootstrap.company.slug}/${locale}`}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-cdl-border px-6 text-sm font-bold"
              >
                {copy.restart}
              </Link>
            </div>
          </section>
        </main>
      ) : started ? (
        <QuoteWizardCore
          key={restoredDraft ? 'restored' : 'new'}
          entryMode="public"
          customers={[]}
          packages={bootstrap.packages}
          catalogItems={bootstrap.catalogItems}
          packageItems={bootstrap.packageItems}
          packageSideItems={bootstrap.packageSideItems}
          packageOptionGroups={bootstrap.optionGroups}
          packageOptionGroupItems={bootstrap.optionGroupItems}
          commercialRules={bootstrap.commercialRules}
          fetchErrors={[]}
          initialState={initialState}
          initialUiLocale={locale}
          publicContext={{
            companyId: bootstrap.company.id,
            companySlug: bootstrap.company.slug,
            branchId: defaultBranch?.id ?? null,
            allowedCountries: bootstrap.settings.allowedCountries,
            consentVersion: bootstrap.settings.consent.version,
            consentLabel: bootstrap.settings.consent.label,
            privacyUrl: bootstrap.settings.consent.privacyUrl,
            supportWhatsappUrl: bootstrap.settings.support.whatsappUrl,
            currencyCode: bootstrap.company.currencyCode,
          }}
          onPublicSuccess={setSuccess}
        />
      ) : (
        <main>
          <section
            className="relative isolate overflow-hidden border-b border-cdl-border"
            style={
              bootstrap.settings.heroImageUrl
                ? {
                    backgroundImage: `linear-gradient(100deg, rgba(9,16,28,.94), rgba(9,16,28,.62)), url("${bootstrap.settings.heroImageUrl}")`,
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                  }
                : undefined
            }
          >
            <div
              className={`absolute inset-0 -z-10 ${
                bootstrap.settings.heroImageUrl
                  ? ''
                  : 'bg-[radial-gradient(circle_at_80%_20%,color-mix(in_srgb,var(--brand-primary-2)_28%,transparent),transparent_36%),linear-gradient(135deg,#0b1220,#18233a)]'
              }`}
            />
            <div className="mx-auto grid min-h-[34rem] max-w-7xl items-center gap-10 px-4 py-16 text-white sm:px-8 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--brand-primary-2)]">
                  {bootstrap.settings.landing.eyebrow}
                </p>
                <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[1.04] tracking-[-0.04em] sm:text-6xl">
                  {bootstrap.settings.landing.title}
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-white/78">
                  {bootstrap.settings.landing.subtitle}
                </p>
                <button
                  type="button"
                  onClick={() => void startQuote()}
                  disabled={starting}
                  className="mt-8 inline-flex min-h-14 items-center justify-center rounded-2xl bg-[var(--brand-primary)] px-8 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {starting ? '…' : bootstrap.settings.landing.cta}
                </button>
                {startError ? (
                  <p className="mt-4 max-w-xl rounded-xl border border-red-300/40 bg-red-950/50 p-3 text-sm text-red-100">
                    {copy.startError}
                  </p>
                ) : null}
              </div>
              <aside className="rounded-[2rem] border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-md sm:p-8">
                <p className="text-sm leading-7 text-white/85">
                  {bootstrap.settings.landing.intro}
                </p>
                <ul className="mt-6 space-y-4 text-sm font-semibold">
                  {[copy.feature1, copy.feature2, copy.feature3].map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-0.5 text-emerald-300">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          </section>
        </main>
      )}

      <footer className="border-t border-cdl-border bg-cdl-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-cdl-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © {new Date().getFullYear()} {bootstrap.company.name}
            <span className="ml-2 text-cdl-faint">· Powered by Catering AI</span>
          </p>
          <div className="flex flex-wrap gap-4">
            {bootstrap.settings.consent.privacyUrl ? (
              <a href={bootstrap.settings.consent.privacyUrl}>{copy.privacy}</a>
            ) : null}
            {bootstrap.settings.support.phone ? (
              <a href={`tel:${bootstrap.settings.support.phone}`}>
                {copy.support} {bootstrap.settings.support.phone}
              </a>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  )
}

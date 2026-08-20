'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { sanitizeStoredPublicPhone } from '@/Lib/publicQuote/phone'
import { isPublicGrillDraftAnswered } from '@/Lib/publicQuote/grillDraft'
import {
  publicQuoteActiveStorageKey,
  publicQuoteSessionHasProgress,
} from '@/Lib/publicQuote/sessionProgress'
import { CateringAiMark } from '@/components/brand/CateringAiMark'
import PublicLocaleSwitcher from '@/components/quotes/PublicLocaleSwitcher'
import PublicQuoteHeroMedia from '@/components/quotes/PublicQuoteHeroMedia'
import {
  publicQuoteCopyrightLine,
  publicQuoteEmblemSrc,
  PublicQuoteBrandLockup,
} from '@/components/quotes/PublicQuoteBrandLockup'
import {
  collectPublicHeroImages,
  PUBLIC_QUOTE_HERO_VIDEO_SRCS,
} from '@/Lib/publicQuote/heroMedia'
import { tw } from '@/Lib/quoteTranslations'

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
    serviceDurationMinutes?: number
    locationBias?: {
      lat: number
      lng: number
      radiusMeters: number
    } | null
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
    reviewedCategoryKeys?: string[]
  }
  grill?: {
    setupAnswered?: boolean
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
    successTitle: 'Obrigado por escolher CDL Services BBQ At Home',
    successBody:
      'Nossa equipe revisará os detalhes e entrará em contato. Guarde este resumo.',
    quote: 'Solicitação',
    date: 'Data',
    name: 'Evento',
    total: 'Estimativa',
    whatsapp: 'Falar no WhatsApp',
    restart: 'Criar outra solicitação',
    privacy: 'Privacidade',
    support: 'Precisa de ajuda?',
    poweredBy: 'Powered by Catering AI',
  },
  en: {
    secure: 'Secure online quote',
    startError: 'We could not start right now. Refresh the page and try again.',
    feature1: 'Build your event at your own pace',
    feature2: 'Estimate calculated with current pricing rules',
    feature3: 'Our team reviews everything before confirmation',
    successEyebrow: 'Request received',
    successTitle: 'Thank you for choosing CDL Services BBQ At Home',
    successBody:
      'Our team will review the details and get in touch. Keep this summary.',
    quote: 'Request',
    date: 'Date',
    name: 'Event',
    total: 'Estimate',
    whatsapp: 'Chat on WhatsApp',
    restart: 'Create another request',
    privacy: 'Privacy',
    support: 'Need help?',
    poweredBy: 'Powered by Catering AI',
  },
  es: {
    secure: 'Cotización online segura',
    startError: 'No pudimos iniciar ahora. Actualiza la página e inténtalo de nuevo.',
    feature1: 'Arma tu evento a tu ritmo',
    feature2: 'Estimación calculada con las reglas actuales',
    feature3: 'Nuestro equipo revisa todo antes de confirmar',
    successEyebrow: 'Solicitud recibida',
    successTitle: 'Gracias por elegir CDL Services BBQ At Home',
    successBody:
      'Nuestro equipo revisará los detalles y se pondrá en contacto. Guarda este resumen.',
    quote: 'Solicitud',
    date: 'Fecha',
    name: 'Evento',
    total: 'Estimación',
    whatsapp: 'Hablar por WhatsApp',
    restart: 'Crear otra solicitud',
    privacy: 'Privacidad',
    support: '¿Necesitas ayuda?',
    poweredBy: 'Powered by Catering AI',
  },
} as const

function hydrateDraft(
  rules: CommercialRulesSnapshot,
  locale: QuoteLanguage,
  branchId: string | null,
  consentVersion: string,
  draft?: IntakeDraft | null,
  currentStep = 0,
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
  const grillSetupAnswered = isPublicGrillDraftAnswered(draft.grill, currentStep)
  const hasGrill = grillSetupAnswered ? Boolean(draft.grill?.hasGrill) : false

  return {
    ...base,
    language: locale,
    branchId,
    customerFirstName: firstName,
    customerLastName: lastName,
    customerDraftName: [firstName, lastName].filter(Boolean).join(' '),
    customerDraftPhone: sanitizeStoredPublicPhone(draft.contact?.phone),
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
    grillSetupAnswered,
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
  const [restoredStep, setRestoredStep] = useState(0)
  const [success, setSuccess] =
    useState<PublicQuoteSubmissionResult | null>(null)
  const activeStorageKey = publicQuoteActiveStorageKey(bootstrap.company.slug)
  const autoResumeAttemptedRef = useRef(false)
  const defaultBranch =
    bootstrap.branches.find((branch) => branch.isDefault) ??
    bootstrap.branches[0] ??
    null
  const heroImages = useMemo(
    () =>
      collectPublicHeroImages({
        companySlug: bootstrap.company.slug,
        heroImageUrl: bootstrap.settings.heroImageUrl,
      }),
    [bootstrap.company.slug, bootstrap.settings.heroImageUrl],
  )
  const initialState = useMemo(
    () =>
      hydrateDraft(
        bootstrap.commercialRules,
        locale,
        defaultBranch?.id ?? null,
        bootstrap.settings.consent.version,
        restoredDraft,
        restoredStep,
      ),
    [
      bootstrap.commercialRules,
      bootstrap.settings.consent.version,
      defaultBranch?.id,
      locale,
      restoredDraft,
      restoredStep,
    ],
  )

  async function startQuote(options: { auto?: boolean; forceNew?: boolean } = {}) {
    if (starting) return
    setStarting(true)
    setStartError(false)
    try {
      const forceNew = Boolean(options.forceNew) && !options.auto
      const response = await fetch('/api/public/quote-intake/session', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companySlug: bootstrap.company.slug,
          locale,
          website: '',
          ...(forceNew ? { forceNew: true } : {}),
        }),
      })
      const result = (await response.json().catch(() => null)) as
        | { session?: { draft?: IntakeDraft | null; currentStep?: number } }
        | { error?: string }
        | null
      if (!response.ok || !result || !('session' in result)) {
        throw new Error('session_start_failed')
      }
      const draft = result.session?.draft ?? null
      const step = Number.isFinite(Number(result.session?.currentStep))
        ? Math.max(0, Math.min(5, Number(result.session?.currentStep)))
        : 0
      const hasProgress = publicQuoteSessionHasProgress(draft, step)
      if (options.auto && !hasProgress) {
        try {
          sessionStorage.removeItem(activeStorageKey)
        } catch {
          /* ignore quota / private mode */
        }
        return
      }
      setRestoredDraft(draft)
      setRestoredStep(step)
      try {
        sessionStorage.setItem(activeStorageKey, '1')
      } catch {
        /* ignore quota / private mode */
      }
      setStarted(true)
    } catch {
      if (!options.auto) setStartError(true)
    } finally {
      setStarting(false)
    }
  }

  useEffect(() => {
    if (autoResumeAttemptedRef.current || started || success) return
    try {
      if (sessionStorage.getItem(activeStorageKey) !== '1') return
    } catch {
      return
    }
    autoResumeAttemptedRef.current = true
    const timer = window.setTimeout(() => {
      void startQuote({ auto: true })
    }, 0)
    return () => window.clearTimeout(timer)
    // Public locale routes remount this tree; resume only from the storage flag.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStorageKey, locale])

  const style = {
    '--brand-primary': bootstrap.company.primaryColor,
    '--brand-primary-2': bootstrap.company.accentColor,
  } as React.CSSProperties
  const emblemSrc = publicQuoteEmblemSrc(
    bootstrap.company.slug,
    bootstrap.company.name,
    bootstrap.company.logoUrl,
  )

  return (
    <div style={style} className="min-h-screen bg-cdl-bg text-cdl-fg">
      <header className="sticky top-0 z-40 border-b border-cdl-border/80 bg-cdl-bg/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div
              data-tenant-logo
              className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white"
            >
              {bootstrap.company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bootstrap.company.logoUrl}
                  alt={bootstrap.company.name}
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center rounded-full bg-[var(--brand-primary)] text-sm font-black text-white">
                  {bootstrap.company.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <PublicQuoteBrandLockup
              slug={bootstrap.company.slug}
              name={bootstrap.company.name}
              tagline={copy.secure}
            />
          </div>
          <PublicLocaleSwitcher
            companySlug={bootstrap.company.slug}
            locale={locale}
            allowedLocales={bootstrap.settings.allowedLocales}
          />
        </div>
      </header>

      {success ? (
        <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center px-4 py-12 sm:px-8">
          <section
            data-success-screen
            className="w-full rounded-[2rem] border border-cdl-border bg-cdl-surface p-7 shadow-xl sm:p-10"
          >
            {emblemSrc ? (
              <div
                data-success-flame-art
                className="cdl-success-emblem relative mx-auto flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32"
              >
                <span
                  aria-hidden
                  className="cdl-success-emblem-halo pointer-events-none absolute inset-[-22%] rounded-full"
                />
                <div className="cdl-success-emblem-mark relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={emblemSrc}
                    alt=""
                    className="h-full w-full scale-[1.08] object-cover object-center"
                  />
                </div>
              </div>
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
                ✓
              </span>
            )}
            <p className="mt-6 text-center text-xs font-black uppercase tracking-[0.2em] text-[var(--brand-primary)]">
              {copy.successEyebrow}
            </p>
            <h1 className="mt-2 text-center text-3xl font-black tracking-tight text-cdl-title sm:text-4xl">
              {copy.successTitle}
            </h1>
            <p className="mt-3 text-center text-cdl-muted">{copy.successBody}</p>
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
                onClick={() => {
                  try {
                    sessionStorage.removeItem(activeStorageKey)
                  } catch {
                    /* ignore quota / private mode */
                  }
                }}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-cdl-border px-6 text-sm font-bold"
              >
                {copy.restart}
              </Link>
            </div>
          </section>
        </main>
      ) : started ? (
        <QuoteWizardCore
          key={`${locale}-${restoredDraft ? 'restored' : 'new'}`}
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
          initialStep={restoredStep}
          initialReviewedCategoryKeys={
            restoredDraft?.selection?.reviewedCategoryKeys
          }
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
            serviceDurationMinutes: bootstrap.settings.serviceDurationMinutes,
            locationBias: bootstrap.settings.locationBias ?? null,
          }}
          onPublicSuccess={setSuccess}
        />
      ) : (
        <main>
          {/* LANDING AGUARDANDO ASSETS FINAIS when no tenant hero image is configured. */}
          <section
            className="relative isolate overflow-hidden border-b border-cdl-border"
            data-public-landing
            data-landing-pending-assets={
              PUBLIC_QUOTE_HERO_VIDEO_SRCS.length > 0 ||
              heroImages.length > 0
                ? undefined
                : 'true'
            }
          >
            <div
              data-public-hero-frame
              className="relative h-[42vh] min-h-[16.5rem] max-h-[22rem] overflow-hidden lg:absolute lg:inset-0 lg:h-auto lg:min-h-0 lg:max-h-none lg:-z-10"
            >
              <PublicQuoteHeroMedia
                videos={PUBLIC_QUOTE_HERO_VIDEO_SRCS}
                media={heroImages}
                posterUrl={bootstrap.settings.heroImageUrl}
              />
            </div>
            <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-8 bg-[#101828] px-4 py-8 text-white sm:px-8 lg:min-h-[34rem] lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)] lg:gap-10 lg:bg-transparent lg:py-16">
              <div>
                <p className="mt-0 text-xs font-black uppercase tracking-[0.24em] text-[var(--brand-primary-2)]">
                  {bootstrap.settings.landing.eyebrow}
                </p>
                <h1 className="mt-4 max-w-4xl text-3xl font-black leading-[1.04] tracking-[-0.04em] sm:text-5xl lg:mt-5 lg:text-6xl">
                  {bootstrap.settings.landing.title}
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-white/78 sm:text-lg sm:leading-8 lg:mt-6">
                  {bootstrap.settings.landing.subtitle}
                </p>
                <button
                  type="button"
                  data-landing-start-quote
                  onClick={() => void startQuote({ forceNew: true })}
                  disabled={starting}
                  className="mt-6 inline-flex min-h-14 items-center justify-center rounded-2xl bg-[var(--brand-primary)] px-8 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60 lg:mt-8"
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

      {started && !success ? (
        <div
          data-public-wizard-product
          className="pointer-events-none fixed bottom-24 left-5 z-20 hidden lg:block"
          aria-hidden
        >
          <CateringAiMark size="sm" className="opacity-80 shadow-sm" />
        </div>
      ) : null}

      {!started || success ? (
      <footer className="border-t border-cdl-border bg-cdl-surface">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-10 text-center sm:px-8">
          {emblemSrc ? (
            <div
              data-footer-cdl-logo
              className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-white shadow-md sm:h-36 sm:w-36"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={emblemSrc}
                alt={bootstrap.company.name}
                className="h-full w-full scale-[1.08] object-cover object-center"
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <p
              data-footer-since-pioneer
              className="text-sm font-semibold tracking-tight text-cdl-title sm:text-base"
            >
              {tw(locale, 'footerSincePioneer')}
            </p>
            <p className="text-[11px] text-cdl-faint">
              {publicQuoteCopyrightLine(
                bootstrap.company.slug,
                bootstrap.company.name,
                new Date().getFullYear(),
              )}
            </p>
          </div>
          <p
            data-powered-by
            aria-label={copy.poweredBy}
            className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] leading-[22px] tracking-wide text-cdl-faint"
          >
            <CateringAiMark size="footer" variant="icon" className="!p-0" />
            <span>{copy.poweredBy}</span>
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-cdl-muted">
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
      ) : null}
    </div>
  )
}

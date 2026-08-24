'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
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
import { PscsOneMark } from '@/components/brand/PscsOneMark'
import PublicLocaleSwitcher from '@/components/quotes/PublicLocaleSwitcher'
import PublicLandingCinematic from '@/components/quotes/PublicLandingCinematic'
import { usePublicQuoteThemeLock } from '@/components/quotes/usePublicQuoteThemeLock'
import {
  publicQuoteCopyrightLine,
  publicQuoteEmblemSrc,
  PublicQuoteBrandLockup,
} from '@/components/quotes/PublicQuoteBrandLockup'
import { collectPublicHeroImages } from '@/Lib/publicQuote/heroMedia'
import { scrollPublicQuoteToTop } from '@/Lib/publicQuote/scrollPublicQuoteToTop'
import {
  clearPublicQuoteSuccess,
  getPublicQuoteSuccessSnapshot,
  readPublicQuoteSuccess,
  subscribePublicQuoteSuccess,
  writePublicQuoteSuccess,
} from '@/Lib/publicQuote/successSession'
import PublicQuoteSuccessScreen from '@/components/quotes/PublicQuoteSuccessScreen'
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
    heroGallery?: Array<{
      id: string
      src: string
      originalSrc: string
      sourceFilename: string
      alt: string
      mobilePosition: string
      tabletPosition?: string
      desktopPosition: string
      width: number
      height: number
    }>
    howItWorksVideo?: { src: string; poster: string | null } | null
    howItWorksVideos?: Array<{
      src: string
      poster: string | null
      locale: 'pt' | 'en' | 'es'
    }>
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
      instagramUrl?: string | null
      instagramHandle?: string | null
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
    privacy: 'Privacidade',
    support: 'Precisa de ajuda?',
    poweredBy: 'Powered by',
    poweredByLabel: 'Powered by PSCS One',
    howItWorks: 'Conheça como funciona',
    howItWorksTitle: 'Como funciona',
    howItWorksClose: 'Fechar',
    startQuote: 'COMEÇAR COTAÇÃO',
  },
  en: {
    secure: 'Secure online quote',
    startError: 'We could not start right now. Refresh the page and try again.',
    feature1: 'Build your event at your own pace',
    feature2: 'Estimate calculated with current pricing rules',
    feature3: 'Our team reviews everything before confirmation',
    privacy: 'Privacy',
    support: 'Need help?',
    poweredBy: 'Powered by',
    poweredByLabel: 'Powered by PSCS One',
    howItWorks: 'See how it works',
    howItWorksTitle: 'How it works',
    howItWorksClose: 'Close',
    startQuote: 'START QUOTE',
  },
  es: {
    secure: 'Cotización online segura',
    startError: 'No pudimos iniciar ahora. Actualiza la página e inténtalo de nuevo.',
    feature1: 'Arma tu evento a tu ritmo',
    feature2: 'Estimación calculada con las reglas actuales',
    feature3: 'Nuestro equipo revisa todo antes de confirmar',
    privacy: 'Privacidad',
    support: '¿Necesitas ayuda?',
    poweredBy: 'Powered by',
    poweredByLabel: 'Powered by PSCS One',
    howItWorks: 'Conoce cómo funciona',
    howItWorksTitle: 'Cómo funciona',
    howItWorksClose: 'Cerrar',
    startQuote: 'COMENZAR COTIZACIÓN',
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
  const [liveSuccess, setLiveSuccess] =
    useState<PublicQuoteSubmissionResult | null>(null)
  const storedSuccessRaw = useSyncExternalStore(
    (onChange) => subscribePublicQuoteSuccess(bootstrap.company.slug, onChange),
    () => getPublicQuoteSuccessSnapshot(bootstrap.company.slug),
    () => null,
  )
  const storedSuccess = useMemo(
    () => (storedSuccessRaw ? readPublicQuoteSuccess(bootstrap.company.slug) : null),
    [bootstrap.company.slug, storedSuccessRaw],
  )
  const success = liveSuccess ?? storedSuccess
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
        managed: bootstrap.settings.heroGallery,
      }),
    [
      bootstrap.company.slug,
      bootstrap.settings.heroGallery,
      bootstrap.settings.heroImageUrl,
    ],
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

  function handlePublicSuccess(result: PublicQuoteSubmissionResult) {
    writePublicQuoteSuccess(bootstrap.company.slug, result)
    try {
      sessionStorage.removeItem(activeStorageKey)
    } catch {
      /* ignore quota / private mode */
    }
    setLiveSuccess(result)
  }

  function handleRestart() {
    clearPublicQuoteSuccess(bootstrap.company.slug)
    try {
      sessionStorage.removeItem(activeStorageKey)
    } catch {
      /* ignore quota / private mode */
    }
    autoResumeAttemptedRef.current = true
    setRestoredDraft(null)
    setRestoredStep(0)
    setLiveSuccess(null)
    setStarted(false)
    scrollPublicQuoteToTop()
    window.requestAnimationFrame(() => scrollPublicQuoteToTop())
  }

  useEffect(() => {
    if (autoResumeAttemptedRef.current || started || success) return
    if (readPublicQuoteSuccess(bootstrap.company.slug)) return
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
  }, [activeStorageKey, locale, success])

  const wizardActive = started && !success
  usePublicQuoteThemeLock(wizardActive ? 'wizard-light' : 'landing-dark')

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
    <div
      style={style}
      data-public-quote-shell
      data-theme={wizardActive ? 'light' : 'dark'}
      data-public-wizard-theme={wizardActive ? 'light-locked' : undefined}
      data-public-landing-theme={wizardActive ? undefined : 'dark'}
      className="public-quote-shell min-h-screen bg-cdl-bg text-cdl-fg"
    >
      <header
        className={`public-quote-header sticky top-0 z-40 border-b backdrop-blur-md ${
          wizardActive
            ? 'border-cdl-border/80 bg-cdl-bg/95'
            : 'border-white/10 bg-black/45'
        }`}
      >
        <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-8">
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
        <PublicQuoteSuccessScreen
          locale={locale}
          companySlug={bootstrap.company.slug}
          companyName={bootstrap.company.name}
          currencyCode={bootstrap.company.currencyCode}
          emblemSrc={emblemSrc}
          support={bootstrap.settings.support}
          success={success}
          restartHref={`/quote/${bootstrap.company.slug}/${locale}`}
          onRestart={handleRestart}
        />
      ) : started ? (
        <div data-public-wizard-theme="light-locked" data-theme="light">
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
          onPublicSuccess={handlePublicSuccess}
        />
        </div>
      ) : (
        <main>
          {/* LANDING AGUARDANDO ASSETS FINAIS when no tenant hero image is configured. */}
          <PublicLandingCinematic
            locale={locale}
            heroImages={heroImages}
            posterUrl={bootstrap.settings.heroImageUrl}
            videos={
              bootstrap.settings.howItWorksVideos ??
              (bootstrap.settings.howItWorksVideo
                ? [
                    {
                      src: bootstrap.settings.howItWorksVideo.src,
                      poster: bootstrap.settings.howItWorksVideo.poster,
                      locale,
                    },
                  ]
                : [])
            }
            starting={starting}
            startError={startError}
            startErrorText={copy.startError}
            onStart={() => void startQuote({ forceNew: true })}
          />
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

      {!started && !success ? (
      <footer className="public-landing-footer" data-public-landing-footer>
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-6 text-center sm:px-8">
          {emblemSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              data-landing-cdl-logo
              src={emblemSrc}
              alt={bootstrap.company.name}
              className="public-landing-cdl-logo"
            />
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

      {/* Success closes on the PSCS One signature alone — the CDL story already
          played out above it, so no second lockup competes with the fire mark. */}
      {success ? (
      <footer className="public-success-footer" data-success-footer>
        <div
          data-powered-by
          aria-label={copy.poweredByLabel}
          className="public-success-powered"
        >
          <span className="public-success-powered-label">{copy.poweredBy}</span>
          <PscsOneMark size="footer" variant="full" className="shadow-sm" />
        </div>
      </footer>
      ) : null}
    </div>
  )
}

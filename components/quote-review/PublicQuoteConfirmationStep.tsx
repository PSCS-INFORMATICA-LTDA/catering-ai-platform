'use client'

import { useMemo } from 'react'
import type { PackageItem, PackageSideItem } from '@/Lib/packageConfiguration'
import type {
  PackageOptionGroupItem,
  PackageOptionGroupRecord,
} from '@/Lib/packageOptionGroups'
import type { PricingBreakdown } from '@/Lib/pricing/pricingBreakdownTypes'
import { getQuoteStrings } from '@/Lib/quoteTranslations'
import type { QuoteLanguage, WizardState } from '@/Lib/quoteWizardTypes'
import QuoteReviewLayout from './QuoteReviewLayout'
import {
  mapWizardBreakdownToQuoteReview,
  type WizardSelectedAdditional,
} from './mapWizardToQuoteReview'
import type { QuoteReviewPackageFields } from './quoteReviewPackageSummary'
import { PricingPreviewStatus } from './PricingBreakdownView'

export default function PublicQuoteConfirmationStep({
  state,
  breakdown,
  pricingLoading,
  pricingError,
  onRetryPricing,
  customerName,
  packageName,
  packageImageUrl,
  selectedPackage,
  allPackages,
  packageOptionGroups,
  packageOptionGroupItems,
  packageItems,
  packageSideItems,
  fromWithSidesSection,
  additionals,
  currency = 'USD',
  language,
  consentLabel,
  privacyUrl,
  mileageReviewRequired = false,
  saving,
  submitError,
  onConsentChange,
  onGoToStep,
  onBack,
  onSubmit,
}: {
  state: WizardState
  breakdown: PricingBreakdown | null
  pricingLoading: boolean
  pricingError: { message: string; code?: string } | null
  onRetryPricing: () => void
  customerName: string
  packageName: string | null
  packageImageUrl: string | null
  selectedPackage: QuoteReviewPackageFields | null
  allPackages: QuoteReviewPackageFields[]
  packageOptionGroups: PackageOptionGroupRecord[]
  packageOptionGroupItems: PackageOptionGroupItem[]
  packageItems: PackageItem[]
  packageSideItems: PackageSideItem[]
  fromWithSidesSection: boolean
  additionals: WizardSelectedAdditional[]
  currency?: string
  language: QuoteLanguage
  consentLabel: string
  privacyUrl?: string | null
  mileageReviewRequired?: boolean
  saving: boolean
  submitError: boolean
  onConsentChange: (accepted: boolean) => void
  onGoToStep: (step: number) => void
  onBack: () => void
  onSubmit: () => void
}) {
  const copy = getQuoteStrings(language)
  const w = copy.wizard
  const reviewData = useMemo(
    () =>
      breakdown
        ? mapWizardBreakdownToQuoteReview({
            state,
            breakdown,
            customerName,
            packageName,
            packageImageUrl,
            selectedPackage,
            allPackages,
            packageOptionGroups,
            packageOptionGroupItems,
            packageItems,
            packageSideItems,
            fromWithSidesSection,
            additionals,
            billableGuestCount: breakdown.guest_counts.billable_guest_count,
            displayLanguage: language,
          })
        : null,
    [
      state,
      breakdown,
      customerName,
      packageName,
      packageImageUrl,
      selectedPackage,
      allPackages,
      packageOptionGroups,
      packageOptionGroupItems,
      packageItems,
      packageSideItems,
      fromWithSidesSection,
      additionals,
      language,
    ],
  )
  const pricingMessage =
    pricingError?.code === 'timeout'
      ? w.pricingTimeout
      : pricingError?.code === 'rate_limited'
        ? w.pricingRateLimited
        : !state.packageId
          ? w.pricingMissingPackage
          : pricingError?.message &&
              pricingError.message !== 'timeout' &&
              pricingError.message !== 'Request could not be processed.'
            ? pricingError.message
            : pricingError
              ? w.pricingCalcError
              : null
  const canSubmit =
    Boolean(breakdown) &&
    !pricingLoading &&
    !pricingError &&
    state.publicConsentAccepted &&
    !saving
  void currency

  return (
    <div className="space-y-6 pb-8">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--brand-primary)]">
          06 · {copy.review.summary}
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-cdl-title">
          {copy.review.summary}
        </h2>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label={w.editStep}>
        {copy.wizardStepsShort.slice(0, 5).map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => onGoToStep(index)}
            className="rounded-full border border-cdl-border px-3 py-1.5 text-xs font-bold text-cdl-muted"
          >
            {label} · {w.editStep}
          </button>
        ))}
      </nav>

      <section className="grid gap-3 rounded-2xl border border-cdl-border bg-cdl-surface p-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-cdl-muted">
            {w.confirmSectionClient}
          </p>
          <p className="mt-1 font-semibold text-cdl-title">{customerName || '—'}</p>
          <p className="text-sm text-cdl-text-secondary">
            {state.customerDraftPhone || '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-cdl-muted">
            {w.confirmSectionEvent}
          </p>
          <p className="mt-1 font-semibold text-cdl-title">
            {state.eventName || '—'}
          </p>
          <p className="text-sm text-cdl-text-secondary">
            {state.eventDate} · {state.startTime}–{state.endTime}
          </p>
          <p className="text-sm text-cdl-text-secondary">
            {state.addressFormatted ||
              [state.address, state.city, state.state, state.zipCode]
                .filter(Boolean)
                .join(', ') ||
              '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-cdl-muted">
            {w.confirmSectionGuests}
          </p>
          <p className="mt-1 text-sm text-cdl-text-secondary">
            {w.adults}: {state.adultCount} · {w.children4to12}:{' '}
            {state.children4To12Count} · {w.childrenUnder3}:{' '}
            {state.childrenUnder3Count}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-cdl-muted">
            {w.confirmSectionPackage}
          </p>
          <div className="mt-1 flex items-center gap-3">
            {packageImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={packageImageUrl}
                alt=""
                className="h-14 w-20 rounded-lg object-cover"
              />
            ) : null}
            <p className="font-semibold text-cdl-title">{packageName || '—'}</p>
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs font-bold uppercase tracking-wide text-cdl-muted">
            {w.confirmSectionAdditionals}
          </p>
          <p className="mt-1 text-sm text-cdl-text-secondary">
            {additionals.length > 0
              ? additionals
                  .map((item) => `${item.label} × ${item.quantity}`)
                  .join(' · ')
              : '—'}
          </p>
        </div>
      </section>

      {reviewData && breakdown ? (
        <div className="overflow-hidden rounded-2xl border border-cdl-border bg-cdl-bg shadow-cdl">
          <QuoteReviewLayout
            data={reviewData}
            variant="confirmation"
            breakdown={breakdown}
            rulesVariant="summary"
          />
        </div>
      ) : (
        <section className="rounded-2xl border border-cdl-border bg-cdl-surface p-6 shadow-cdl">
          <PricingPreviewStatus
            loading={pricingLoading && Boolean(state.packageId)}
            error={
              pricingMessage
                ? { message: pricingMessage, code: pricingError?.code }
                : !state.packageId
                  ? { message: w.pricingMissingPackage, code: 'missing_package' }
                  : null
            }
            language={language}
            onRetry={
              state.packageId && !pricingLoading ? onRetryPricing : undefined
            }
          />
        </section>
      )}

      {mileageReviewRequired ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
          {w.mileagePendingReview}
        </p>
      ) : null}

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-cdl-border bg-cdl-surface p-5">
        <input
          type="checkbox"
          checked={state.publicConsentAccepted}
          onChange={(event) => onConsentChange(event.target.checked)}
          className="mt-1 h-5 w-5 accent-[var(--brand-primary)]"
        />
        <span className="text-sm leading-6 text-cdl-text-secondary">
          {consentLabel}{' '}
          {privacyUrl ? (
            <a
              href={privacyUrl}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-[var(--brand-primary)] underline"
            >
              {w.privacyLink}
            </a>
          ) : null}
        </span>
      </label>

      {submitError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {w.publicSubmitError}
        </p>
      ) : null}

      <div className="sticky bottom-0 z-20 -mx-4 flex flex-col-reverse gap-3 border-t border-cdl-border bg-cdl-bg/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-between sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-cdl-border bg-cdl-surface px-6 py-3 text-sm font-bold"
        >
          {copy.back}
        </button>
        <div className="flex flex-col gap-2 sm:flex-row">
          {state.packageId && (pricingError || (!breakdown && !pricingLoading)) ? (
            <button
              type="button"
              onClick={onRetryPricing}
              className="rounded-xl border border-cdl-border px-6 py-3 text-sm font-bold"
            >
              {w.pricingRetry}
            </button>
          ) : null}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            className="cdl-btn-primary min-h-12 px-8 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? w.publicSubmittingRequest : w.publicSubmitRequest}
          </button>
        </div>
      </div>
    </div>
  )
}

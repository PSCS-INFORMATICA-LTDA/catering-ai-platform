'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import type { PackageItem, PackageSideItem } from '@/Lib/packageConfiguration'
import type {
  PackageOptionGroupItem,
  PackageOptionGroupRecord,
} from '@/Lib/packageOptionGroups'
import type { PricingBreakdown } from '@/Lib/pricing/pricingBreakdownTypes'
import { getQuoteStrings } from '@/Lib/quoteTranslations'
import type { QuoteLanguage, WizardState } from '@/Lib/quoteWizardTypes'
import type { SaveQuoteErrorInfo } from '@/Lib/supabaseSaveError'
import type {
  PendingStepIssue,
  StepStatusContext,
} from '@/app/quotes/new/wizardStepStatus'
import { getOptionalStepWarnings } from '@/app/quotes/new/wizardStepStatus'
import QuoteReviewLayout from './QuoteReviewLayout'
import {
  mapWizardBreakdownToQuoteReview,
  type WizardSelectedAdditional,
} from './mapWizardToQuoteReview'
import type { QuoteReviewPackageFields } from './quoteReviewPackageSummary'
import { PricingPreviewStatus } from './PricingBreakdownView'
import SaveQuoteTechnicalError from './SaveQuoteTechnicalError'
import WizardQuoteValidationPanel from './WizardQuoteValidationPanel'

export default function QuoteWizardConfirmationStep({
  state,
  breakdown,
  pricingLoading,
  pricingError,
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
  stepStatusCtx,
  mandatoryPendingSteps,
  quoteReady,
  saving,
  saveErrorInfo,
  isEditMode,
  quoteId,
  onGoToStep,
  onBack,
  onSave,
  onDistanceChange,
  uiLanguage,
}: {
  state: WizardState
  breakdown: PricingBreakdown | null
  pricingLoading: boolean
  pricingError: { message: string; code?: string } | null
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
  stepStatusCtx: StepStatusContext
  mandatoryPendingSteps: PendingStepIssue[]
  quoteReady: boolean
  saving: boolean
  saveErrorInfo: SaveQuoteErrorInfo | null
  isEditMode: boolean
  quoteId?: string
  onGoToStep: (stepIndex: number) => void
  onBack: () => void
  onSave: () => void | Promise<void>
  onDistanceChange: (distance: number) => void
  uiLanguage: QuoteLanguage
}) {
  const chrome = getQuoteStrings(uiLanguage)
  const optionalWarnings = getOptionalStepWarnings(stepStatusCtx)
  const saveDisabled =
    saving ||
    mandatoryPendingSteps.length > 0 ||
    pricingLoading ||
    !breakdown
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
            billableGuestCount:
              breakdown.guest_counts.billable_guest_count,
            displayLanguage: uiLanguage,
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
      uiLanguage,
    ],
  )

  return (
    <div className="space-y-8 pb-8">
      <WizardQuoteValidationPanel
        pendingSteps={mandatoryPendingSteps}
        optionalWarnings={optionalWarnings}
        ready={quoteReady && Boolean(breakdown)}
        onGoToStep={onGoToStep}
        language={uiLanguage}
      />

      {reviewData && breakdown ? (
        <div className="overflow-hidden rounded-2xl border border-cdl-border bg-cdl-bg shadow-cdl">
          <QuoteReviewLayout
            data={reviewData}
            variant="confirmation"
            breakdown={breakdown}
            rulesVariant="summary"
            mileageEditor={
              <label className="mb-4 flex max-w-sm flex-col gap-2">
                <span className="quote-proposal-label">
                  {chrome.wizard.distanceMi}
                </span>
                <input
                  type="number"
                  min={0}
                  value={state.distance}
                  onChange={(event) =>
                    onDistanceChange(
                      Math.max(0, Number(event.target.value) || 0),
                    )
                  }
                  className="rounded-xl border border-cdl-border bg-white px-4 py-3 text-sm text-cdl-fg"
                />
              </label>
            }
          />
        </div>
      ) : (
        <section className="rounded-2xl border border-cdl-border bg-cdl-surface p-6 shadow-cdl">
          <PricingPreviewStatus
            loading={pricingLoading}
            error={pricingError}
            language={uiLanguage}
          />
        </section>
      )}

      {saveErrorInfo ? (
        <SaveQuoteTechnicalError
          errorInfo={saveErrorInfo}
          isEditMode={isEditMode}
          language={uiLanguage}
        />
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-cdl-border bg-cdl-surface px-6 py-3 text-sm font-bold uppercase tracking-wider"
        >
          {chrome.back}
        </button>
        <div className="flex flex-col gap-2 sm:flex-row">
          {isEditMode && quoteId ? (
            <Link
              href={`/quotes/${quoteId}`}
              className="inline-flex items-center justify-center rounded-xl border border-cdl-border px-6 py-3 text-sm font-bold uppercase"
            >
              {chrome.review.cancel}
            </Link>
          ) : null}
          <button
            type="button"
            disabled={saveDisabled}
            onClick={() => void onSave()}
            className="rounded-xl bg-cdl-brand px-8 py-3 text-sm font-black uppercase tracking-wider text-white disabled:opacity-50"
          >
            {saving
              ? chrome.review.saving
              : isEditMode
                ? chrome.review.saveChanges
                : chrome.review.createQuote}
          </button>
        </div>
      </div>
    </div>
  )
}

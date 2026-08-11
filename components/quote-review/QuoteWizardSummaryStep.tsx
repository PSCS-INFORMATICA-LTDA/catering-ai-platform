'use client'

import { getQuoteStrings } from '@/Lib/quoteTranslations'
import Link from 'next/link'
import { useMemo } from 'react'
import type { PendingStepIssue, StepStatusContext } from '@/app/quotes/new/wizardStepStatus'
import { getOptionalStepWarnings } from '@/app/quotes/new/wizardStepStatus'
import type { QuoteTotals } from '@/Lib/calculateQuoteTotals'
import type { WizardState } from '@/Lib/quoteWizardTypes'
import type { CommercialRulesSnapshot } from '@/Lib/supabaseCommercialRules'
import type { SaveQuoteErrorInfo } from '@/Lib/supabaseSaveError'
import QuoteReviewLayout from './QuoteReviewLayout'
import SaveQuoteTechnicalError from './SaveQuoteTechnicalError'
import WizardCompletionProgress from './WizardCompletionProgress'
import WizardQuoteValidationPanel from './WizardQuoteValidationPanel'
import {
  mapWizardToQuoteReview,
  type WizardSelectedAdditional,
} from './mapWizardToQuoteReview'
import type {
  PackageItem,
  PackageSideItem,
} from '@/Lib/packageConfiguration'
import type {
  PackageOptionGroupItem,
  PackageOptionGroupRecord,
} from '@/Lib/packageOptionGroups'
import type { QuoteReviewPackageFields } from './quoteReviewPackageSummary'

export default function QuoteWizardSummaryStep({
  state,
  quoteTotals,
  customerName,
  packageName,
  packageImageUrl,
  packageUnitPrice,
  selectedPackage,
  allPackages,
  packageOptionGroups = [],
  packageOptionGroupItems = [],
  packageItems = [],
  packageSideItems = [],
  fromWithSidesSection,
  billableGuestCount,
  additionals,
  commercialRules,
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
  uiLanguage,
}: {
  state: WizardState
  quoteTotals: QuoteTotals
  customerName: string
  packageName: string | null
  packageImageUrl: string | null
  packageUnitPrice: number
  selectedPackage: QuoteReviewPackageFields | null
  allPackages: QuoteReviewPackageFields[]
  packageOptionGroups?: PackageOptionGroupRecord[]
  packageOptionGroupItems?: PackageOptionGroupItem[]
  packageItems?: PackageItem[]
  packageSideItems?: PackageSideItem[]
  fromWithSidesSection: boolean
  billableGuestCount: number
  additionals: WizardSelectedAdditional[]
  commercialRules: CommercialRulesSnapshot
  stepStatusCtx: StepStatusContext
  mandatoryPendingSteps: PendingStepIssue[]
  quoteReady: boolean
  saving: boolean
  saveErrorInfo: SaveQuoteErrorInfo | null
  isEditMode: boolean
  quoteId?: string
  onGoToStep: (stepIndex: number) => void
  onBack: () => void
  onSave: (openReview: boolean) => void | Promise<void>
  /** Idioma da UI do operador. O preview do documento usa state.language. */
  uiLanguage?: WizardState['language']
}) {
  const reviewData = useMemo(
    () =>
      mapWizardToQuoteReview({
        state,
        quoteTotals,
        customerName,
        packageName,
        packageImageUrl,
        packageUnitPrice,
        selectedPackage,
        allPackages,
        packageOptionGroups,
        packageOptionGroupItems,
        packageItems,
        packageSideItems,
        fromWithSidesSection,
        additionals,
        billableGuestCount,
        commercialRules,
        displayLanguage: uiLanguage ?? state.language,
      }),
    [
      state,
      quoteTotals,
      customerName,
      packageName,
      packageImageUrl,
      packageUnitPrice,
      selectedPackage,
      allPackages,
      packageOptionGroups,
      packageOptionGroupItems,
      packageItems,
      packageSideItems,
      fromWithSidesSection,
      additionals,
      billableGuestCount,
      commercialRules,
      uiLanguage,
    ],
  )

  const hasMandatoryPending = mandatoryPendingSteps.length > 0
  const optionalWarnings = useMemo(
    () => getOptionalStepWarnings(stepStatusCtx),
    [stepStatusCtx],
  )
  const saveDisabled = saving || hasMandatoryPending
  const chrome = getQuoteStrings(uiLanguage ?? state.language)
  const savingLabel = isEditMode ? chrome.review.saving : chrome.review.creating

  return (
    <div className="space-y-8">
      <WizardCompletionProgress stepStatusCtx={stepStatusCtx} />

      <WizardQuoteValidationPanel
        pendingSteps={mandatoryPendingSteps}
        optionalWarnings={optionalWarnings}
        ready={quoteReady}
        onGoToStep={onGoToStep}
        language={uiLanguage ?? state.language}
      />

      {saveErrorInfo ? (
        <SaveQuoteTechnicalError
          errorInfo={saveErrorInfo}
          isEditMode={isEditMode}
          language={uiLanguage ?? state.language}
        />
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-cdl-border bg-cdl-bg shadow-cdl">
        <QuoteReviewLayout data={reviewData} rulesVariant="summary" />
      </div>

      {isEditMode && quoteId ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <Link
            href={`/quotes/${quoteId}`}
            className="rounded-xl border border-cdl-border bg-cdl-surface px-6 py-3 text-center text-sm font-bold uppercase tracking-wider text-cdl-fg transition-colors hover:border-cdl-accent-border"
          >
            {chrome.backToQuote}
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={`/quotes/${quoteId}`}
              className="rounded-xl border border-cdl-border bg-cdl-surface px-6 py-3 text-center text-sm font-bold uppercase tracking-wider text-cdl-fg transition-colors hover:border-cdl-accent-border"
            >
              {chrome.review.cancel}
            </Link>
            <button
              type="button"
              onClick={() => void onSave(false)}
              disabled={saveDisabled}
              className="cdl-btn-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? savingLabel : chrome.review.saveChanges}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onBack}
            disabled={saving}
            className="rounded-xl border border-cdl-border bg-cdl-surface px-6 py-3 text-sm font-bold uppercase tracking-wider text-cdl-fg transition-colors hover:border-cdl-accent-border disabled:cursor-not-allowed disabled:opacity-40"
          >
            {chrome.back}
          </button>
          <button
            type="button"
            onClick={() => void onSave(false)}
            disabled={saveDisabled}
            className="cdl-btn-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? savingLabel : chrome.review.createQuote}
          </button>
          <button
            type="button"
            onClick={() => void onSave(true)}
            disabled={saveDisabled}
            className="rounded-xl border border-cdl-accent-border bg-cdl-surface px-6 py-3 text-sm font-bold uppercase tracking-wider text-cdl-fg transition-colors hover:bg-cdl-muted-bg disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? savingLabel : chrome.review.createQuote}
          </button>
        </div>
      )}
    </div>
  )
}

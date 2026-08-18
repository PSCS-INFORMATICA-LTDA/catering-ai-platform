'use client'

import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import { getQuoteStrings, tw } from '@/Lib/quoteTranslations'

/** Navegação global do Wizard V2 — única fonte de Voltar/Próximo (etapas 0–4). */
export default function QuoteWizardStepNav({
  step,
  wizardStepCount,
  language,
  packageId,
  packageStepMessage,
  packageStepNextDisabled,
  additionalsStepNextDisabled,
  grillStepPendingIssuesCount,
  keepPackageNextVisible = false,
  onBack,
  onNext,
  onPackageNextBlockedClick,
  onAdditionalsNextBlockedClick,
}: {
  step: number
  wizardStepCount: number
  language: QuoteLanguage
  packageId: string | null
  packageStepMessage: string | null
  packageStepNextDisabled: boolean
  additionalsStepNextDisabled: boolean
  grillStepPendingIssuesCount: number
  keepPackageNextVisible?: boolean
  onBack: () => void
  onNext: () => void
  onPackageNextBlockedClick: () => void
  onAdditionalsNextBlockedClick: () => void
}) {
  const quoteStrings = getQuoteStrings(language)
  const w = quoteStrings.wizard

  if (step >= wizardStepCount - 1) return null

  const hideGlobalNext =
    step === 2 && Boolean(packageId) && !keepPackageNextVisible
  const nextDisabled =
    step === wizardStepCount - 1 ||
    (step === 2 && packageStepNextDisabled) ||
    (step === 3 && additionalsStepNextDisabled) ||
    (step === 4 && grillStepPendingIssuesCount > 0)

  return (
    <div className="mt-8 space-y-3">
      {step === 2 && !packageId && packageStepMessage ? (
        <p className="text-center text-sm font-medium text-[var(--brand-primary)] sm:text-right">
          {packageStepMessage}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={step === 0}
          className="rounded-xl border border-cdl-border bg-cdl-surface px-6 py-3 text-sm font-bold uppercase tracking-wider text-cdl-fg transition-colors hover:border-cdl-accent-border disabled:cursor-not-allowed disabled:opacity-40"
        >
          {quoteStrings.back}
        </button>
        {hideGlobalNext ? null : (
          <span className="relative inline-flex w-full sm:w-auto">
            {step === 2 && packageStepNextDisabled ? (
              <button
                type="button"
                aria-label={tw(language, 'nextCompleteOptions')}
                className="absolute inset-0 z-10 cursor-not-allowed rounded-xl"
                onClick={onPackageNextBlockedClick}
              />
            ) : null}
            {step === 3 && additionalsStepNextDisabled ? (
              <button
                type="button"
                aria-label={quoteStrings.wizard.categoriesReviewPendingHeading}
                className="absolute inset-0 z-10 cursor-not-allowed rounded-xl"
                onClick={onAdditionalsNextBlockedClick}
              />
            ) : null}
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled}
              className="cdl-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              {quoteStrings.next}
            </button>
          </span>
        )}
      </div>
    </div>
  )
}

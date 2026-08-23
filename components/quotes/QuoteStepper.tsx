'use client'

import type { StepVisualStatus } from '@/app/quotes/new/wizardStepStatus'
import { getQuoteStrings } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

function stepSegmentClass(status: StepVisualStatus, isCurrent: boolean) {
  if (isCurrent) return 'bg-[var(--brand-primary)]'
  if (status === 'complete') return 'bg-emerald-500'
  if (status === 'error') return 'bg-red-500'
  return 'bg-cdl-border'
}

function stepButtonClass(status: StepVisualStatus, isCurrent: boolean) {
  if (status === 'locked' && !isCurrent) {
    return 'cursor-not-allowed bg-cdl-surface text-cdl-muted opacity-45'
  }
  if (status === 'error') {
    return 'bg-red-50 text-red-800 ring-1 ring-red-200'
  }
  if (isCurrent) {
    return 'bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)] text-[var(--brand-primary)] ring-1 ring-[color-mix(in_srgb,var(--brand-primary-2)_30%,transparent)]'
  }
  if (status === 'complete') {
    return 'bg-cdl-surface text-cdl-muted hover:bg-cdl-hover'
  }
  return 'bg-cdl-surface text-cdl-muted hover:bg-cdl-hover'
}

function stepBadgeClass(status: StepVisualStatus, isCurrent: boolean) {
  if (isCurrent) return 'bg-[var(--brand-primary)] text-white'
  if (status === 'complete') return 'bg-emerald-500 text-white'
  if (status === 'error') return 'bg-red-500 text-white'
  if (status === 'locked') return 'bg-cdl-inset text-cdl-muted'
  return 'bg-cdl-inset text-cdl-muted'
}

export default function QuoteStepper({
  steps,
  shortSteps,
  currentStep,
  additionalsCount = 0,
  language = 'pt',
  getStepStatus,
  onStepClick,
}: {
  steps: readonly string[]
  shortSteps?: readonly string[]
  currentStep: number
  additionalsCount?: number
  language?: QuoteLanguage
  getStepStatus: (index: number) => StepVisualStatus
  onStepClick: (index: number) => void
}) {
  const t = getQuoteStrings(language)

  return (
    <nav
      className="mb-4 rounded-2xl border border-cdl-border bg-cdl-surface p-2 shadow-cdl sm:p-3"
      aria-label="Etapas do wizard"
    >
      <div
        className="mb-2 flex h-1 gap-0.5 overflow-hidden rounded-full"
        aria-hidden
      >
        {steps.map((label, index) => (
          <div
            key={`segment-${label}`}
            className={`h-full flex-1 rounded-full transition-colors duration-300 ${stepSegmentClass(getStepStatus(index), index === currentStep)}`}
          />
        ))}
      </div>

      <ol className="-mx-0.5 flex max-w-full gap-1 px-0.5 pb-0.5 lg:mx-0 lg:grid lg:grid-cols-6 lg:gap-1 lg:overflow-visible lg:pb-0">
        {steps.map((label, index) => {
          const status = getStepStatus(index)
          const isCurrent = index === currentStep
          const stepTitle =
            index === 3 && additionalsCount > 0
              ? t.stepperAdditionals(additionalsCount)
              : label

          return (
            <li
              key={label}
              className="min-w-0 flex-1 lg:min-w-0"
            >
              <button
                type="button"
                onClick={() => {
                  if (status === 'locked') return
                  onStepClick(index)
                }}
                disabled={status === 'locked'}
                aria-disabled={status === 'locked'}
                title={stepTitle}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex w-full min-w-0 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 transition-colors lg:py-2 ${stepButtonClass(status, isCurrent)}`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black lg:h-5 lg:w-5 lg:text-[10px] ${stepBadgeClass(status, isCurrent)}`}
                >
                  {status === 'complete' ? '✓' : status === 'error' ? '!' : index + 1}
                </span>
                <span className="w-full text-center text-[8px] font-semibold uppercase leading-tight tracking-wide sm:hidden">
                  {(shortSteps?.[index] || label).slice(0, 8)}
                </span>
                <span className="hidden w-full text-center text-[8px] font-semibold uppercase leading-tight tracking-wide sm:block lg:text-[9px] xl:text-[10px]">
                  {label}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

'use client'

import {
  countCompletedSteps,
  countMandatoryPendingSteps,
  getCompletionPercentage,
  getStepVisualStatus,
  isQuoteReadyToSave,
  STEPS_COUNT,
  type StepStatusContext,
  type StepVisualStatus,
} from '@/app/quotes/new/wizardStepStatus'
import { getQuoteStrings, tw } from '@/Lib/quoteTranslations'

function stepSegmentClass(status: StepVisualStatus) {
  switch (status) {
    case 'complete':
      return 'bg-cdl-success'
    case 'pending':
      return 'bg-cdl-warning'
    case 'error':
      return 'bg-cdl-action'
    default:
      return 'bg-cdl-border'
  }
}

export default function WizardCompletionProgress({
  stepStatusCtx,
}: {
  stepStatusCtx: StepStatusContext
}) {
  const completedSteps = countCompletedSteps(stepStatusCtx)
  const percentage = getCompletionPercentage(stepStatusCtx)
  const ready = isQuoteReadyToSave(stepStatusCtx)
  const language = stepStatusCtx.language ?? 'pt'
  const stepLabels = getQuoteStrings(
    language === 'en' || language === 'es' ? language : 'pt',
  ).wizardSteps

  return (
    <section className="rounded-2xl border border-cdl-border bg-cdl-surface p-7 shadow-cdl sm:p-9">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="cdl-eyebrow">{tw(language, 'quoteProgress')}</p>
          <p className="mt-2 text-2xl font-bold text-cdl-fg sm:text-3xl">
            {tw(language, 'stepsCompleted', {
              done: completedSteps,
              total: STEPS_COUNT,
            })}
          </p>
          <p className="mt-1 text-sm text-cdl-text-secondary">
            {tw(language, 'completionPercent', { pct: percentage })}
          </p>
        </div>
        <div
          className={`rounded-xl border px-5 py-4 text-center sm:min-w-[16rem] ${
            ready
              ? 'border-cdl-success-border bg-cdl-success-soft'
              : 'border-cdl-warning-border bg-cdl-warning-soft'
          }`}
        >
          <p
            className={`text-xs font-bold uppercase tracking-wider ${
              ready ? 'text-cdl-success' : 'text-cdl-warning'
            }`}
          >
            {ready
              ? tw(language, 'readyToGenerate')
              : tw(language, 'missingMandatory', {
                  count: countMandatoryPendingSteps(stepStatusCtx),
                })}
          </p>
        </div>
      </div>
      <div className="mt-5 flex h-1.5 gap-1 overflow-hidden rounded-full">
        {stepLabels.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className={`flex-1 rounded-full transition-colors ${stepSegmentClass(getStepVisualStatus(index, stepStatusCtx))}`}
            title={label}
          />
        ))}
      </div>
    </section>
  )
}

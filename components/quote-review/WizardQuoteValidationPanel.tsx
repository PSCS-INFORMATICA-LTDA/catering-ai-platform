'use client'

import type { PendingStepIssue } from '@/app/quotes/new/wizardStepStatus'
import { tw } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

export default function WizardQuoteValidationPanel({
  pendingSteps,
  optionalWarnings = [],
  ready,
  onGoToStep,
  language = 'pt',
}: {
  pendingSteps: PendingStepIssue[]
  optionalWarnings?: PendingStepIssue[]
  ready: boolean
  onGoToStep: (stepIndex: number) => void
  language?: QuoteLanguage | string | null
}) {
  const loc: QuoteLanguage =
    language === 'en' || language === 'es' ? language : 'pt'
  const hasWarnings = optionalWarnings.length > 0

  return (
    <section
      className={`rounded-2xl border p-7 shadow-cdl sm:p-9 ${
        ready
          ? 'border-cdl-success-border bg-cdl-success-soft'
          : 'border-cdl-action bg-cdl-red-soft'
      }`}
    >
      <h2
        className={`text-xl font-bold sm:text-2xl ${
          ready ? 'text-cdl-success' : 'text-cdl-action'
        }`}
      >
        {tw(loc, 'pendingTitle')}
      </h2>

      {ready ? (
        <p className="mt-4 text-sm font-semibold text-cdl-success sm:text-base">
          {tw(loc, 'quoteReadyToSave')}
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {pendingSteps.map((pending) => (
            <li
              key={pending.stepIndex}
              className="rounded-xl border border-cdl-action/40 bg-cdl-surface p-4 sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-cdl-action">
                    {pending.label}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-cdl-text-secondary">
                    {pending.issues.map((issue) => (
                      <li key={issue} className="flex gap-2">
                        <span className="text-cdl-action" aria-hidden>
                          •
                        </span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onGoToStep(pending.stepIndex)}
                  className="shrink-0 rounded-xl border border-cdl-action bg-cdl-red-soft px-4 py-2 text-xs font-bold uppercase tracking-wider text-cdl-action transition-colors hover:bg-cdl-action hover:text-white"
                >
                  {tw(loc, 'goToStep')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasWarnings ? (
        <ul className={`space-y-4 ${ready ? 'mt-5' : 'mt-4'}`}>
          {optionalWarnings.map((warning) => (
            <li
              key={`warning-${warning.stepIndex}`}
              className="rounded-xl border border-cdl-warning-border bg-cdl-warning-soft p-4 sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-cdl-warning">
                    {tw(loc, 'warningPrefix', { label: warning.label })}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-cdl-text-secondary">
                    {warning.issues.map((issue) => (
                      <li key={issue} className="flex gap-2">
                        <span className="text-cdl-warning" aria-hidden>
                          •
                        </span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onGoToStep(warning.stepIndex)}
                  className="shrink-0 rounded-xl border border-cdl-warning-border bg-cdl-surface px-4 py-2 text-xs font-bold uppercase tracking-wider text-cdl-warning transition-colors hover:bg-cdl-warning hover:text-[#070707]"
                >
                  {tw(loc, 'goToStep')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

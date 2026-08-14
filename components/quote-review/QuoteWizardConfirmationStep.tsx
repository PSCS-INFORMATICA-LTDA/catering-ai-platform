'use client'

import Link from 'next/link'
import CatalogImageFrame from '@/components/CatalogImageFrame'
import {
  confirmationCancellationPolicy,
  flattenConfirmationCommercialRules,
} from '@/components/quote-review/confirmationRules'
import PricingBreakdownView, {
  PricingPreviewStatus,
} from '@/components/quote-review/PricingBreakdownView'
import SaveQuoteTechnicalError from '@/components/quote-review/SaveQuoteTechnicalError'
import WizardQuoteValidationPanel from '@/components/quote-review/WizardQuoteValidationPanel'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import type { PricingBreakdown } from '@/Lib/pricing/pricingBreakdownTypes'
import { getQuoteStrings, tw } from '@/Lib/quoteTranslations'
import type { QuoteLanguage, WizardState } from '@/Lib/quoteWizardTypes'
import type { SaveQuoteErrorInfo } from '@/Lib/supabaseSaveError'
import type { PendingStepIssue, StepStatusContext } from '@/app/quotes/new/wizardStepStatus'
import { getOptionalStepWarnings } from '@/app/quotes/new/wizardStepStatus'
import { formatUiDate, toBcp47Locale } from '@/Lib/i18n/locales'
import type { WizardSelectedAdditional } from './mapWizardToQuoteReview'

function breakdownLine(breakdown: PricingBreakdown, lineKey: string) {
  return breakdown.lines.find((line) => line.line_key === lineKey) ?? null
}

function formatCurrency(value: number) {
  return `$${Number(value).toFixed(2)}`
}

export default function QuoteWizardConfirmationStep({
  state,
  breakdown,
  pricingLoading,
  pricingError,
  customerName,
  customerPhone,
  customerEmail,
  packageName,
  packageDescription,
  packageImageUrl,
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
  customerPhone?: string | null
  customerEmail?: string | null
  packageName: string | null
  packageDescription?: string | null
  packageImageUrl: string | null
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
  const lang = state.language
  const chrome = getQuoteStrings(uiLanguage)
  const docLang = lang
  const optionalWarnings = getOptionalStepWarnings(stepStatusCtx)
  const saveDisabled = saving || mandatoryPendingSteps.length > 0 || pricingLoading || !breakdown
  const mileage = breakdown ? breakdownLine(breakdown, 'mileage') : null
  const packageLine = breakdown ? breakdownLine(breakdown, 'package') : null
  const rules = breakdown?.rules_applied
  const physicalGuests = breakdown?.guest_counts.physical_guest_count ?? null
  const billableGuests = breakdown?.guest_counts.billable_guest_count ?? null
  const cityState = [state.city, state.state].filter(Boolean).join(' / ')
  const eventLocation = [state.address, cityState, state.zipCode]
    .filter(Boolean)
    .join(' · ')
  const commercialRules = flattenConfirmationCommercialRules()
  const cancellationPolicy = confirmationCancellationPolicy()
  const showPricingPlaceholder = pricingLoading || Boolean(pricingError)

  return (
    <div className="space-y-8 pb-8">
      <WizardQuoteValidationPanel
        pendingSteps={mandatoryPendingSteps}
        optionalWarnings={optionalWarnings}
        ready={quoteReady && Boolean(breakdown)}
        onGoToStep={onGoToStep}
        language={uiLanguage}
      />

      <section className="rounded-2xl border border-cdl-border bg-cdl-surface p-6 shadow-cdl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-cdl-brand">
            {tw(uiLanguage, 'confirmSectionClient')}
          </h3>
          <button
            type="button"
            onClick={() => onGoToStep(0)}
            className="text-xs font-bold uppercase tracking-wider text-cdl-accent"
          >
            {tw(uiLanguage, 'editStep')}
          </button>
        </div>
        <p className="text-xl font-black text-cdl-title">{customerName}</p>
        {customerPhone ? (
          <p className="mt-1 text-sm text-cdl-muted">{customerPhone}</p>
        ) : null}
        {customerEmail ? (
          <p className="text-sm text-cdl-muted">{customerEmail}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-cdl-border bg-cdl-surface p-6 shadow-cdl">
        <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-cdl-brand">
          {tw(uiLanguage, 'confirmSectionEvent')}
        </h3>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase text-cdl-muted">{chrome.wizard.eventName}</dt>
            <dd className="font-semibold text-cdl-fg">{state.eventName || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-cdl-muted">{chrome.review.date}</dt>
            <dd>{state.eventDate ? formatUiDate(state.eventDate, toBcp47Locale(docLang)) : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-cdl-muted">{chrome.review.time}</dt>
            <dd>
              {[state.startTime, state.endTime].filter(Boolean).join(' – ') || '—'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase text-cdl-muted">{chrome.review.location}</dt>
            <dd className="text-sm leading-relaxed">{eventLocation || '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-cdl-border bg-cdl-surface p-6 shadow-cdl">
        <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-cdl-brand">
          {tw(uiLanguage, 'confirmSectionGuests')}
        </h3>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-cdl-muted">{chrome.wizard.adults}</dt>
            <dd className="font-semibold">{state.adultCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-cdl-muted">{chrome.wizard.childrenUnder3}</dt>
            <dd className="font-semibold">{state.childrenUnder3Count}</dd>
          </div>
          <div>
            <dt className="text-xs text-cdl-muted">{chrome.wizard.children4to12}</dt>
            <dd className="font-semibold">{state.children4To12Count}</dd>
          </div>
        </dl>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-cdl-border pt-4 sm:max-w-md">
          <div>
            <dt className="text-xs text-cdl-muted">{tw(uiLanguage, 'physicalGuests')}</dt>
            <dd className="font-semibold">{physicalGuests ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-cdl-muted">{tw(uiLanguage, 'billableGuests')}</dt>
            <dd className="font-semibold">{billableGuests ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-cdl-border bg-cdl-surface p-6 shadow-cdl">
        <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-cdl-brand">
          {tw(uiLanguage, 'confirmSectionPackage')}
        </h3>
        <div className="flex flex-col gap-4 sm:flex-row">
          {packageImageUrl ? (
            <CatalogImageFrame
              src={packageImageUrl}
              alt={packageName ?? ''}
              className="h-40 w-full shrink-0 sm:w-56"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-xl font-black text-cdl-title">{packageName ?? '—'}</p>
            {packageDescription ? (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-cdl-text-secondary">
                {packageDescription}
              </p>
            ) : null}
            {packageLine ? (
              <p className="mt-3 text-sm font-semibold tabular-nums text-cdl-muted">
                {tw(uiLanguage, 'breakdownPackage')}: {formatCurrency(packageLine.amount)}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-cdl-border bg-cdl-surface p-6 shadow-cdl">
        <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-cdl-brand">
          {tw(uiLanguage, 'confirmSectionAdditionals')}
        </h3>
        {additionals.length === 0 ? (
          <p className="text-sm text-cdl-muted">{chrome.review.noAdditionals}</p>
        ) : (
          <ul className="space-y-2">
            {additionals.map((row) => (
              <li key={row.id} className="text-sm">
                {row.label}
                {row.quantity > 0 ? ` × ${row.quantity}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-cdl-border bg-cdl-surface p-6 shadow-cdl">
        <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-cdl-brand">
          {tw(uiLanguage, 'confirmSectionGrill')}
        </h3>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-cdl-muted">{chrome.wizard.hasGrill}</dt>
            <dd>{state.hasGrill ? chrome.wizard.yes : chrome.wizard.no}</dd>
          </div>
          <div>
            <dt className="text-xs text-cdl-muted">{chrome.wizard.grillRentalRequired}</dt>
            <dd>
              {state.grillRentalRequired
                ? `${chrome.wizard.yes} (${state.grillRentalQty})`
                : chrome.wizard.no}
            </dd>
          </div>
          {state.grillPhotoUrl ? (
            <div className="sm:col-span-2">
              <dt className="mb-2 text-xs text-cdl-muted">{tQuotesOrders(docLang, 'docGrillPhoto')}</dt>
              <dd>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={state.grillPhotoUrl}
                  alt=""
                  className="max-h-48 rounded-xl border border-cdl-border object-cover"
                />
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="rounded-2xl border border-cdl-border bg-cdl-surface p-6 shadow-cdl">
        <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-cdl-brand">
          {tw(uiLanguage, 'confirmSectionMileage')}
        </h3>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase text-cdl-muted">
              {chrome.wizard.distanceMi}
            </span>
            <input
              type="number"
              min={0}
              value={state.distance}
              onChange={(e) =>
                onDistanceChange(Math.max(0, Number(e.target.value) || 0))
              }
              className="rounded-xl border border-cdl-border bg-cdl-inset px-4 py-3 text-sm"
            />
          </label>
        </div>
        {breakdown && rules ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-cdl-muted">{tw(uiLanguage, 'mileageOrigin')}</dt>
              <dd>{rules.mileageBaseLocation}</dd>
            </div>
            <div>
              <dt className="text-xs text-cdl-muted">{tw(uiLanguage, 'mileageDestination')}</dt>
              <dd>{eventLocation || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-cdl-muted">{tw(uiLanguage, 'mileageTotalDistance')}</dt>
              <dd>{state.distance} mi</dd>
            </div>
            <div>
              <dt className="text-xs text-cdl-muted">{tw(uiLanguage, 'mileageIncluded')}</dt>
              <dd>{rules.mileageFreeLimit} mi</dd>
            </div>
            <div>
              <dt className="text-xs text-cdl-muted">{tw(uiLanguage, 'mileageChargeable')}</dt>
              <dd>{mileage != null ? `${mileage.quantity} mi` : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-cdl-muted">{tw(uiLanguage, 'mileageRateLabel')}</dt>
              <dd>{formatCurrency(rules.mileageRate)} / mi</dd>
            </div>
            {mileage?.formula ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-cdl-muted">{tw(uiLanguage, 'mileageFormula')}</dt>
                <dd className="text-sm">{mileage.formula}</dd>
              </div>
            ) : null}
          </dl>
        ) : showPricingPlaceholder ? (
          <PricingPreviewStatus
            loading={pricingLoading}
            error={pricingError}
            language={uiLanguage}
          />
        ) : null}
      </section>

      <section className="rounded-2xl border border-cdl-border bg-cdl-surface p-6 shadow-cdl">
        <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-cdl-brand">
          {tw(uiLanguage, 'confirmSectionFinancial')}
        </h3>
        {showPricingPlaceholder ? (
          <PricingPreviewStatus
            loading={pricingLoading}
            error={pricingError}
            language={uiLanguage}
          />
        ) : null}
        {breakdown ? (
          <PricingBreakdownView
            breakdown={breakdown}
            language={uiLanguage}
            emphasizeTotal
            variant="confirmation"
          />
        ) : null}
      </section>

      <section className="rounded-2xl border border-cdl-border bg-cdl-surface p-6 shadow-cdl">
        <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-cdl-brand">
          {tw(uiLanguage, 'confirmSectionRules')}
        </h3>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cdl-text-secondary">
          {commercialRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-cdl-warning-border bg-cdl-warning-soft p-6">
        <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-cdl-brand">
          {tw(uiLanguage, 'confirmSectionCancellation')}
        </h3>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cdl-text-secondary">
          {cancellationPolicy.map((paragraph) => (
            <li key={paragraph}>{paragraph}</li>
          ))}
        </ul>
      </section>

      {saveErrorInfo ? (
        <SaveQuoteTechnicalError errorInfo={saveErrorInfo} isEditMode={isEditMode} language={uiLanguage} />
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

import { getCancellationPolicyCopy } from '../Lib/cdlCancellationPolicy'
import { getIncludedServiceCopy } from '../Lib/cdlIncludedService'
import {
  FOOD_STORAGE_FINE,
  HOLIDAY_MIN_ORDER,
  HOLIDAY_SURCHARGE_PERCENT,
  LATE_PAYMENT_FEE_PER_DAY,
  MILEAGE_BASE_LOCATION,
  MILEAGE_FREE_LIMIT,
  MILEAGE_RATE,
  MILEAGE_UNIT,
  MIN_ORDER_DEC_JAN,
  MIN_ORDER_WEEKDAY,
  MIN_ORDER_WEEKEND,
} from '../Lib/cdlCommercialRules'
import { isSpecialCdlEventDate } from '../Lib/cdlSeasonalRules'
import { emphasizeRuleText } from '../Lib/emphasizeRuleText'
import { tQuotesOrders } from '../Lib/i18n/quotesOrders'
import { tw } from '../Lib/quoteTranslations'
import type { QuoteLanguage } from '../Lib/quoteWizardTypes'

type RulesVariant = 'summary' | 'pdf'

function loc(language?: string | null): QuoteLanguage {
  return language === 'en' || language === 'es' ? language : 'pt'
}

function RulesBlock({
  title,
  items,
  variant,
}: {
  title: string
  items: readonly string[]
  variant: RulesVariant
}) {
  if (items.length === 0) return null

  if (variant === 'pdf') {
    return (
      <div className="quote-proposal-rules-block">
        <h3 className="quote-proposal-rules-subtitle">{title}</h3>
        <ul className="quote-proposal-rules-list">
          {items.map((item) => (
            <li key={item}>{emphasizeRuleText(item)}</li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-cdl-border bg-cdl-inset p-4 sm:p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-cdl-title">
        {title}
      </h3>
      <ul className="mt-3 space-y-2 text-sm text-cdl-text-secondary">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-cdl-title" aria-hidden>
              •
            </span>
            <span>{emphasizeRuleText(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function importantRuleItems(language: QuoteLanguage) {
  const t = (key: Parameters<typeof tQuotesOrders>[1], vars?: Record<string, string | number>) =>
    tQuotesOrders(language, key, vars)

  return {
    minimumOrder: [
      t('ruleMinWeekday', { amount: MIN_ORDER_WEEKDAY }),
      t('ruleMinWeekend', { amount: MIN_ORDER_WEEKEND }),
    ],
    mileage: [
      t('ruleMileageBase', { base: MILEAGE_BASE_LOCATION }),
      t('ruleMileageFree', { limit: MILEAGE_FREE_LIMIT, unit: MILEAGE_UNIT }),
      t('ruleMileageRate', {
        rate: MILEAGE_RATE,
        unit: MILEAGE_UNIT,
        limit: MILEAGE_FREE_LIMIT,
      }),
    ],
    foodPolicy: [
      t('ruleFoodStorage'),
      t('ruleFoodFine', { amount: FOOD_STORAGE_FINE }),
    ],
    latePayment: [t('ruleLatePayment', { amount: LATE_PAYMENT_FEE_PER_DAY })],
    includedService: [getIncludedServiceCopy(language).body],
    decemberJanuary: [
      t('ruleDecJanMin', { amount: MIN_ORDER_DEC_JAN }),
      t('ruleHolidaySurcharge', {
        pct: HOLIDAY_SURCHARGE_PERCENT,
        min: HOLIDAY_MIN_ORDER,
      }),
      t('ruleNoRefundDates'),
    ],
  }
}

/**
 * The canonical rules, minus anything about the deposit.
 *
 * The reservation split is stated by QuoteReservationPaymentCard, which sits
 * directly above this panel everywhere it renders, so repeating it here read as
 * the same rule twice. The percentages themselves are unchanged and still come
 * from the commercial rules via that card.
 */
export function CdlImportantRulesPanel({
  variant = 'summary',
  language = 'pt',
}: {
  variant?: RulesVariant
  language?: string | null
}) {
  const locale = loc(language)
  const rules = importantRuleItems(locale)
  const wrapperClass =
    variant === 'pdf'
      ? 'quote-proposal-rules quote-print-section quote-print-rules'
      : 'quote-print-rules rounded-2xl border border-cdl-border bg-cdl-surface p-7 shadow-cdl sm:p-9'

  const titleClass =
    variant === 'pdf'
      ? 'quote-proposal-section-title'
      : 'cdl-section-title-lg'

  return (
    <section className={wrapperClass}>
      <h2 className={titleClass}>{tw(locale, 'importantRules')}</h2>
      <div
        className={
          variant === 'pdf'
            ? 'quote-proposal-rules-grid'
            : 'mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2'
        }
      >
        <RulesBlock
          title={tQuotesOrders(locale, 'docMinOrderRuleTitle')}
          items={rules.minimumOrder}
          variant={variant}
        />
        <RulesBlock
          title={tQuotesOrders(locale, 'mileageLabel')}
          items={rules.mileage}
          variant={variant}
        />
        <RulesBlock
          title={tQuotesOrders(locale, 'docFoodPolicyRuleTitle')}
          items={rules.foodPolicy}
          variant={variant}
        />
        <RulesBlock
          title={tQuotesOrders(locale, 'docLatePaymentRuleTitle')}
          items={rules.latePayment}
          variant={variant}
        />
        <div data-included-service>
          <RulesBlock
            title={getIncludedServiceCopy(locale).title}
            items={rules.includedService}
            variant={variant}
          />
        </div>
        <RulesBlock
          title={tQuotesOrders(locale, 'docDecJanRuleTitle')}
          items={rules.decemberJanuary}
          variant={variant}
        />
      </div>
    </section>
  )
}

export function CdlCancellationPolicySection({
  variant = 'pdf',
  language = 'pt',
  eventDate = null,
}: {
  variant?: RulesVariant
  language?: string | null
  eventDate?: string | null
}) {
  const locale = loc(language)
  const policy = getCancellationPolicyCopy(locale)
  const sections = [...policy.windows, ...policy.extras]
  const specialDate = isSpecialCdlEventDate(eventDate)

  if (variant === 'summary') {
    return (
      <section
        data-cancellation-policy
        data-special-date-override={specialDate ? 'yes' : 'no'}
        className="rounded-2xl border border-cdl-border bg-cdl-surface p-5 shadow-cdl sm:p-7"
      >
        <h2 className="cdl-section-title-lg">{policy.title}</h2>
        {specialDate ? (
          <p
            data-special-date-cancellation
            className="mt-3 rounded-xl border border-cdl-border bg-cdl-inset px-4 py-3 text-sm font-semibold text-cdl-title"
          >
            {policy.extras.find((section) => section.id === 'yearEnd')?.items[0]}
          </p>
        ) : null}
        <div className="cdl-cancel-policy mt-4 space-y-2">
          {sections.map((section, index) => (
            <details
              key={section.id}
              data-cancel-section={section.id}
              className="cdl-cancel-policy-item"
              open={index < 3}
            >
              <summary className="cdl-cancel-policy-summary">
                {section.label}
              </summary>
              <ul className="cdl-cancel-policy-list">
                {section.items.map((item) => (
                  <li key={item}>{emphasizeRuleText(item)}</li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section
      data-cancellation-policy
      className="quote-proposal-rules quote-print-section"
    >
      <h2 className="quote-proposal-section-title">{policy.title}</h2>
      {sections.map((section) => (
        <div key={section.id} data-cancel-section={section.id}>
          <h3 className="quote-proposal-rules-subtitle">{section.label}</h3>
          <ul className="quote-proposal-rules-list">
            {section.items.map((item) => (
              <li key={item}>{emphasizeRuleText(item)}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

/** Regras + cancelamento (legado / PDF completo). Regras no fim; cancelamento por último. */
export function CdlPdfPoliciesSection({
  language = 'pt',
}: {
  language?: string | null
}) {
  return (
    <>
      <CdlImportantRulesPanel variant="pdf" language={language} />
      <CdlCancellationPolicySection variant="pdf" language={language} />
    </>
  )
}

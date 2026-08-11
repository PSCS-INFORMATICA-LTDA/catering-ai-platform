import {
  BALANCE_PERCENTAGE,
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
  RESERVATION_PERCENTAGE,
} from '../Lib/cdlCommercialRules'
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
      t('ruleMileageRate', { rate: MILEAGE_RATE, unit: MILEAGE_UNIT }),
    ],
    reservation: [
      t('ruleReservationPct', { pct: RESERVATION_PERCENTAGE }),
      t('ruleBalancePct', { pct: BALANCE_PERCENTAGE }),
    ],
    foodPolicy: [
      t('ruleFoodStorage'),
      t('ruleFoodFine', { amount: FOOD_STORAGE_FINE }),
    ],
    latePayment: [t('ruleLatePayment', { amount: LATE_PAYMENT_FEE_PER_DAY })],
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

export function CdlImportantRulesPanel({
  variant = 'summary',
  showReservationText = false,
  language = 'pt',
}: {
  variant?: RulesVariant
  showReservationText?: boolean
  language?: string | null
}) {
  const locale = loc(language)
  const rules = importantRuleItems(locale)
  const wrapperClass =
    variant === 'pdf'
      ? 'quote-proposal-rules quote-print-section quote-print-keep'
      : 'rounded-2xl border border-cdl-border bg-cdl-surface p-7 shadow-cdl sm:p-9'

  const titleClass =
    variant === 'pdf'
      ? 'quote-proposal-section-title'
      : 'cdl-section-title-lg'

  return (
    <section className={wrapperClass}>
      <h2 className={titleClass}>{tw(locale, 'importantRules')}</h2>
      {showReservationText && variant === 'summary' && (
        <p className="mt-4 text-sm leading-relaxed text-cdl-text-secondary">
          {emphasizeRuleText(
            tQuotesOrders(locale, 'docReservationPaymentText'),
          )}
        </p>
      )}
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
          title={tQuotesOrders(locale, 'reservationLabel')}
          items={rules.reservation}
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
}: {
  variant?: RulesVariant
  language?: string | null
}) {
  const locale = loc(language)
  const items = [
    tQuotesOrders(locale, 'cancelPolicy1'),
    tQuotesOrders(locale, 'cancelPolicy2'),
    tQuotesOrders(locale, 'cancelPolicy3', {
      pct: HOLIDAY_SURCHARGE_PERCENT,
      min: HOLIDAY_MIN_ORDER,
    }),
  ]

  if (variant === 'summary') {
    return (
      <section className="rounded-2xl border border-cdl-border bg-cdl-surface p-7 shadow-cdl sm:p-9">
        <h2 className="cdl-section-title-lg">{tw(locale, 'cancellationPolicy')}</h2>
        <ul className="mt-4 space-y-2 text-sm text-cdl-text-secondary">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-cdl-title" aria-hidden>
                •
              </span>
              <span>{emphasizeRuleText(item)}</span>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section className="quote-proposal-rules quote-print-section quote-print-keep">
      <h2 className="quote-proposal-section-title">
        {tw(locale, 'cancellationPolicy')}
      </h2>
      <ul className="quote-proposal-rules-list">
        {items.map((item) => (
          <li key={item}>{emphasizeRuleText(item)}</li>
        ))}
      </ul>
    </section>
  )
}

/** Regras + cancelamento (legado / PDF completo). Preferir regras no topo da cotação. */
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

import { tPayments } from '@/Lib/i18n/payments'
import type { InvoiceFinancialPresentation } from '@/Lib/payments/invoiceFinancialPresentation'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

function money(value: number | null | undefined, currency = 'USD') {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return `${currency} ${Number(value).toFixed(2)}`
}

function rowLabel(
  lang: QuoteLanguage,
  row: InvoiceFinancialPresentation['chargeRows'][number],
) {
  const translated = tPayments(lang, row.labelKey as Parameters<typeof tPayments>[1])
  if (row.labelText && row.kind !== 'info') {
    if (row.kind === 'package' || row.kind === 'additional' || row.kind === 'garnish') {
      return row.labelText
    }
    return `${translated} · ${row.labelText}`
  }
  return translated
}

function Row({
  row,
  currency,
  lang,
}: {
  row: InvoiceFinancialPresentation['chargeRows'][number]
  currency: string
  lang: QuoteLanguage
}) {
  return (
    <div
      data-testid={row.testId}
      className={`flex items-start justify-between gap-3 text-sm ${
        row.emphasize ? 'font-black' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="font-semibold">{rowLabel(lang, row)}</p>
        {row.formula ? <p className="mt-0.5 text-xs text-[#6b6560]">{row.formula}</p> : null}
        {row.included ? (
          <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-emerald-700">
            {tPayments(lang, 'included')}
          </p>
        ) : null}
        {row.quantity != null &&
        row.unitPrice != null &&
        row.amount != null &&
        !row.included &&
        !row.formula ? (
          <p className="mt-0.5 text-xs text-[#6b6560]">
            {row.quantity} × {money(row.unitPrice, currency)} = {money(row.amount, currency)}
          </p>
        ) : null}
      </div>
      <strong className="shrink-0 tabular-nums">
        {row.included
          ? tPayments(lang, 'included')
          : row.amount == null
            ? row.quantity != null
              ? String(row.quantity)
              : '—'
            : money(row.amount, currency)}
      </strong>
    </div>
  )
}

export default function InvoiceFinancialBreakdown({
  presentation,
  locale,
}: {
  presentation: InvoiceFinancialPresentation
  locale?: string | null
}) {
  const lang: QuoteLanguage = locale === 'en' || locale === 'es' ? locale : 'pt'
  const currency = presentation.currency
  const coupon = presentation.coupon

  return (
    <div data-invoice-financial-breakdown className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#6b6560]">
          {tPayments(lang, 'financialBreakdown')}
        </h3>
        <div className="space-y-3">
          {presentation.chargeRows.map((row) => (
            <Row key={row.id} row={row} currency={currency} lang={lang} />
          ))}
        </div>
      </section>

      {presentation.mileage.visible ? (
        <section data-testid="invoice-mileage-calc" className="space-y-1 rounded-xl bg-[#faf7f2] p-3 text-xs text-[#504b47]">
          <p data-testid="invoice-mileage-distance">
            {tPayments(lang, 'mileageDistance')}: {presentation.mileage.distance ?? '—'} mi
          </p>
          <p data-testid="invoice-mileage-included">
            {tPayments(lang, 'mileageIncluded')}:{' '}
            {presentation.mileage.freeLimit == null
              ? '—'
              : tPayments(lang, 'mileageCourtesyValue', { n: presentation.mileage.freeLimit })}
          </p>
          <p data-testid="invoice-mileage-chargeable">
            {tPayments(lang, 'mileageChargeable')}: {presentation.mileage.chargeable ?? '—'} mi
          </p>
          <p data-testid="invoice-mileage-rate">
            {tPayments(lang, 'mileageRate')}: {money(presentation.mileage.rate, currency)} / mi
          </p>
          <p data-testid="invoice-mileage-total" className="font-semibold">
            {tPayments(lang, 'mileageTotal')}: {money(presentation.mileage.fee, currency)}
          </p>
          <p data-testid="invoice-mileage-courtesy-help" className="text-[#6b6560]">
            {tPayments(lang, 'mileageCourtesyHelp', {
              n: presentation.mileage.freeLimit ?? 20,
            })}
          </p>
          {presentation.mileage.fullTrip ? (
            <p data-testid="invoice-mileage-full-trip" className="font-semibold text-[#504b47]">
              {tPayments(lang, 'mileageFullTrip')}
            </p>
          ) : null}
        </section>
      ) : null}

      {coupon ? (
        <section data-testid="invoice-coupon-allocation" className="space-y-1 rounded-xl bg-[#faf7f2] p-3 text-sm">
          <p className="font-bold">
            {tPayments(lang, 'couponCode')}
            {coupon.code ? `: ${coupon.code}` : ''}
            {coupon.campaignName ? ` · ${coupon.campaignName}` : ''}
          </p>
          {coupon.discountType && coupon.discountValue != null ? (
            <p className="text-xs text-[#6b6560]">
              {coupon.discountType === 'percent'
                ? `${coupon.discountValue}%`
                : money(coupon.discountValue, currency)}
            </p>
          ) : null}
          <p data-testid="invoice-discount-amount">
            {tPayments(lang, 'discount')}: -{money(coupon.discountAmount, currency)}
          </p>
          {coupon.applyToDeposit === false ? (
            <p data-testid="invoice-coupon-skips-deposit" className="text-xs font-semibold text-[#504b47]">
              {tPayments(lang, 'couponDoesNotApplyToDeposit')}
            </p>
          ) : coupon.applyToDeposit === true ? (
            <p data-testid="invoice-coupon-applies-to-deposit" className="text-xs font-semibold text-[#504b47]">
              {tPayments(lang, 'couponAppliesToDeposit')}
            </p>
          ) : null}
        </section>
      ) : null}

      <section data-testid="invoice-reconciliation" className="space-y-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#6b6560]">
          {tPayments(lang, 'contractReconciliation')}
        </h3>
        {presentation.reconcileRows.map((row) => (
          <Row key={row.id} row={row} currency={currency} lang={lang} />
        ))}
        {presentation.reservationRows.map((row) => (
          <Row key={row.id} row={row} currency={currency} lang={lang} />
        ))}
        {presentation.paidRows.map((row) => (
          <Row key={row.id} row={row} currency={currency} lang={lang} />
        ))}
      </section>

      {presentation.adjustmentRows.length > 0 ? (
        <section data-testid="invoice-post-event-summary" className="space-y-2">
          {presentation.adjustmentRows.map((row) => (
            <Row key={row.id} row={row} currency={currency} lang={lang} />
          ))}
        </section>
      ) : null}
    </div>
  )
}

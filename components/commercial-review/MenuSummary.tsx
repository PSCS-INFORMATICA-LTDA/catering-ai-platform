import {
  getAdditionalCategory,
  getAdditionalLabel,
  getPackageName,
  type QuoteDetail,
} from '@/app/quotes/[id]/quoteDetailTypes'
import { getPackageHasGarnish } from '@/Lib/packageFieldAccess'
import { tCommercialReview } from '@/Lib/i18n/commercialReview'
import type { QuoteReviewPackageSummary } from '@/components/quote-review/quoteReviewPackageSummary'
import { ReviewCard } from './ReviewCard'

function MenuList({
  title,
  items,
}: {
  title: string
  items: string[]
}) {
  if (!items.length) return null
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-cdl-muted">
        {title}
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-full border border-cdl-border bg-white px-3 py-1 text-sm font-semibold text-cdl-title"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function MenuSummary({
  quote,
  locale,
  packageSummary,
}: {
  quote: QuoteDetail
  locale: string
  packageSummary: QuoteReviewPackageSummary | null
}) {
  const packageName = getPackageName(quote, locale) || quote.package_key
  const hasGarnish = getPackageHasGarnish({ package_key: quote.package_key })
  const selections = quote.package_selection_labels ?? []
  const meats = selections
    .filter((row) => !/side|guarni|acompanh/i.test(`${row.groupTitle} ${row.itemLabel}`))
    .map((row) => row.itemLabel)
  const sidesFromSelections = selections
    .filter((row) => /side|guarni|acompanh/i.test(`${row.groupTitle} ${row.itemLabel}`))
    .map((row) => row.itemLabel)
  const garnishItems = [
    ...sidesFromSelections,
    ...(packageSummary?.garnishDescription
      ? packageSummary.garnishDescription.split(',').map((item) => item.trim()).filter(Boolean)
      : []),
  ]
  const uniqueGarnish = [...new Set(garnishItems)]
  const uniqueMeats = [...new Set(meats)]
  const additionals = (quote.additional_items ?? []).filter(
    (item) => Number(item.total_price ?? 0) > 0,
  )
  const cuts = additionals.filter((item) => {
    const category = getAdditionalCategory(item, locale).toLowerCase()
    return (
      item.item_type === 'MEAT' ||
      category.includes('cut') ||
      category.includes('corte') ||
      category.includes('carne')
    )
  })
  const otherAdditionals = additionals.filter((item) => !cuts.includes(item))

  return (
    <ReviewCard title={tCommercialReview(locale, 'menu')} testId="commercial-review-menu">
      <p className="text-xl font-black text-cdl-title">{packageName || '—'}</p>
      <p className="mt-1 text-sm font-semibold text-cdl-muted">
        {hasGarnish
          ? tCommercialReview(locale, 'withSides')
          : tCommercialReview(locale, 'withoutSides')}
      </p>
      {packageSummary?.packageItemsDescription ? (
        <p className="mt-3 text-sm text-cdl-fg">{packageSummary.packageItemsDescription}</p>
      ) : null}

      <div className="mt-4 grid gap-4">
        <MenuList title={tCommercialReview(locale, 'meats')} items={uniqueMeats} />
        <MenuList title={tCommercialReview(locale, 'sides')} items={uniqueGarnish} />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-cdl-muted">
            {tCommercialReview(locale, 'grill')}
          </p>
          <p className="mt-1 text-sm font-semibold text-cdl-title">
            {quote.grill_rental_required
              ? `${tCommercialReview(locale, 'grillRental')} × ${quote.grill_rental_qty ?? 1}`
              : tCommercialReview(locale, 'ownGrill')}
          </p>
        </div>
        <MenuList
          title={tCommercialReview(locale, 'additionalCuts')}
          items={cuts.map((item) => getAdditionalLabel(item, locale))}
        />
      </div>

      <div className="mt-5" data-testid="commercial-review-additionals">
        <p className="text-[11px] font-bold uppercase tracking-wide text-cdl-muted">
          {tCommercialReview(locale, 'additionals')}
        </p>
        {otherAdditionals.length ? (
          <ul className="mt-2 grid gap-2">
            {otherAdditionals.map((item) => (
              <li
                key={item.item_id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-cdl-border bg-white px-3 py-2"
              >
                <span className="text-sm font-semibold text-cdl-title">
                  {getAdditionalLabel(item, locale)}
                </span>
                <span className="text-sm font-black tabular-nums text-cdl-title">
                  ${Number(item.total_price ?? 0).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-cdl-muted">
            {tCommercialReview(locale, 'emptyAdditionals')}
          </p>
        )}
      </div>
    </ReviewCard>
  )
}

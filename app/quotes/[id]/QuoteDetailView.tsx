import { getCustomerDisplayNameFromQuote } from '@/Lib/getCustomerDisplayName'
import {
  buildQuoteReviewPackageSummaryFromQuote,
  buildSavedQuotePresentationBreakdown,
  mapQuoteDetailToQuoteReview,
} from '@/components/quote-review/mapQuoteDetailToQuoteReview'
import QuoteReviewLayout from '@/components/quote-review/QuoteReviewLayout'
import {
  type QuoteDetail,
  getAdditionalCategory,
  getAdditionalLabel,
  getDiscount,
  getPackageName,
} from './quoteDetailTypes'
import { getPackageHasGarnish } from '@/Lib/packageFieldAccess'
import CdlBrandLogo from '../../../components/CdlBrandLogo'
import {
  getChargedMilesFromSnapshot,
  readQuoteSnapshot,
} from '../../../Lib/readQuoteSnapshot'
import QuoteProposalSharePanel from '@/components/quotes/QuoteProposalSharePanel'
import QuoteTeamAssignmentPanel from '@/components/quotes/QuoteTeamAssignmentPanel'
import QuoteConvertPanel from '@/components/quotes/QuoteConvertPanel'
import QuoteInvoicePanel from '@/components/payments/QuoteInvoicePanel'
import QuoteDetailToolbar from './QuoteDetailToolbar'
import QuoteFlashBanner from '@/components/QuoteFlashBanner'
import { Suspense } from 'react'
import QuoteDebugPanel from './QuoteDebugPanel'

export default function QuoteDetailView({
  quote,
  canConvert = false,
  canManageInvoice = false,
  uiLocale,
}: {
  quote: QuoteDetail
  canConvert?: boolean
  canManageInvoice?: boolean
  uiLocale?: string | null
}) {
  const lang = uiLocale === 'en' || uiLocale === 'es' || uiLocale === 'pt'
    ? uiLocale
    : quote.language ?? 'pt'
  const additionalItems = quote.additional_items ?? []
  const discount = getDiscount(quote)
  const quoteNumber = quote.quote_number ?? 'CDL-Q-0000'
  const customerDisplayName = getCustomerDisplayNameFromQuote(quote)
  const snapshot = readQuoteSnapshot(quote)
  const packageSummary = buildQuoteReviewPackageSummaryFromQuote(
    quote,
    snapshot,
    lang,
  )
  const reviewData = mapQuoteDetailToQuoteReview(quote, lang)
  const breakdown = buildSavedQuotePresentationBreakdown(quote)
  const packageHasGarnish = getPackageHasGarnish({
    package_key: quote.package_key,
  })
  const garnishIncludedTotal =
    packageHasGarnish && packageSummary
      ? Number(packageSummary.garnishTotalPrice ?? 0)
      : 0
  const shareAdditionalLines = additionalItems
    .filter((item) => Number(item.total_price ?? 0) > 0)
    .map((item) => {
      const category = (getAdditionalCategory(item, lang) ?? '').toLowerCase()
      const isGarnish =
        item.item_type === 'SIDE' ||
        category.includes('guarni') ||
        category.includes('side')
      return {
        label: getAdditionalLabel(item, lang) || item.item_key || item.item_id,
        amount: Number(item.total_price ?? 0),
        isGarnish,
      }
    })
  const chargedMiles = getChargedMilesFromSnapshot(
    snapshot.mileageDistance,
    snapshot.mileageFreeLimit,
  )
  const grillRentalTotal = Number(quote.grill_rental_total ?? 0)
  const grillRentalQty = Number(quote.grill_rental_qty ?? 0)
  const holidaySurcharge = Number(quote.holiday_surcharge_amount ?? 0)
  const minimumAdjustment = Number(reviewData.minimumOrderAdjustment ?? 0)
  const minimumOrderAmount = Number(quote.minimum_order_amount ?? 0)
  const mileageFreeLimit = Number(
    snapshot.mileageFreeLimit ?? quote.mileage_free_limit ?? 20,
  )
  const chargedMilesValue = Number(chargedMiles ?? 0)
  const baseSubtotal =
    Number(snapshot.packageTotal ?? 0) +
    Number(snapshot.additionalTotal ?? 0) +
    Number(snapshot.mileageFee ?? 0) +
    grillRentalTotal

  return (
    <main className="quote-detail-page quote-proposal">
      <div className="quote-proposal-toolbar-wrap no-print">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <QuoteDetailToolbar
            quoteId={quote.id}
            quoteNumber={quoteNumber}
            customerName={customerDisplayName}
            eventDate={quote.event_date}
            editHref={`/quotes/${quote.id}/edit?step=churrasqueira`}
          />
          <div className="mt-4">
            <QuoteProposalSharePanel
              quoteId={quote.id}
              quoteNumber={quoteNumber}
              customerName={customerDisplayName}
              customerPhone={quote.phone}
              customerEmail={quote.email}
              eventDate={quote.event_date}
              startTime={quote.start_time}
              endTime={quote.end_time}
              packageLabel={
                getPackageName(quote, quote.language) ||
                quote.package_key ||
                null
              }
              quoteTotal={quote.quote_total}
              reservationAmount={quote.reservation_amount}
              currencyCode={quote.currency_code ?? 'USD'}
              companyName="BBQ At Home"
              adultCount={quote.adult_count}
              childrenUnder3Count={quote.children_under_3_count}
              children4To12Count={quote.children_4_to_12_count}
              addressLine={quote.address_line}
              city={quote.city}
              addressState={quote.state}
              language={quote.language ?? 'pt'}
              packageTotal={snapshot.packageTotal}
              additionalTotal={snapshot.additionalTotal}
              packageHasGarnish={packageHasGarnish}
              garnishIncludedTotal={garnishIncludedTotal}
              garnishDescription={
                packageSummary?.garnishDescription ?? null
              }
              packageItemsDescription={
                packageSummary?.packageItemsDescription ?? null
              }
              packageUnitPrice={
                packageSummary?.packageUnitPrice ??
                snapshot.packageUnitPrice ??
                null
              }
              packageSelectionLines={
                (quote.package_selection_labels ?? []).map((sel) => ({
                  groupTitle: sel.groupTitle,
                  itemLabel: sel.itemLabel,
                }))
              }
              additionalLines={shareAdditionalLines}
              mileageFee={snapshot.mileageFee}
              chargedMiles={chargedMilesValue}
              mileageFreeLimit={mileageFreeLimit}
              grillRentalTotal={grillRentalTotal}
              grillRentalQty={grillRentalQty}
              discountAmount={discount}
              baseSubtotal={baseSubtotal}
              holidaySurchargeAmount={holidaySurcharge}
              minimumOrderAdjustment={minimumAdjustment}
              minimumOrderAmount={minimumOrderAmount}
              commercialReason={holidaySurcharge > 0 ? 'cdl_holiday' : undefined}
              initial={{
                proposal_token: quote.proposal_token ?? null,
                proposal_sent_at: quote.proposal_sent_at ?? null,
                proposal_response: quote.proposal_response ?? 'pending',
                quote_status: quote.quote_status ?? null,
              }}
            />
            <QuoteTeamAssignmentPanel
              quoteId={quote.id}
              proposalResponse={quote.proposal_response}
              quoteStatus={quote.quote_status}
            />
            <QuoteConvertPanel
              quoteId={quote.id}
              quoteNumber={quote.quote_number}
              proposalResponse={quote.proposal_response}
              convertedServiceOrderId={quote.converted_service_order_id}
              canConvert={canConvert}
            />
            <QuoteInvoicePanel
              quoteId={quote.id}
              canManage={canManageInvoice}
              language={lang}
              quoteAccepted={
                quote.proposal_response === 'accepted' ||
                quote.quote_status === 'accepted' ||
                quote.quote_status === 'approved' ||
                quote.quote_status === 'converted'
              }
            />
          </div>
          <Suspense fallback={null}>
            <QuoteFlashBanner />
          </Suspense>
        </div>
      </div>

      <div className="quote-print-compact-header">
        <CdlBrandLogo
          size="sm"
          variant="compact"
          className="quote-print-compact-logo"
        />
        <span className="quote-print-compact-header-title">
          BBQ AT HOME | {quoteNumber}
        </span>
      </div>

      <QuoteReviewLayout
        data={reviewData}
        variant="confirmation"
        breakdown={breakdown}
        rulesVariant="summary"
        afterBody={
          <QuoteDebugPanel
            quote={{
              quote_id: quote.id,
              package_id: quote.package_id,
              package_key: quote.package_key,
              customer_id: quote.customer_id,
              adult_count: quote.adult_count,
              children_under_3_count: quote.children_under_3_count,
              children_4_to_12_count: quote.children_4_to_12_count,
              physical_guest_count: quote.physical_guest_count,
              billable_guest_count: quote.billable_guest_count,
              package_unit_price:
                quote.package_unit_price ?? quote.package_price_per_person,
              package_total: quote.package_total,
              additional_total: quote.additional_total,
              mileage_base_location: quote.mileage_base_location,
              mileage_fee: quote.mileage_fee,
              reservation_percentage: quote.reservation_percentage,
              reservation_amount: quote.reservation_amount,
              balance_due: quote.balance_due,
              quote_total: quote.quote_total,
              missingFields: snapshot.missingFields,
            }}
          />
        }
      />
    </main>
  )
}

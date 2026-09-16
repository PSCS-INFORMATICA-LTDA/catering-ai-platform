import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import type { QuoteDetail } from '@/app/quotes/[id]/quoteDetailTypes'
import {
  getAdditionalCategory,
  getAdditionalLabel,
  getDiscount,
  getPackageName,
} from '@/app/quotes/[id]/quoteDetailTypes'
import {
  buildQuoteReviewPackageSummaryFromQuote,
  buildSavedQuotePresentationBreakdown,
  mapQuoteDetailToQuoteReview,
} from '@/components/quote-review/mapQuoteDetailToQuoteReview'
import QuoteReviewLayout from '@/components/quote-review/QuoteReviewLayout'
import QuoteConvertPanel from '@/components/quotes/QuoteConvertPanel'
import { getPackageHasGarnish } from '@/Lib/packageFieldAccess'
import { readCouponFinancialStory, quoteShareBlockedByCoupon } from '@/Lib/coupons/couponFinancialStory'
import { readCommercialFinancialSummary } from '@/Lib/commercialReview/financialSummary'
import type { CommercialReviewExtras } from '@/Lib/commercialReview/loadWorkspaceExtras'
import { getChargedMilesFromSnapshot, readQuoteSnapshot } from '@/Lib/readQuoteSnapshot'
import { getCustomerDisplayNameFromQuote } from '@/Lib/getCustomerDisplayName'
import { tCommercialReview } from '@/Lib/i18n/commercialReview'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import QuoteFlashBanner from '@/components/QuoteFlashBanner'
import { CommercialReviewHeader } from './CommercialReviewHeader'
import { ContractLifecycleCard } from './ContractLifecycleCard'
import { CustomerSummary } from './CustomerSummary'
import { EventSummary } from './EventSummary'
import { MenuSummary } from './MenuSummary'
import { FinancialSummary } from './FinancialSummary'
import { CouponSummary } from './CouponSummary'
import { CapacitySummary } from './CapacitySummary'
import { InternalNotesCard } from './InternalNotesCard'
import { ProposalActions } from './ProposalActions'
import { CommercialHistory } from './CommercialHistory'
import { CommercialReviewStickyActions } from './CommercialReviewStickyActions'
import { ReviewCard } from './ReviewCard'

const QuoteProposalSharePanel = dynamic(
  () => import('@/components/quotes/QuoteProposalSharePanel'),
  {
    loading: () => (
      <div className="mt-4 h-24 animate-pulse rounded-2xl bg-neutral-100" />
    ),
  },
)
const QuoteTeamAssignmentPanel = dynamic(
  () => import('@/components/quotes/QuoteTeamAssignmentPanel'),
  {
    loading: () => (
      <div className="mt-4 h-20 animate-pulse rounded-2xl bg-neutral-100" />
    ),
  },
)
const QuoteInvoicePanel = dynamic(
  () => import('@/components/payments/QuoteInvoicePanel'),
  {
    loading: () => (
      <div className="mt-4 h-20 animate-pulse rounded-2xl bg-neutral-100" />
    ),
  },
)

export default function CommercialReviewWorkspace({
  quote,
  extras,
  canConvert = false,
  canManageInvoice = false,
  canManageCoupons = false,
  canManageNotes = false,
  uiLocale,
}: {
  quote: QuoteDetail
  extras: CommercialReviewExtras
  canConvert?: boolean
  canManageInvoice?: boolean
  canManageCoupons?: boolean
  canManageNotes?: boolean
  uiLocale?: string | null
}) {
  const lang = uiLocale === 'en' || uiLocale === 'es' || uiLocale === 'pt'
    ? uiLocale
    : quote.language ?? 'pt'
  const snapshot = readQuoteSnapshot(quote)
  const packageSummary = buildQuoteReviewPackageSummaryFromQuote(quote, snapshot, lang)
  const reviewData = mapQuoteDetailToQuoteReview(quote, lang)
  const breakdown = buildSavedQuotePresentationBreakdown(quote)
  const couponStory = readCouponFinancialStory(breakdown)
  const shareBlocked = quoteShareBlockedByCoupon(breakdown)
  const financial = readCommercialFinancialSummary(quote)
  const packageHasGarnish = getPackageHasGarnish({ package_key: quote.package_key })
  const garnishIncludedTotal =
    packageHasGarnish && packageSummary
      ? Number(packageSummary.garnishTotalPrice ?? 0)
      : 0
  const additionalItems = quote.additional_items ?? []
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
  const customerDisplayName = reviewData.customerName
  const quoteNumber = quote.quote_number ?? 'CDL-Q-0000'

  return (
    <main
      data-testid="commercial-review-workspace"
      className="min-h-screen bg-cdl-bg px-4 pb-28 pt-6 text-cdl-fg sm:px-6 lg:px-8"
    >
      <div className="mx-auto grid max-w-3xl gap-4 lg:max-w-5xl">
        <CommercialReviewHeader
          quote={quote}
          locale={lang}
          financial={financial}
          shareBlocked={shareBlocked}
        />
        <Suspense fallback={null}>
          <QuoteFlashBanner />
        </Suspense>
        <ContractLifecycleCard locale={lang} lifecycle={extras.lifecycle} />
        <QuoteConvertPanel
          quoteId={quote.id}
          quoteNumber={quote.quote_number}
          proposalResponse={quote.proposal_response}
          convertedServiceOrderId={quote.converted_service_order_id}
          canConvert={canConvert}
        />
        <CustomerSummary quote={quote} locale={lang} />
        <EventSummary quote={quote} locale={lang} />
        <MenuSummary quote={quote} locale={lang} packageSummary={packageSummary} />
        <FinancialSummary locale={lang} financial={financial} />
        <CouponSummary
          quoteId={quote.id}
          locale={lang}
          canManage={canManageCoupons}
          story={couponStory}
        />
        <ReviewCard
          title={tCommercialReview(lang, 'deposit')}
          testId="commercial-review-payment"
        >
          <p className="mb-3 text-xs text-cdl-muted">
            {tCommercialReview(lang, 'nextPaymentStep')}
          </p>
          <QuoteInvoicePanel
            quoteId={quote.id}
            canManage={canManageInvoice}
            language={quote.language ?? 'pt'}
            quoteAccepted={
              quote.proposal_response === 'accepted' ||
              quote.quote_status === 'accepted' ||
              quote.quote_status === 'approved' ||
              quote.quote_status === 'converted'
            }
            customerPhone={quote.phone}
            customerName={getCustomerDisplayNameFromQuote(quote)}
            quoteNumber={quote.quote_number}
            currencyCode={quote.currency_code ?? 'USD'}
          />
        </ReviewCard>
        <CapacitySummary locale={lang} capacity={extras.capacity} />
        <InternalNotesCard
          quoteId={quote.id}
          locale={lang}
          initialNotes={quote.internal_notes ?? ''}
          canManage={canManageNotes}
        />
        <ProposalActions
          locale={lang}
          quoteId={quote.id}
          quoteNumber={quoteNumber}
          customerName={customerDisplayName}
          eventDate={quote.event_date}
          currentVersionId={extras.currentVersion?.id ?? null}
          currentVersionNumber={extras.currentVersion?.version_number ?? null}
          sharedVersionId={extras.sharedVersionId}
          sharedAt={quote.proposal_sent_at}
          shareBlocked={shareBlocked}
          sharePanel={
            <QuoteProposalSharePanel
              uiLocale={lang}
              quoteId={quote.id}
              quoteNumber={quoteNumber}
              customerName={customerDisplayName}
              customerPhone={quote.phone}
              customerEmail={quote.email}
              eventDate={quote.event_date}
              startTime={quote.start_time}
              endTime={quote.end_time}
              packageLabel={
                getPackageName(quote, quote.language) || quote.package_key || null
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
              garnishDescription={packageSummary?.garnishDescription ?? null}
              packageItemsDescription={packageSummary?.packageItemsDescription ?? null}
              packageUnitPrice={
                packageSummary?.packageUnitPrice ?? snapshot.packageUnitPrice ?? null
              }
              packageSelectionLines={(quote.package_selection_labels ?? []).map((sel) => ({
                groupTitle: sel.groupTitle,
                itemLabel: sel.itemLabel,
              }))}
              additionalLines={shareAdditionalLines}
              mileageFee={snapshot.mileageFee}
              chargedMiles={Number(chargedMiles ?? 0)}
              mileageFreeLimit={Number(
                snapshot.mileageFreeLimit ?? quote.mileage_free_limit ?? 20,
              )}
              grillRentalTotal={grillRentalTotal}
              grillRentalQty={Number(quote.grill_rental_qty ?? 0)}
              discountAmount={getDiscount(quote)}
              baseSubtotal={financial.subtotal}
              holidaySurchargeAmount={Number(quote.holiday_surcharge_amount ?? 0)}
              minimumOrderAdjustment={Number(reviewData.minimumOrderAdjustment ?? 0)}
              minimumOrderAmount={Number(quote.minimum_order_amount ?? 0)}
              commercialReason={
                Number(quote.holiday_surcharge_amount ?? 0) > 0
                  ? 'cdl_holiday'
                  : undefined
              }
              pendingManualCoupon={shareBlocked}
              initial={{
                proposal_token: quote.proposal_token ?? null,
                proposal_sent_at: quote.proposal_sent_at ?? null,
                proposal_response: quote.proposal_response ?? 'pending',
                quote_status: quote.quote_status ?? null,
              }}
            />
          }
          proposalPreview={
            <QuoteReviewLayout
              data={reviewData}
              variant="confirmation"
              breakdown={breakdown}
              rulesVariant="summary"
            />
          }
        />
        <ReviewCard title={tQuotesOrders(lang, 'openTeam')} testId="commercial-review-team">
          <QuoteTeamAssignmentPanel
            quoteId={quote.id}
            proposalResponse={quote.proposal_response}
            quoteStatus={quote.quote_status}
          />
        </ReviewCard>
        <CommercialHistory locale={lang} events={extras.history} />
      </div>
      <CommercialReviewStickyActions locale={lang} shareBlocked={shareBlocked} />
    </main>
  )
}

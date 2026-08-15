'use client'

import type { ReactNode } from 'react'
import { Montserrat, Playfair_Display } from 'next/font/google'
import CatalogImageFrame from '@/components/CatalogImageFrame'
import CdlBrandLogo from '@/components/CdlBrandLogo'
import QuoteGrillPhotoFrame from '@/components/quote-review/QuoteGrillPhotoFrame'
import QuoteReservationPaymentCard from '@/components/quote-review/QuoteReservationPaymentCard'
import QuoteReviewPackageCdlSection, {
  QuoteReviewPackageValueCards,
} from '@/components/quote-review/QuoteReviewPackageCdlSection'
import {
  CdlCancellationPolicySection,
  CdlImportantRulesPanel,
} from '@/components/CdlImportantRulesPanel'
import QuoteCommercialAdjustmentNotice from '@/components/quote-review/QuoteCommercialAdjustmentNotice'
import GuestBreakdownPanel from '@/components/GuestBreakdownPanel'
import { formatMoneyOrDash } from '@/Lib/readQuoteSnapshot'
import {
  displayValue,
  formatBool,
  formatCurrency,
  formatDate,
  formatTime,
} from '@/app/quotes/[id]/quoteDetailTypes'
import { IconCalendar, IconClock, IconLocation } from './QuoteReviewIcons'
import QuoteProposalOverviewCard from './QuoteProposalOverviewCard'
import type { QuoteReviewAdditional, QuoteReviewData } from './quoteReviewTypes'
import { getQuoteStrings, tw } from '@/Lib/quoteTranslations'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import PricingBreakdownView from './PricingBreakdownView'
import type {
  PricingBreakdown,
  PricingBreakdownLine,
} from '@/Lib/pricing/pricingBreakdownTypes'

const proposalSerif = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-proposal-serif',
  display: 'swap',
})

const proposalSans = Montserrat({
  subsets: ['latin'],
  variable: '--font-proposal-sans',
  display: 'swap',
})

function ProposalSection({
  title,
  children,
  className = '',
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`quote-proposal-section quote-print-section ${className}`}
    >
      <h2 className="quote-proposal-section-title">{title}</h2>
      {children}
    </section>
  )
}

function EventRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <div className="quote-proposal-event-row">
      <div className="quote-proposal-event-icon" aria-hidden>
        {icon}
      </div>
      <div className="quote-proposal-event-copy">
        <span className="quote-proposal-label">{label}</span>
        <p className="quote-proposal-value">{displayValue(value)}</p>
      </div>
    </div>
  )
}

function groupAdditionals(items: QuoteReviewAdditional[]) {
  const groups = new Map<string, QuoteReviewAdditional[]>()
  for (const item of items) {
    const list = groups.get(item.category) ?? []
    list.push(item)
    groups.set(item.category, list)
  }
  return Array.from(groups.entries()).map(([category, categoryItems]) => ({
    category,
    items: categoryItems,
  }))
}

function getChargedMiles(
  distance: number | null,
  freeLimit: number | null,
): number | null {
  if (distance == null || freeLimit == null) return null
  return Math.max(0, distance - freeLimit)
}

function findBreakdownLine(
  breakdown: PricingBreakdown,
  lineKey: string,
): PricingBreakdownLine | null {
  return (
    [...breakdown.lines, ...breakdown.adjustments].find(
      (line) => line.line_key === lineKey,
    ) ?? null
  )
}

function ConfirmationProposalBody({
  data,
  breakdown,
  eventLocation,
  eventTimeLabel,
  groupedAdditionals,
  mileageEditor,
}: {
  data: QuoteReviewData
  breakdown: PricingBreakdown
  eventLocation: string
  eventTimeLabel: string
  groupedAdditionals: Array<{
    category: string
    items: QuoteReviewAdditional[]
  }>
  mileageEditor?: ReactNode
}) {
  const lang = data.language ?? 'pt'
  const t = getQuoteStrings(lang)
  const w = t.wizard
  const mileageLine = findBreakdownLine(breakdown, 'mileage')
  const grillRentalLine = findBreakdownLine(breakdown, 'grill_rental')
  const hasCanonicalGrillRental =
    data.grillRentalRequired === true &&
    grillRentalLine != null &&
    grillRentalLine.amount > 0
  const mileageMetadata = mileageLine?.metadata

  return (
    <>
      <QuoteProposalOverviewCard
        customerName={displayValue(data.customerName)}
        eventDate={data.eventDate}
        addressLine={data.addressLine}
        city={data.city}
        state={data.state}
        zipCode={data.zipCode}
        packageSummary={data.packageSummary}
        packageTotal={data.packageTotal}
        additionalTotal={data.additionalTotal}
        mileageFee={data.mileageFee}
        grillRentalTotal={data.grillRentalTotal}
        reservationAmount={data.reservationAmount}
        quoteTotal={data.quoteTotal}
        additionalsCount={data.additionals.length}
        grillRentalRequired={data.grillRentalRequired}
        language={lang}
        showFinance={false}
      />

      <ProposalSection title={t.review.eventSection}>
        <p className="quote-proposal-event-name">
          {displayValue(data.eventName || data.customerName)}
        </p>
        <div className="quote-proposal-event-list">
          <EventRow
            icon={<IconCalendar />}
            label={t.review.date}
            value={formatDate(data.eventDate, lang)}
          />
          <EventRow
            icon={<IconClock />}
            label={t.review.time}
            value={eventTimeLabel}
          />
          <EventRow
            icon={<IconLocation />}
            label={t.review.location}
            value={eventLocation || '—'}
          />
        </div>
      </ProposalSection>

      <div className="quote-proposal-grid-2">
        <ProposalSection title={t.review.packageSection}>
          <QuoteReviewPackageCdlSection
            packageName={data.packageName}
            packageImageUrl={data.packageImageUrl}
            packageSummary={data.packageSummary}
            packageSelections={data.packageSelections}
            physicalGuestCount={data.physicalGuestCount}
            billableGuestCount={data.billableGuestCount}
            packageTotal={data.packageTotal}
            packageUnitPrice={data.packageUnitPrice}
            language={lang}
            showValueCards={false}
            showAdditionalItems={false}
          />
        </ProposalSection>

        <ProposalSection title={t.review.guestsSection}>
          <GuestBreakdownPanel
            guestCounts={data.guestCounts}
            totals={{
              billableGuestCount: breakdown.guest_counts.billable_guest_count,
              physicalGuestCount: breakdown.guest_counts.physical_guest_count,
              quoteTotal: breakdown.total,
            }}
            language={lang}
            showFinancialTotal={false}
          />
        </ProposalSection>
      </div>

      <ProposalSection title={t.review.additionalsSection}>
        {groupedAdditionals.length === 0 ? (
          <p className="quote-proposal-muted">{t.review.noAdditionals}</p>
        ) : (
          <div className="quote-proposal-additionals">
            {groupedAdditionals.map(({ category, items }) => (
              <section key={category} className="quote-proposal-additional-group">
                <h3 className="quote-proposal-category-title">{category}</h3>
                <div className="quote-print-additional-grid quote-proposal-additional-grid">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className="quote-print-additional-card quote-proposal-additional-card"
                    >
                      <CatalogImageFrame
                        src={item.imageUrl}
                        alt={item.label}
                        variant="catalogItem"
                        itemType={item.itemType}
                        categoryPt={item.categoryPt}
                        rounded="none"
                        className="quote-print-thumb quote-proposal-additional-image !min-h-0 !max-h-none !aspect-video"
                      />
                      <div className="quote-print-additional-body quote-proposal-additional-body">
                        <h4 className="quote-proposal-additional-name">
                          {item.label}
                        </h4>
                        <div className="quote-proposal-additional-metrics">
                          <div>
                            <span className="quote-proposal-label">
                              {tQuotesOrders(lang, 'docQtyLabel')}
                            </span>
                            <p className="quote-proposal-additional-metric">
                              {displayValue(item.quantity)}
                            </p>
                          </div>
                          <div>
                            <span className="quote-proposal-label">
                              {tQuotesOrders(lang, 'docUnitPriceLabel')}
                            </span>
                            <p className="quote-proposal-additional-metric">
                              {formatCurrency(item.unitPrice)}
                            </p>
                          </div>
                        </div>
                        <div className="quote-print-additional-total quote-proposal-additional-total">
                          <span className="quote-proposal-label">{w.total}</span>
                          <p className="quote-proposal-additional-price">
                            {formatCurrency(item.totalPrice)}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </ProposalSection>

      <ProposalSection title={tw(lang, 'confirmSectionGrill')}>
        <div className="quote-proposal-info-grid quote-proposal-grill-facts">
          <div className="quote-proposal-info-cell">
            <span className="quote-proposal-label">
              {tw(lang, 'grillAtLocation')}
            </span>
            <p className="quote-proposal-value">
              {data.hasGrill == null
                ? w.notApplicable
                : formatBool(data.hasGrill, lang)}
            </p>
          </div>
          <div className="quote-proposal-info-cell">
            <span className="quote-proposal-label">
              {w.grillRentalRequired}
            </span>
            <p className="quote-proposal-value">
              {hasCanonicalGrillRental
                ? w.yes
                : data.hasGrill == null
                  ? w.notApplicable
                  : w.no}
            </p>
          </div>
          <div className="quote-proposal-info-cell">
            <span className="quote-proposal-label">
              {tQuotesOrders(lang, 'docGrillRentalQty')}
            </span>
            <p className="quote-proposal-value">
              {hasCanonicalGrillRental
                ? displayValue(grillRentalLine.quantity)
                : '—'}
            </p>
          </div>
          <div className="quote-proposal-info-cell">
            <span className="quote-proposal-label">
              {tw(lang, 'grillRentalValue')}
            </span>
            <p className="quote-proposal-value">
              {hasCanonicalGrillRental
                ? formatCurrency(grillRentalLine.amount)
                : '—'}
            </p>
          </div>
          {data.grillNotes ? (
            <div className="quote-proposal-info-cell quote-proposal-info-cell--wide">
              <span className="quote-proposal-label">{w.notes}</span>
              <p className="quote-proposal-value">{data.grillNotes}</p>
            </div>
          ) : null}
        </div>
        <div className="quote-proposal-grill-photo-row">
          <span className="quote-proposal-label">
            {tQuotesOrders(lang, 'docGrillPhoto')}
          </span>
          <QuoteGrillPhotoFrame
            src={
              data.hasGrill && data.grillPhotoUrl ? data.grillPhotoUrl : null
            }
            alt={tQuotesOrders(lang, 'docGrillPhoto')}
            emptyLabel=""
          />
        </div>
      </ProposalSection>

      <ProposalSection
        title={tw(lang, 'confirmSectionMileage')}
        className="quote-proposal-section--compact"
      >
        {mileageEditor}
        {mileageLine ? (
          <div className="quote-proposal-mileage-compact">
            <div className="quote-proposal-mileage-grid">
              <div className="quote-proposal-info-cell">
                <span className="quote-proposal-label">
                  {tw(lang, 'mileageOrigin')}
                </span>
                <p className="quote-proposal-value">
                  {displayValue(
                    mileageMetadata?.base_location ??
                      breakdown.rules_applied.mileageBaseLocation,
                  )}
                </p>
              </div>
              <div className="quote-proposal-info-cell">
                <span className="quote-proposal-label">
                  {tw(lang, 'mileageDestination')}
                </span>
                <p className="quote-proposal-value">
                  {displayValue(eventLocation)}
                </p>
              </div>
            </div>
            <div className="quote-proposal-mileage-grid">
              <div className="quote-proposal-info-cell">
                <span className="quote-proposal-label">
                  {tw(lang, 'mileageTotalDistance')}
                </span>
                <p className="quote-proposal-value">
                  {mileageMetadata?.distance != null
                    ? `${String(mileageMetadata.distance)} mi`
                    : '—'}
                </p>
              </div>
              <div className="quote-proposal-info-cell">
                <span className="quote-proposal-label">
                  {tw(lang, 'mileageIncluded')}
                </span>
                <p className="quote-proposal-value">
                  {mileageMetadata?.free_limit != null
                    ? `${String(mileageMetadata.free_limit)} mi`
                    : `${breakdown.rules_applied.mileageFreeLimit} mi`}
                </p>
              </div>
              <div className="quote-proposal-info-cell">
                <span className="quote-proposal-label">
                  {tw(lang, 'mileageChargeable')}
                </span>
                <p className="quote-proposal-value">{`${mileageLine.quantity} mi`}</p>
              </div>
            </div>
            <div className="quote-proposal-info-cell quote-proposal-info-cell--wide">
              <span className="quote-proposal-label">
                {tw(lang, 'mileageFeeFinal')}
              </span>
              <p className="quote-proposal-value">
                {formatCurrency(mileageLine.amount)}
              </p>
            </div>
          </div>
        ) : null}
      </ProposalSection>

      <section className="quote-proposal-pricing quote-print-section quote-print-keep">
        <h2 className="quote-proposal-section-title">
          {tQuotesOrders(lang, 'docFinancialSection')}
        </h2>
        <PricingBreakdownView
          breakdown={breakdown}
          language={lang}
          emphasizeTotal
          showDeposit={false}
          variant="confirmation"
        />
      </section>

      <QuoteReservationPaymentCard
        language={lang}
        depositAmount={breakdown.deposit}
        balanceAmount={breakdown.balance}
        reservationPercentage={breakdown.rules_applied.reservationPercentage}
        ruleHint={tw(lang, 'reservationRuleHint')}
      />

      <CdlImportantRulesPanel
        variant="summary"
        showReservationText
        language={lang}
      />

      <CdlCancellationPolicySection variant="summary" language={lang} />

      <footer className="quote-proposal-signature">
        <p className="quote-proposal-footer-brand">BBQ AT HOME</p>
        <p className="quote-proposal-footer-tagline">Orlando, Florida</p>
        <img
          src="/brand/pscs-one.png"
          alt="PSCS One"
          className="quote-proposal-pscs-mark bg-transparent"
        />
      </footer>
    </>
  )
}

export default function QuoteReviewLayout({
  data,
  rulesVariant = 'summary',
  beforeBody,
  afterBody,
  showFooter = false,
  variant = 'default',
  breakdown = null,
  mileageEditor,
}: {
  data: QuoteReviewData
  rulesVariant?: 'summary' | 'pdf'
  beforeBody?: ReactNode
  afterBody?: ReactNode
  showFooter?: boolean
  variant?: 'default' | 'confirmation'
  breakdown?: PricingBreakdown | null
  mileageEditor?: ReactNode
}) {
  const lang = data.language ?? 'pt'
  const t = getQuoteStrings(lang)
  const w = t.wizard
  const cityState = [data.city, data.state].filter(Boolean).join(', ')
  const eventLocation = [data.addressLine, cityState, data.zipCode]
    .filter(Boolean)
    .join(' · ')
  const eventTimeLabel =
    data.startTime || data.endTime
      ? `${formatTime(data.startTime)} – ${formatTime(data.endTime)}`
      : '—'
  const groupedAdditionals = groupAdditionals(data.additionals)
  const chargedMiles = getChargedMiles(
    data.mileageDistance,
    data.mileageFreeLimit,
  )
  const discount = data.discount ?? 0

  const holidaySurcharge = Number(data.holidaySurchargeAmount ?? 0)
  const minimumAdjustment = Number(data.minimumOrderAdjustment ?? 0)
  const grillRentalTotal = Number(data.grillRentalTotal ?? 0)
  const grillRentalQty = Number(data.grillRentalQty ?? 0)

  const pricingLines = [
    {
      label: tQuotesOrders(lang, 'packageLabel'),
      value: formatMoneyOrDash(data.packageTotal),
    },
    {
      label: tQuotesOrders(lang, 'additionalsLabel'),
      value: formatMoneyOrDash(data.additionalTotal),
    },
    {
      label:
        (chargedMiles ?? 0) > 0
          ? tQuotesOrders(lang, 'docMileageChargedSummaryLine', {
              charged: chargedMiles ?? 0,
              free: Number(data.mileageFreeLimit ?? 20),
            })
          : tQuotesOrders(lang, 'mileageLabel'),
      value: formatMoneyOrDash(data.mileageFee),
    },
    ...(grillRentalTotal > 0
      ? [
          {
            label:
              grillRentalQty > 1
                ? tQuotesOrders(lang, 'docGrillRentalLineQty', {
                    qty: grillRentalQty,
                  })
                : tQuotesOrders(lang, 'docGrillRentalLine'),
            value: formatCurrency(grillRentalTotal),
          },
        ]
      : []),
    ...(holidaySurcharge > 0
      ? [
          {
            label: tQuotesOrders(lang, 'docHolidaySurchargeLine'),
            value: formatCurrency(holidaySurcharge),
          },
        ]
      : []),
    ...(minimumAdjustment > 0
      ? [
          {
            label: tQuotesOrders(lang, 'minOrderAppliedWithMin', {
              label: tQuotesOrders(lang, 'docMinOrderAppliedLine'),
              min: formatCurrency(data.minimumOrderAmount ?? 0),
            }),
            value: formatCurrency(minimumAdjustment),
          },
        ]
      : []),
    ...(discount > 0
      ? [
          {
            label: tQuotesOrders(lang, 'docDiscountLine'),
            value: formatCurrency(discount),
            discount: true,
          },
        ]
      : []),
    {
      label: tQuotesOrders(lang, 'reservationLabel'),
      value: formatMoneyOrDash(data.reservationAmount),
    },
    {
      label: tQuotesOrders(lang, 'docBalanceDueLine'),
      value: formatMoneyOrDash(data.balanceDue),
      highlight: true,
    },
  ]

  const heroMeta = data.preview
    ? [
        { label: w.preview, value: w.beforeSave },
        {
          label: tQuotesOrders(lang, 'docEventDateLabel'),
          value: formatDate(data.eventDate, lang),
        },
        { label: t.review.time, value: eventTimeLabel },
        {
          label: tQuotesOrders(lang, 'status'),
          value: w.draft,
          status: true,
        },
      ]
    : [
        {
          label: tQuotesOrders(lang, 'linkedQuote'),
          value: data.quoteNumber ?? '—',
        },
        {
          label: tQuotesOrders(lang, 'docEventDateLabel'),
          value: formatDate(data.eventDate, lang),
        },
        { label: t.review.time, value: eventTimeLabel },
        ...(data.quoteStatus
          ? [
              {
                label: tQuotesOrders(lang, 'status'),
                value: data.quoteStatus,
                status: true,
              },
            ]
          : []),
      ]

  return (
    <div
      className={`${proposalSerif.variable} ${proposalSans.variable} quote-proposal overflow-x-hidden`}
    >
      <header className="quote-proposal-hero quote-print-header">
        <div className="quote-proposal-hero-inner">
          <div className="quote-proposal-hero-brand">
            <div className="quote-print-logo">
              <CdlBrandLogo
                size="lg"
                variant="cover"
                className="quote-print-logo-mark"
              />
            </div>
            <div className="quote-proposal-hero-copy">
              <h1 className="quote-proposal-title">BBQ AT HOME</h1>
              <p className="quote-proposal-tagline">
                Premium Brazilian BBQ Experience
              </p>
              <p className="quote-proposal-location">Orlando, Florida</p>
            </div>
          </div>
          <div className="quote-proposal-hero-meta">
            {heroMeta.map((item) => (
              <div
                key={item.label}
                className={`quote-proposal-meta-card${
                  item.status ? ' quote-proposal-meta-card--status' : ''
                }`}
              >
                <span className="quote-proposal-label">{item.label}</span>
                <p className="quote-proposal-meta-value">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="quote-proposal-body mx-auto max-w-6xl px-4 pb-10 sm:px-8 sm:pb-12">
        {beforeBody}

        {variant === 'confirmation' && breakdown ? (
          <ConfirmationProposalBody
            data={data}
            breakdown={breakdown}
            eventLocation={eventLocation}
            eventTimeLabel={eventTimeLabel}
            groupedAdditionals={groupedAdditionals}
            mileageEditor={mileageEditor}
          />
        ) : (
          <>
          <QuoteProposalOverviewCard
          customerName={displayValue(data.customerName)}
          eventDate={data.eventDate}
          addressLine={data.addressLine}
          city={data.city}
          state={data.state}
          zipCode={data.zipCode}
          packageSummary={data.packageSummary}
          packageTotal={data.packageTotal}
          additionalTotal={data.additionalTotal}
          mileageFee={data.mileageFee}
          chargedMiles={chargedMiles}
          mileageFreeLimit={data.mileageFreeLimit}
          grillRentalTotal={grillRentalTotal}
          holidaySurchargeAmount={holidaySurcharge}
          minimumOrderAdjustment={minimumAdjustment}
          discountAmount={discount}
          reservationAmount={data.reservationAmount}
          quoteTotal={data.quoteTotal}
          additionalsCount={data.additionals.length}
          grillRentalRequired={data.grillRentalRequired}
          language={lang}
          afterClient={
            <QuoteCommercialAdjustmentNotice
              baseSubtotal={
                Number(data.packageTotal ?? 0) +
                Number(data.additionalTotal ?? 0) +
                Number(data.mileageFee ?? 0)
              }
              holidaySurchargeAmount={holidaySurcharge}
              minimumOrderAdjustment={minimumAdjustment}
              minimumOrderAmount={Number(data.minimumOrderAmount ?? 0)}
              quoteTotal={data.quoteTotal}
              language={lang}
            />
          }
        />

        <div className="quote-proposal-grid-2">
          <ProposalSection title={t.review.packageSection}>
            <QuoteReviewPackageCdlSection
              packageName={data.packageName}
              packageImageUrl={data.packageImageUrl}
              packageSummary={data.packageSummary}
              packageSelections={data.packageSelections}
              additionalItems={(data.additionals ?? [])
                .filter((item) => Number(item.totalPrice ?? 0) > 0)
                .map((item) => ({
                  label: item.label,
                  amount: Number(item.totalPrice ?? 0),
                }))}
              physicalGuestCount={data.physicalGuestCount}
              billableGuestCount={data.billableGuestCount}
              packageTotal={data.packageTotal}
              packageUnitPrice={data.packageUnitPrice}
              language={lang}
              showValueCards={false}
            />
          </ProposalSection>

          <ProposalSection title={t.review.guestsSection}>
            <GuestBreakdownPanel
              guestCounts={data.guestCounts}
              totals={{
                billableGuestCount: data.billableGuestCount,
                physicalGuestCount: data.physicalGuestCount,
                quoteTotal: data.quoteTotal,
              }}
              language={lang}
            />
            <QuoteReviewPackageValueCards
              packageSummary={data.packageSummary}
              physicalGuestCount={data.physicalGuestCount}
              billableGuestCount={data.billableGuestCount}
              packageTotal={data.packageTotal}
              packageUnitPrice={data.packageUnitPrice}
              additionalTotal={data.additionalTotal}
              mileageFee={data.mileageFee}
              language={lang}
            />
          </ProposalSection>
        </div>

        <div className="quote-proposal-grid-2">
          <ProposalSection title={t.review.eventSection}>
            <p className="quote-proposal-event-name">
              {displayValue(data.eventName || data.customerName)}
            </p>
            <div className="quote-proposal-event-list">
              <EventRow
                icon={<IconCalendar />}
                label={t.review.date}
                value={formatDate(data.eventDate, lang)}
              />
              <EventRow
                icon={<IconClock />}
                label={t.review.time}
                value={eventTimeLabel}
              />
              <EventRow
                icon={<IconLocation />}
                label={t.review.location}
                value={eventLocation || '—'}
              />
            </div>
          </ProposalSection>

          <ProposalSection title={t.review.reservationSection}>
            <div className="quote-proposal-info-grid">
              <div className="quote-proposal-info-cell">
                <span className="quote-proposal-label">{w.reservationPctLabel}</span>
                <p className="quote-proposal-value">
                  {data.reservationPercentage != null
                    ? `${data.reservationPercentage}%`
                    : '—'}
                </p>
              </div>
              <div className="quote-proposal-info-cell">
                <span className="quote-proposal-label">{w.reservationAmountLabel}</span>
                <p className="quote-proposal-value">
                  {formatMoneyOrDash(data.reservationAmount)}
                </p>
              </div>
              <div className="quote-proposal-info-cell">
                <span className="quote-proposal-label">
                  {tQuotesOrders(lang, 'docBalanceDueLine')}
                </span>
                <p className="quote-proposal-value">
                  {formatMoneyOrDash(data.balanceDue)}
                </p>
              </div>
            </div>
          </ProposalSection>

          <ProposalSection title={t.review.bbqSection}>
            <div className="quote-proposal-info-grid">
              <div className="quote-proposal-info-cell">
                <span className="quote-proposal-label">{w.hasGrill}</span>
                <p className="quote-proposal-value">
                  {formatBool(data.hasGrill, lang)}
                </p>
              </div>
              <div className="quote-proposal-info-cell">
                <span className="quote-proposal-label">
                  {tQuotesOrders(lang, 'docGrillPhoto')}
                </span>
                <p className="quote-proposal-value">
                  {data.grillPhotoStatusLabel ??
                    (data.hasGrill === false
                      ? w.notApplicable
                      : w.pending)}
                </p>
              </div>
              <div className="quote-proposal-info-cell">
                <span className="quote-proposal-label">
                  {w.grillRentalRequired}
                </span>
                <p className="quote-proposal-value">
                  {formatBool(data.grillRentalRequired, lang)}
                </p>
              </div>
              <div className="quote-proposal-info-cell">
                <span className="quote-proposal-label">
                  {tQuotesOrders(lang, 'docGrillRentalQty')}
                </span>
                <p className="quote-proposal-value">
                  {data.grillRentalRequired
                    ? displayValue(data.grillRentalQty)
                    : '—'}
                </p>
              </div>
              {data.grillNotes ? (
                <div className="quote-proposal-info-cell quote-proposal-info-cell--wide">
                  <span className="quote-proposal-label">{w.notes}</span>
                  <p className="quote-proposal-value">{data.grillNotes}</p>
                </div>
              ) : null}
            </div>
          </ProposalSection>

          <ProposalSection title={tQuotesOrders(lang, 'docGrillPhoto')}>
            <QuoteGrillPhotoFrame
              src={data.grillPhotoUrl}
              alt={tQuotesOrders(lang, 'docGrillPhoto')}
              emptyLabel={
                data.grillPhotoStatusLabel ??
                (data.hasGrill === false ? w.notApplicable : w.pending)
              }
            />
          </ProposalSection>
        </div>

        <ProposalSection title={t.review.mileageSection} className="quote-proposal-section--compact">
          <div className="quote-proposal-mileage-grid">
            <div className="quote-proposal-info-cell">
              <span className="quote-proposal-label">{w.baseLocation}</span>
              <p className="quote-proposal-value">
                {displayValue(data.mileageBaseLocation)}
              </p>
            </div>
            <div className="quote-proposal-info-cell">
              <span className="quote-proposal-label">
                {tQuotesOrders(lang, 'docMileageDistance')}
              </span>
              <p className="quote-proposal-value">
                {data.mileageDistance != null
                  ? `${data.mileageDistance} mi`
                  : '—'}
              </p>
            </div>
            <div className="quote-proposal-info-cell">
              <span className="quote-proposal-label">{w.includedMiles}</span>
              <p className="quote-proposal-value">
                {data.mileageFreeLimit != null
                  ? `${data.mileageFreeLimit} mi`
                  : '—'}
              </p>
            </div>
            <div className="quote-proposal-info-cell">
              <span className="quote-proposal-label">{w.chargedMiles}</span>
              <p className="quote-proposal-value">
                {chargedMiles != null ? `${chargedMiles} mi` : '—'}
              </p>
            </div>
            <div className="quote-proposal-info-cell">
              <span className="quote-proposal-label">
                {tQuotesOrders(lang, 'docMileageRate')}
              </span>
              <p className="quote-proposal-value">
                {data.mileageRate != null
                  ? `${formatCurrency(data.mileageRate)}/mi`
                  : '—'}
              </p>
            </div>
            <div className="quote-proposal-info-cell">
              <span className="quote-proposal-label">
                {tQuotesOrders(lang, 'docMileageFeeLabel')}
              </span>
              <p className="quote-proposal-value">
                {formatMoneyOrDash(data.mileageFee)}
              </p>
            </div>
          </div>
        </ProposalSection>

        <ProposalSection title={t.review.additionalsSection}>
          {groupedAdditionals.length === 0 ? (
            <p className="quote-proposal-muted">{t.review.noAdditionals}</p>
          ) : (
            <div className="quote-proposal-additionals">
              {groupedAdditionals.map(({ category, items }) => (
                <section key={category} className="quote-proposal-additional-group">
                  <h3 className="quote-proposal-category-title">{category}</h3>
                  <div className="quote-print-additional-grid quote-proposal-additional-grid">
                    {items.map((item) => (
                      <article
                        key={item.id}
                        className="quote-print-additional-card quote-proposal-additional-card"
                      >
                        <CatalogImageFrame
                          src={item.imageUrl}
                          alt={item.label}
                          variant="catalogItem"
                          itemType={item.itemType}
                          categoryPt={item.categoryPt}
                          rounded="none"
                          className="quote-print-thumb quote-proposal-additional-image !min-h-0 !max-h-none !aspect-video"
                        />
                        <div className="quote-print-additional-body quote-proposal-additional-body">
                          <h4 className="quote-proposal-additional-name">{item.label}</h4>
                          <div className="quote-proposal-additional-metrics">
                            <div>
                              <span className="quote-proposal-label">
                                {tQuotesOrders(lang, 'docQtyLabel')}
                              </span>
                              <p className="quote-proposal-additional-metric">
                                {displayValue(item.quantity)}
                              </p>
                            </div>
                            <div>
                              <span className="quote-proposal-label">
                                {tQuotesOrders(lang, 'docUnitPriceLabel')}
                              </span>
                              <p className="quote-proposal-additional-metric">
                                {formatCurrency(item.unitPrice)}
                              </p>
                            </div>
                          </div>
                          <div className="quote-print-additional-total quote-proposal-additional-total">
                            <span className="quote-proposal-label">
                              {w.total}
                            </span>
                            <p className="quote-proposal-additional-price">
                              {formatCurrency(item.totalPrice)}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </ProposalSection>

        <section className="quote-proposal-pricing quote-print-section quote-print-keep">
          <h2 className="quote-proposal-section-title">
            {tQuotesOrders(lang, 'docFinancialSection')}
          </h2>
          <div className="quote-proposal-pricing-card">
            <div className="quote-proposal-pricing-lines">
              {pricingLines.map((line) => (
                <div
                  key={line.label}
                  className={`quote-proposal-pricing-row${
                    'highlight' in line && line.highlight
                      ? ' quote-proposal-pricing-row--highlight'
                      : ''
                  }${
                    'discount' in line && line.discount
                      ? ' quote-proposal-pricing-row--discount'
                      : ''
                  }`}
                >
                  <span>{line.label}</span>
                  <span>{line.value}</span>
                </div>
              ))}
            </div>
            <div className="quote-print-total-box quote-proposal-total-box">
              <span className="quote-proposal-total-label">
                {w.quoteTotal}
              </span>
              <span className="quote-print-total-value quote-proposal-total-value">
                {formatMoneyOrDash(data.quoteTotal)}
              </span>
            </div>
          </div>
        </section>

        <QuoteReservationPaymentCard
          language={lang}
          extraNotes={
            <>
              {minimumAdjustment > 0 ? (
                <p className="mt-3 font-medium text-cdl-action">
                  {w.minOrderAppliedNote}
                </p>
              ) : null}
              {holidaySurcharge > 0 ? (
                <p className="mt-3 font-medium text-cdl-action">
                  {w.holidaySurchargeNote}
                </p>
              ) : null}
            </>
          }
        />

        <CdlImportantRulesPanel
          variant={rulesVariant === 'pdf' ? 'pdf' : 'summary'}
          showReservationText
          language={lang}
        />

        <CdlCancellationPolicySection
          variant={rulesVariant === 'pdf' ? 'pdf' : 'summary'}
          language={lang}
        />
          </>
        )}

        {afterBody}

        {showFooter ? (
          <footer className="quote-print-footer quote-proposal-footer">
            <p className="quote-proposal-footer-brand">BBQ AT HOME</p>
            <p className="quote-proposal-footer-tagline">
              Premium Brazilian BBQ Experience · Orlando, Florida
            </p>
            <img
              src="/brand/pscs-one.png"
              alt="PSCS One"
              className="quote-proposal-pscs-mark bg-transparent"
            />
          </footer>
        ) : null}
      </div>
    </div>
  )
}

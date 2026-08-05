import {
  getGrillPhotoDetailLabel,
} from '@/Lib/grillPhotoStatus'
import { getCustomerDisplayNameFromQuote } from '@/Lib/getCustomerDisplayName'
import {
  buildQuoteReviewPackageSummaryFromQuote,
  resolveQuoteDetailPackageImageUrl,
} from '@/components/quote-review/mapQuoteDetailToQuoteReview'
import QuoteProposalOverviewCard from '@/components/quote-review/QuoteProposalOverviewCard'
import QuoteReviewPackageCdlSection from '@/components/quote-review/QuoteReviewPackageCdlSection'
import {
  type QuoteDetail,
  displayValue,
  formatBool,
  formatCurrency,
  formatDate,
  formatTime,
  getAdditionalImage,
  getAdditionalLabel,
  getDiscount,
  getPackageName,
  getZipCode,
  groupAdditionalsByCategory,
} from './quoteDetailTypes'
import CatalogImageFrame from '@/components/CatalogImageFrame'
import CdlBrandLogo from '../../../components/CdlBrandLogo'
import { CdlPdfPoliciesSection } from '../../../components/CdlImportantRulesPanel'
import {
  BALANCE_PERCENTAGE,
  RESERVATION_PAYMENT_TEXT,
  RESERVATION_PERCENTAGE,
} from '../../../Lib/cdlCommercialRules'
import {
  formatMoneyOrDash,
  getChargedMilesFromSnapshot,
  readQuoteSnapshot,
} from '../../../Lib/readQuoteSnapshot'
import QuoteProposalSharePanel from '@/components/quotes/QuoteProposalSharePanel'
import QuoteTeamAssignmentPanel from '@/components/quotes/QuoteTeamAssignmentPanel'
import QuoteConvertPanel from '@/components/quotes/QuoteConvertPanel'
import QuoteDetailToolbar from './QuoteDetailToolbar'
import GuestBreakdownPanel from '@/components/GuestBreakdownPanel'
import QuoteFlashBanner from '@/components/QuoteFlashBanner'
import { Suspense } from 'react'
import QuoteDebugPanel from './QuoteDebugPanel'

function ProposalSection({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
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
  icon: React.ReactNode
  label: string
  value: React.ReactNode
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

function TeamCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="quote-proposal-team-card">
      <div className="quote-proposal-team-icon" aria-hidden>
        {icon}
      </div>
      <span className="quote-proposal-label">{label}</span>
      <p className="quote-proposal-team-value">{displayValue(value)}</p>
    </div>
  )
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconLocation() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M12 21s6-5.2 6-10a6 6 0 10-12 0c0 4.8 6 10 6 10z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function IconChef() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
      <path
        d="M6 11c0-2.2 1.8-4 4-4 .9 0 1.7.3 2.4.8C13.1 7.3 14 7 15 7c2.2 0 4 1.8 4 4v1H6v-1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M6 12h14v2a4 4 0 01-4 4H10a4 4 0 01-4-4v-2z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function IconTeam() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5M14 19c0-2 1.5-3.7 3.5-4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function QuoteDetailView({
  quote,
  canConvert = false,
}: {
  quote: QuoteDetail
  canConvert?: boolean
}) {
  const lang = quote.language ?? 'pt'
  const packageName = getPackageName(quote)
  const additionalItems = quote.additional_items ?? []
  const groupedAdditionals = groupAdditionalsByCategory(additionalItems, lang)
  const discount = getDiscount(quote)
  const quoteNumber = quote.quote_number ?? 'CDL-Q-0000'
  const customerDisplayName = getCustomerDisplayNameFromQuote(quote)
  const cityState = [quote.city, quote.state].filter(Boolean).join(', ')
  const eventLocation = [quote.address_line, cityState, getZipCode(quote)]
    .filter(Boolean)
    .join(' · ')

  const snapshot = readQuoteSnapshot(quote)
  const packageSummary = buildQuoteReviewPackageSummaryFromQuote(quote, snapshot)
  const packageImageUrl = resolveQuoteDetailPackageImageUrl(quote)
  const guestCounts = snapshot.guestCounts
  const chargedMiles = getChargedMilesFromSnapshot(
    snapshot.mileageDistance,
    snapshot.mileageFreeLimit,
  )

  const pricingLines = [
    { label: 'Pacote', value: formatMoneyOrDash(snapshot.packageTotal) },
    {
      label: 'Adicionais',
      value: formatMoneyOrDash(snapshot.additionalTotal),
    },
    { label: 'Milhagem', value: formatMoneyOrDash(snapshot.mileageFee) },
    { label: 'Desconto', value: formatCurrency(discount), accent: true },
    {
      label: 'Reserva',
      value: formatMoneyOrDash(snapshot.reservationAmount),
    },
    {
      label: 'Saldo a pagar',
      value: formatMoneyOrDash(snapshot.balanceDue),
      highlight: true,
    },
  ]

  const eventTimeLabel =
    quote.start_time || quote.end_time
      ? `${formatTime(quote.start_time)} – ${formatTime(quote.end_time)}`
      : '—'

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
                getPackageName(quote) || quote.package_key || null
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
            <div className="quote-proposal-meta-card">
              <span className="quote-proposal-label">Cotação</span>
              <p className="quote-proposal-meta-value">{quoteNumber}</p>
            </div>
            <div className="quote-proposal-meta-card">
              <span className="quote-proposal-label">Data do evento</span>
              <p className="quote-proposal-meta-value">
                {formatDate(quote.event_date)}
              </p>
            </div>
            <div className="quote-proposal-meta-card">
              <span className="quote-proposal-label">Horário</span>
              <p className="quote-proposal-meta-value">{eventTimeLabel}</p>
            </div>
            {quote.quote_status && (
              <div className="quote-proposal-meta-card quote-proposal-meta-card--status">
                <span className="quote-proposal-label">Status</span>
                <p className="quote-proposal-meta-value">{quote.quote_status}</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="quote-proposal-body mx-auto max-w-6xl px-4 pb-10 sm:px-8 sm:pb-12">
        <QuoteProposalOverviewCard
          customerName={displayValue(customerDisplayName)}
          eventDate={quote.event_date ?? null}
          addressLine={quote.address_line}
          city={quote.city}
          state={quote.state}
          zipCode={getZipCode(quote)}
          packageSummary={packageSummary}
          packageTotal={snapshot.packageTotal}
          additionalTotal={snapshot.additionalTotal}
          mileageFee={snapshot.mileageFee}
          reservationAmount={snapshot.reservationAmount}
          quoteTotal={snapshot.quoteTotal}
          additionalsCount={additionalItems.length}
          grillRentalRequired={quote.grill_rental_required}
        />

        <div className="quote-proposal-grid-2">
          <ProposalSection title="Pacote CDL">
            <QuoteReviewPackageCdlSection
              packageName={packageName ?? null}
              packageImageUrl={packageImageUrl}
              packageSummary={packageSummary}
              physicalGuestCount={snapshot.physicalGuestCount}
              billableGuestCount={snapshot.billableGuestCount}
              packageTotal={snapshot.packageTotal}
              packageUnitPrice={snapshot.packageUnitPrice}
            />
          </ProposalSection>

          <ProposalSection title="Convidados e cobrança">
            <GuestBreakdownPanel
              guestCounts={guestCounts}
              totals={{
                billableGuestCount: snapshot.billableGuestCount,
                physicalGuestCount: snapshot.physicalGuestCount,
                quoteTotal: snapshot.quoteTotal,
              }}
            />
          </ProposalSection>

          <ProposalSection title="Evento">
            <p className="quote-proposal-event-name">
              {displayValue(quote.event_name ?? customerDisplayName)}
            </p>
            <div className="quote-proposal-event-list">
              <EventRow
                icon={<IconCalendar />}
                label="Data"
                value={formatDate(quote.event_date)}
              />
              <EventRow
                icon={<IconClock />}
                label="Horário"
                value={`${formatTime(quote.start_time)} – ${formatTime(quote.end_time)}`}
              />
              <EventRow
                icon={<IconLocation />}
                label="Local"
                value={eventLocation || '—'}
              />
            </div>
          </ProposalSection>
        </div>

        <div className="quote-proposal-grid-2">
          <ProposalSection title="Churrasqueira">
            <div className="quote-proposal-info-grid">
              <div className="quote-proposal-info-cell">
                <span className="quote-proposal-label">Cliente tem churrasqueira?</span>
                <p className="quote-proposal-value">{formatBool(quote.has_grill)}</p>
              </div>
              <div className="quote-proposal-info-cell">
                <span className="quote-proposal-label">Foto da churrasqueira</span>
                <p className="quote-proposal-value">
                  {getGrillPhotoDetailLabel({
                    hasGrill: quote.has_grill,
                    grillPhotoRequired: quote.grill_photo_required,
                    grillPhotoUrl: quote.grill_photo_url,
                    grillPhotoMediaId: quote.grill_photo_media_id,
                  })}
                </p>
              </div>
              <div className="quote-proposal-info-cell">
                <span className="quote-proposal-label">Necessário alugar churrasqueira?</span>
                <p className="quote-proposal-value">
                  {formatBool(quote.grill_rental_required)}
                </p>
              </div>
              <div className="quote-proposal-info-cell">
                <span className="quote-proposal-label">Quantidade para aluguel</span>
                <p className="quote-proposal-value">
                  {quote.grill_rental_required
                    ? displayValue(quote.grill_rental_qty)
                    : '—'}
                </p>
              </div>
              {quote.grill_notes && (
                <div className="quote-proposal-info-cell quote-proposal-info-cell--wide">
                  <span className="quote-proposal-label">Observações</span>
                  <p className="quote-proposal-value">{quote.grill_notes}</p>
                </div>
              )}
            </div>
          </ProposalSection>

          <ProposalSection title="Time">
            <div className="quote-proposal-team-grid">
              <TeamCard
                icon={<IconChef />}
                label="Churrasqueiros"
                value={quote.grill_masters_qty}
              />
              <TeamCard
                icon={<IconTeam />}
                label="Assistentes"
                value={quote.assistants_qty}
              />
            </div>
          </ProposalSection>
        </div>

        <ProposalSection title="Milhagem" className="quote-proposal-section--compact">
          <div className="quote-proposal-mileage-grid">
            <div className="quote-proposal-info-cell">
              <span className="quote-proposal-label">Local base</span>
              <p className="quote-proposal-value">
                {displayValue(snapshot.mileageBaseLocation)}
              </p>
            </div>
            <div className="quote-proposal-info-cell">
              <span className="quote-proposal-label">Distância</span>
              <p className="quote-proposal-value">
                {snapshot.mileageDistance != null
                  ? `${snapshot.mileageDistance} mi`
                  : '—'}
              </p>
            </div>
            <div className="quote-proposal-info-cell">
              <span className="quote-proposal-label">Milhas inclusas</span>
              <p className="quote-proposal-value">
                {snapshot.mileageFreeLimit != null
                  ? `${snapshot.mileageFreeLimit} mi`
                  : '—'}
              </p>
            </div>
            <div className="quote-proposal-info-cell">
              <span className="quote-proposal-label">Milhas cobradas</span>
              <p className="quote-proposal-value">
                {chargedMiles != null ? `${chargedMiles} mi` : '—'}
              </p>
            </div>
            <div className="quote-proposal-info-cell">
              <span className="quote-proposal-label">Taxa</span>
              <p className="quote-proposal-value">
                {snapshot.mileageRate != null
                  ? `${formatCurrency(snapshot.mileageRate)}/mi`
                  : '—'}
              </p>
            </div>
            <div className="quote-proposal-info-cell">
              <span className="quote-proposal-label">Taxa de milhagem</span>
              <p className="quote-proposal-value">
                {formatMoneyOrDash(snapshot.mileageFee)}
              </p>
            </div>
          </div>
        </ProposalSection>

        <ProposalSection title="Adicionais selecionados">
          {groupedAdditionals.length === 0 ? (
            <p className="quote-proposal-muted">Nenhum adicional selecionado.</p>
          ) : (
            <div className="quote-proposal-additionals">
              {groupedAdditionals.map(({ category, items }) => (
                <section key={category} className="quote-proposal-additional-group">
                  <h3 className="quote-proposal-category-title">{category}</h3>
                  <div className="quote-print-additional-grid quote-proposal-additional-grid">
                    {items.map((item) => {
                      const image = getAdditionalImage(item)
                      return (
                        <article
                          key={item.item_id}
                          className="quote-print-additional-card quote-proposal-additional-card"
                        >
                          <CatalogImageFrame
                            src={image}
                            alt={getAdditionalLabel(item, lang)}
                            variant="catalogItem"
                            itemType={item.item_type}
                            categoryPt={item.category_pt}
                            rounded="none"
                            className="quote-print-thumb quote-proposal-additional-image !min-h-0 !max-h-none !aspect-video"
                          />
                          <div className="quote-print-additional-body quote-proposal-additional-body">
                            <h4 className="quote-proposal-additional-name">
                              {getAdditionalLabel(item, lang)}
                            </h4>
                            <div className="quote-proposal-additional-metrics">
                              <div>
                                <span className="quote-proposal-label">Qtd.</span>
                                <p className="quote-proposal-additional-metric">
                                  {displayValue(item.quantity)}
                                </p>
                              </div>
                              <div>
                                <span className="quote-proposal-label">Unit.</span>
                                <p className="quote-proposal-additional-metric">
                                  {formatCurrency(item.unit_price)}
                                </p>
                              </div>
                            </div>
                            <div className="quote-print-additional-total quote-proposal-additional-total">
                              <span className="quote-proposal-label">Total</span>
                              <p className="quote-proposal-additional-price">
                                {formatCurrency(item.total_price)}
                              </p>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </ProposalSection>

        <section className="quote-proposal-pricing quote-print-section quote-print-keep">
          <h2 className="quote-proposal-section-title">Resumo financeiro</h2>
          <div className="quote-proposal-pricing-card">
            <div className="quote-proposal-pricing-lines">
              {pricingLines.map((line) => (
                <div
                  key={line.label}
                  className={`quote-proposal-pricing-row${
                    line.highlight ? ' quote-proposal-pricing-row--highlight' : ''
                  }${line.accent ? ' quote-proposal-pricing-row--accent' : ''}`}
                >
                  <span>{line.label}</span>
                  <span>{line.value}</span>
                </div>
              ))}
            </div>
            <div className="quote-print-total-box quote-proposal-total-box">
              <span className="quote-proposal-total-label">Total da cotação</span>
              <span className="quote-print-total-value quote-proposal-total-value">
                {formatMoneyOrDash(snapshot.quoteTotal)}
              </span>
            </div>
            <div className="quote-proposal-reservation-note">
              <p>{RESERVATION_PAYMENT_TEXT}</p>
              <p>
                Reserva: {RESERVATION_PERCENTAGE}% · Saldo: {BALANCE_PERCENTAGE}%
              </p>
            </div>
          </div>
        </section>

        <CdlPdfPoliciesSection />

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

        <footer className="quote-print-footer quote-proposal-footer">
          <p className="quote-proposal-footer-brand">BBQ AT HOME</p>
          <p className="quote-proposal-footer-tagline">Orlando, Florida</p>
          <p className="quote-proposal-footer-meta">www.cdlbbq.com</p>
        </footer>
      </div>
    </main>
  )
}

import React from 'react'
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import {
  CDL_LOGO_COVER_HEIGHT,
  CDL_LOGO_COMPACT_HEIGHT,
  CDL_LOGO_COMPACT_HEADER_HEIGHT,
  CDL_LOGO_PLACEHOLDER,
  type PdfLogoSource,
} from '@/Lib/cdlLogo'
import {
  BALANCE_PERCENTAGE,
  CANCELLATION_POLICY_SUMMARY,
  IMPORTANT_RULES,
  RESERVATION_PAYMENT_TEXT,
  RESERVATION_PERCENTAGE,
} from '@/Lib/cdlCommercialRules'
import {
  formatCountOrDash,
  formatMoneyOrDash,
  getChargedMilesFromSnapshot,
  readQuoteSnapshot,
} from '@/Lib/readQuoteSnapshot'
import { calcGrillRentalFee } from '@/Lib/calculateQuoteTotals'
import {
  getGrillPhotoDetailLabel,
} from '@/Lib/grillPhotoStatus'
import { getCustomerDisplayNameFromQuote } from '@/Lib/getCustomerDisplayName'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import {
  type QuoteDetail,
  displayValue,
  formatBool,
  formatCurrency,
  formatDate,
  formatTime,
  getAdditionalLabel,
  getDiscount,
  getPackageDescription,
  getPackageName,
  getZipCode,
  groupAdditionalsByCategory,
} from './quoteDetailTypes'

const colors = {
  gold: '#F4B400',
  dark: '#111111',
  muted: '#6B6560',
  border: '#E8E2D9',
  light: '#FAF7F2',
  white: '#FFFFFF',
  accent: '#D62828',
  green: '#15803D',
}

const styles = StyleSheet.create({
  coverPage: {
    backgroundColor: colors.dark,
    color: colors.white,
    paddingHorizontal: 48,
    paddingVertical: 56,
    fontFamily: 'Helvetica',
    justifyContent: 'center',
  },
  coverAccentBar: {
    height: 4,
    backgroundColor: colors.gold,
    marginBottom: 28,
    width: 120,
  },
  coverLogoWrap: {
    height: CDL_LOGO_COVER_HEIGHT,
    width: CDL_LOGO_COVER_HEIGHT,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexDirection: 'row',
  },
  coverLogo: {
    height: CDL_LOGO_COVER_HEIGHT,
    width: CDL_LOGO_COVER_HEIGHT,
    maxHeight: CDL_LOGO_COVER_HEIGHT,
    objectFit: 'contain',
  },
  coverLogoPlaceholder: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: colors.gold,
    letterSpacing: 2,
    marginBottom: 20,
  },
  coverBrand: {
    fontSize: 42,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 3,
    color: colors.white,
  },
  coverTagline: {
    marginTop: 10,
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: colors.gold,
  },
  coverDivider: {
    marginVertical: 32,
    height: 1,
    backgroundColor: '#333333',
  },
  coverLabel: {
    fontSize: 8,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#AAAAAA',
    marginBottom: 6,
  },
  coverClient: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: colors.white,
    marginBottom: 18,
  },
  coverMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    marginTop: 8,
  },
  coverMetaBlock: {
    minWidth: 140,
  },
  coverMetaValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: colors.white,
  },
  coverInvestmentBox: {
    marginTop: 40,
    padding: 22,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: '#1A1A1A',
    alignSelf: 'flex-start',
    minWidth: 260,
  },
  coverInvestmentLabel: {
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#BBBBBB',
  },
  coverInvestmentValue: {
    marginTop: 8,
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    color: colors.gold,
  },
  contentPage: {
    paddingTop: CDL_LOGO_COMPACT_HEADER_HEIGHT + 8,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: colors.dark,
    backgroundColor: colors.white,
  },
  compactHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: CDL_LOGO_COMPACT_HEADER_HEIGHT,
    backgroundColor: colors.dark,
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
    paddingHorizontal: 40,
    paddingVertical: 0,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  compactHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    height: CDL_LOGO_COMPACT_HEADER_HEIGHT,
  },
  compactLogoWrap: {
    height: CDL_LOGO_COMPACT_HEIGHT,
    width: CDL_LOGO_COMPACT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
    backgroundColor: colors.dark,
  },
  compactLogo: {
    height: CDL_LOGO_COMPACT_HEIGHT,
    width: CDL_LOGO_COMPACT_HEIGHT,
    objectFit: 'contain',
  },
  compactLogoPlaceholder: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.gold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  compactHeaderTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: colors.white,
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  pageFooter: {
    position: 'absolute',
    bottom: 18,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    textAlign: 'center',
  },
  pageFooterBrand: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    color: colors.dark,
  },
  pageFooterLine: {
    marginTop: 2,
    fontSize: 7.5,
    color: colors.muted,
  },
  pageFooterPscs: {
    marginTop: 6,
    alignSelf: 'center',
    height: 14,
    width: 72,
    objectFit: 'contain',
  },
  overview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  overviewItem: {
    flexGrow: 1,
    minWidth: '22%',
    backgroundColor: colors.light,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  overviewTotal: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  overviewLabel: {
    fontSize: 7,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  overviewValue: {
    marginTop: 4,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: colors.dark,
  },
  overviewTotalLabel: {
    fontSize: 7,
    color: '#BBBBBB',
    textTransform: 'uppercase',
  },
  overviewTotalValue: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: colors.gold,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: colors.dark,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  packageName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  packageDesc: {
    fontSize: 8,
    color: colors.muted,
    lineHeight: 1.4,
    marginBottom: 8,
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: '48%',
    backgroundColor: colors.light,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
  },
  gridItemWide: {
    width: '100%',
    backgroundColor: colors.light,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
  },
  cellLabel: {
    fontSize: 7,
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  cellValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  categoryTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: colors.gold,
    marginTop: 6,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  additionalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  additionalName: {
    flex: 1,
    fontSize: 8,
    paddingRight: 8,
  },
  additionalMeta: {
    fontSize: 8,
    color: colors.muted,
    textAlign: 'right',
  },
  pricingCard: {
    backgroundColor: colors.light,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pricingRowHighlight: {
    fontFamily: 'Helvetica-Bold',
  },
  pricingRowLabel: {
    color: colors.dark,
  },
  pricingRowValue: {
    color: colors.dark,
    fontFamily: 'Helvetica-Bold',
  },
  pricingRowDiscountValue: {
    color: colors.green,
    fontFamily: 'Helvetica-Bold',
  },
  totalBox: {
    marginTop: 10,
    backgroundColor: colors.white,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.accent,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 8,
    color: colors.dark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'Helvetica-Bold',
  },
  totalValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: colors.accent,
  },
  reservationNote: {
    marginTop: 8,
    fontSize: 7.5,
    color: colors.muted,
    lineHeight: 1.4,
  },
  rulesBlock: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: colors.light,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rulesSubtitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  rulesItem: {
    fontSize: 7.5,
    color: colors.dark,
    lineHeight: 1.35,
    marginBottom: 2,
  },
  muted: {
    fontSize: 8,
    color: colors.muted,
    fontStyle: 'italic',
  },
})

function InfoCell({
  label,
  value,
  wide,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <View wrap={false} style={wide ? styles.gridItemWide : styles.gridItem}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  )
}

function RulesBlock({
  title,
  items,
}: {
  title: string
  items: readonly string[]
}) {
  return (
    <View minPresenceAhead={36} style={styles.rulesBlock}>
      <Text style={styles.rulesSubtitle}>{title}</Text>
      {items.map((item) => (
        <Text key={item} style={styles.rulesItem}>
          • {item}
        </Text>
      ))}
    </View>
  )
}

function PdfLogoMark({
  logoSrc,
  variant,
}: {
  logoSrc: string | null
  variant: 'cover' | 'compact'
}) {
  if (logoSrc) {
    return (
      <View
        style={
          variant === 'cover' ? styles.coverLogoWrap : styles.compactLogoWrap
        }
      >
        <Image
          src={logoSrc}
          style={variant === 'cover' ? styles.coverLogo : styles.compactLogo}
        />
      </View>
    )
  }

  return (
    <Text
      style={
        variant === 'cover'
          ? styles.coverLogoPlaceholder
          : styles.compactLogoPlaceholder
      }
    >
      {CDL_LOGO_PLACEHOLDER}
    </Text>
  )
}

function PdfPageFooter({ pscsSrc }: { pscsSrc: string | null }) {
  return (
    <View style={styles.pageFooter} fixed>
      <Text style={styles.pageFooterBrand}>BBQ AT HOME</Text>
      <Text style={styles.pageFooterLine}>Orlando, Florida</Text>
      <Text style={styles.pageFooterLine}>www.cdlbbq.com</Text>
      {pscsSrc ? <Image src={pscsSrc} style={styles.pageFooterPscs} /> : null}
    </View>
  )
}

function PdfCompactHeader({
  quoteNumber,
  logoSrc,
}: {
  quoteNumber: string
  logoSrc: string | null
}) {
  return (
    <View style={styles.compactHeader} fixed>
      <View style={styles.compactHeaderLeft}>
        <PdfLogoMark logoSrc={logoSrc} variant="compact" />
        <Text style={styles.compactHeaderTitle}>
          BBQ AT HOME | {quoteNumber}
        </Text>
      </View>
    </View>
  )
}

function PdfDocumentPage({
  quoteNumber,
  logoSrc,
  pscsSrc,
  children,
}: {
  quoteNumber: string
  logoSrc: string | null
  pscsSrc: string | null
  children: React.ReactNode
}) {
  return (
    <Page size="A4" style={styles.contentPage} wrap>
      <PdfCompactHeader quoteNumber={quoteNumber} logoSrc={logoSrc} />
      <PdfPageFooter pscsSrc={pscsSrc} />
      {children}
    </Page>
  )
}

export function QuotePdfDocument({
  quote,
  logo,
  pscs,
}: {
  quote: QuoteDetail
  logo?: PdfLogoSource
  pscs?: PdfLogoSource
}) {
  const logoSrc = logo?.filePath ?? logo?.src ?? null
  const pscsSrc = pscs?.filePath ?? pscs?.src ?? null
  const lang = quote.language ?? 'pt'
  const packageName = getPackageName(quote) ?? '—'
  const packageDescription = getPackageDescription(quote)
  const groupedAdditionals = groupAdditionalsByCategory(
    quote.additional_items ?? [],
    lang,
  )
  const snapshot = readQuoteSnapshot(quote)
  const guestCounts = snapshot.guestCounts
  const chargedMiles = getChargedMilesFromSnapshot(
    snapshot.mileageDistance,
    snapshot.mileageFreeLimit,
  )
  const discount = getDiscount(quote)
  const quoteNumber = quote.quote_number ?? 'CDL-Q-0000'
  const customerName = displayValue(getCustomerDisplayNameFromQuote(quote))
  const eventDateLabel = formatDate(quote.event_date)
  const cityState = [quote.city, quote.state].filter(Boolean).join(', ')
  const eventLocation = [quote.address_line, cityState, getZipCode(quote)]
    .filter(Boolean)
    .join(' · ')
  const mileageBase = displayValue(snapshot.mileageBaseLocation)
  const t = (key: Parameters<typeof tQuotesOrders>[1]) => tQuotesOrders(lang, key)

  const holidaySurcharge = Number(quote.holiday_surcharge_amount ?? 0)
  const grillRentalQty = Number(quote.grill_rental_qty ?? 0)
  const grillRentalStored = Number(quote.grill_rental_total ?? 0)
  const grillRentalTotal =
    grillRentalStored > 0
      ? grillRentalStored
      : calcGrillRentalFee(
          Boolean(quote.grill_rental_required),
          grillRentalQty,
        )
  const minimumAdjustment = quote.minimum_order_applied
    ? Math.max(
        0,
        Number(snapshot.quoteTotal ?? 0) -
          Number(snapshot.packageTotal ?? 0) -
          Number(snapshot.additionalTotal ?? 0) -
          Number(snapshot.mileageFee ?? 0) -
          grillRentalTotal -
          holidaySurcharge,
      )
    : 0
  const minimumOrderAmount = Number(quote.minimum_order_amount ?? 0)

  const pricingLines = [
    { label: t('packageLabel'), value: formatMoneyOrDash(snapshot.packageTotal) },
    {
      label: t('additionalsLabel'),
      value: formatMoneyOrDash(snapshot.additionalTotal),
    },
    { label: t('mileageLabel'), value: formatMoneyOrDash(snapshot.mileageFee) },
    ...(grillRentalTotal > 0
      ? [
          {
            label:
              grillRentalQty > 1
                ? t('docGrillRentalLineQty').replace(
                    '{qty}',
                    String(grillRentalQty),
                  )
                : t('docGrillRentalLine'),
            value: formatCurrency(grillRentalTotal),
          },
        ]
      : []),
    ...(holidaySurcharge > 0
      ? [
          {
            label: t('docHolidaySurchargeLine'),
            value: formatCurrency(holidaySurcharge),
          },
        ]
      : []),
    ...(minimumAdjustment > 0.009
      ? [
          {
            label: tQuotesOrders(lang, 'minOrderAppliedWithMin', {
              label: t('docMinOrderAppliedLine'),
              min: formatCurrency(minimumOrderAmount),
            }),
            value: formatCurrency(minimumAdjustment),
          },
        ]
      : []),
    ...(discount > 0
      ? [
          {
            label: t('docDiscountLine'),
            value: formatCurrency(discount),
            discount: true,
          },
        ]
      : []),
    {
      label: t('reservationLabel'),
      value: formatMoneyOrDash(snapshot.reservationAmount),
    },
    {
      label: t('docBalanceDueLine'),
      value: formatMoneyOrDash(snapshot.balanceDue),
      highlight: true,
    },
  ]

  return (
    <Document
      title={`${quoteNumber} — BBQ At Home Proposal`}
      author="BBQ AT HOME"
      subject="Catering Quote Proposal"
      creator="CDL Catering AI Platform"
      producer="CDL Catering AI Platform"
    >
      <Page size="A4" style={styles.coverPage}>
        <PdfLogoMark logoSrc={logoSrc} variant="cover" />
        <View style={styles.coverAccentBar} />
        <Text style={styles.coverBrand}>BBQ AT HOME</Text>
        <Text style={styles.coverTagline}>
          Premium Brazilian BBQ Experience
        </Text>
        <View style={styles.coverDivider} />
        <Text style={styles.coverLabel}>{t('docPreparedFor')}</Text>
        <Text style={styles.coverClient}>{customerName}</Text>
        <View style={styles.coverMetaGrid}>
          <View style={styles.coverMetaBlock}>
            <Text style={styles.coverLabel}>{t('docEventDateLabel')}</Text>
            <Text style={styles.coverMetaValue}>{eventDateLabel}</Text>
          </View>
          <View style={styles.coverMetaBlock}>
            <Text style={styles.coverLabel}>{t('docQuoteNumberLabel')}</Text>
            <Text style={styles.coverMetaValue}>{quoteNumber}</Text>
          </View>
        </View>
        <View style={styles.coverInvestmentBox}>
          <Text style={styles.coverInvestmentLabel}>{t('docTotalInvestment')}</Text>
          <Text style={styles.coverInvestmentValue}>
            {formatMoneyOrDash(snapshot.quoteTotal)}
          </Text>
        </View>
      </Page>

      <PdfDocumentPage quoteNumber={quoteNumber} logoSrc={logoSrc} pscsSrc={pscsSrc}>
        <View wrap={false} style={styles.overview}>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>{t('docCustomer')}</Text>
            <Text style={styles.overviewValue}>{customerName}</Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>{t('docEventSection')}</Text>
            <Text style={styles.overviewValue}>{eventDateLabel}</Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>{t('docLocation')}</Text>
            <Text style={styles.overviewValue}>
              {displayValue(cityState || quote.city)}
            </Text>
          </View>
          <View style={[styles.overviewItem, styles.overviewTotal]}>
            <Text style={styles.overviewTotalLabel}>{t('docInvestment')}</Text>
            <Text style={styles.overviewTotalValue}>
              {formatMoneyOrDash(snapshot.quoteTotal)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('docPackageSection')}</Text>
          <Text style={styles.packageName}>{packageName}</Text>
          {packageDescription ? (
            <Text style={styles.packageDesc}>{packageDescription}</Text>
          ) : null}
          <View style={styles.grid2}>
            <InfoCell label={t('docAdults')} value={String(guestCounts.adultCount)} />
            <InfoCell
              label={t('docChildrenUnder3')}
              value={String(guestCounts.childrenUnder3Count)}
            />
            <InfoCell
              label={t('docChildren4to12')}
              value={String(guestCounts.children4To12Count)}
            />
            <InfoCell
              label={t('docPhysicalGuests')}
              value={formatCountOrDash(snapshot.physicalGuestCount)}
            />
            <InfoCell
              label={t('docBillableGuests')}
              value={formatCountOrDash(snapshot.billableGuestCount)}
            />
            <InfoCell
              label={t('docPackageValue')}
              value={formatMoneyOrDash(snapshot.packageTotal)}
            />
          </View>
          {snapshot.packageUnitPrice != null &&
          snapshot.billableGuestCount != null &&
          snapshot.billableGuestCount > 0 ? (
            <Text style={styles.packageDesc}>
              {formatCurrency(snapshot.packageUnitPrice)} ×{' '}
              {snapshot.billableGuestCount}{' '}
              {t('docBillableGuestsSuffix')}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('docEventSection')}</Text>
          <Text style={styles.packageName}>
            {displayValue(quote.event_name ?? getCustomerDisplayNameFromQuote(quote))}
          </Text>
          <View style={styles.grid2}>
            <InfoCell label={t('docDateLabel')} value={eventDateLabel} />
            <InfoCell
              label={t('docTimeLabel')}
              value={`${formatTime(quote.start_time)} – ${formatTime(quote.end_time)}`}
            />
            <InfoCell label={t('docLocation')} value={eventLocation || '—'} wide />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('docGrillSection')}</Text>
          <View style={styles.grid2}>
            <InfoCell
              label={t('docHasGrill')}
              value={formatBool(quote.has_grill)}
            />
            <InfoCell
              label={t('docGrillPhoto')}
              value={getGrillPhotoDetailLabel({
                hasGrill: quote.has_grill,
                grillPhotoRequired: quote.grill_photo_required,
                grillPhotoUrl: quote.grill_photo_url,
                grillPhotoMediaId: quote.grill_photo_media_id,
              })}
            />
            <InfoCell
              label={t('docGrillRentalRequired')}
              value={formatBool(quote.grill_rental_required)}
            />
            <InfoCell
              label={t('docGrillRentalQty')}
              value={
                quote.grill_rental_required
                  ? displayValue(quote.grill_rental_qty)
                  : '—'
              }
            />
            <InfoCell
              label={t('docGrillMasters')}
              value={displayValue(quote.grill_masters_qty)}
            />
            <InfoCell
              label={t('docAssistants')}
              value={displayValue(quote.assistants_qty)}
            />
            {quote.grill_notes ? (
              <InfoCell label={t('docGrillNotes')} value={quote.grill_notes} wide />
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('docMileageSection')}</Text>
          <View style={styles.grid2}>
            <InfoCell label={t('docMileageBase')} value={mileageBase} />
            <InfoCell
              label={t('docMileageDistance')}
              value={
                snapshot.mileageDistance != null
                  ? `${snapshot.mileageDistance} mi`
                  : '—'
              }
            />
            <InfoCell
              label={t('docMileageIncluded')}
              value={
                snapshot.mileageFreeLimit != null
                  ? `${snapshot.mileageFreeLimit} mi`
                  : '—'
              }
            />
            <InfoCell
              label={t('docMileageCharged')}
              value={
                chargedMiles != null ? `${chargedMiles} mi` : '—'
              }
            />
            <InfoCell
              label={t('docMileageRate')}
              value={
                snapshot.mileageRate != null
                  ? `${formatCurrency(snapshot.mileageRate)}/mi`
                  : '—'
              }
            />
            <InfoCell
              label={t('docMileageFeeLabel')}
              value={formatMoneyOrDash(snapshot.mileageFee)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('docAdditionalsSection')}</Text>
          {groupedAdditionals.length === 0 ? (
            <Text style={styles.muted}>{t('docNoAdditionalsSelected')}</Text>
          ) : (
            groupedAdditionals.map(({ category, items }) => (
              <View key={category}>
                <Text style={styles.categoryTitle}>{category}</Text>
                {items.map((item) => (
                  <View key={item.item_id} style={styles.additionalRow}>
                    <Text style={styles.additionalName}>
                      {getAdditionalLabel(item, lang)}
                    </Text>
                    <Text style={styles.additionalMeta}>
                      {t('docQtyLabel')} {displayValue(item.quantity)} ·{' '}
                      {formatCurrency(item.unit_price)}{t('docPerUnitSuffix')} ·{' '}
                      {formatCurrency(item.total_price)}
                    </Text>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>

        <View wrap={false} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('docFinancialSection')}</Text>
          <View style={styles.pricingCard}>
            {pricingLines.map((line) => (
              <View
                key={line.label}
                style={[
                  styles.pricingRow,
                  ...(line.highlight ? [styles.pricingRowHighlight] : []),
                ]}
              >
                <Text style={styles.pricingRowLabel}>{line.label}</Text>
                <Text
                  style={
                    'discount' in line && line.discount
                      ? styles.pricingRowDiscountValue
                      : styles.pricingRowValue
                  }
                >
                  {line.value}
                </Text>
              </View>
            ))}
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>{t('docQuoteTotalLine')}</Text>
              <Text style={styles.totalValue}>
                {formatMoneyOrDash(snapshot.quoteTotal)}
              </Text>
            </View>
            <Text style={styles.reservationNote}>{RESERVATION_PAYMENT_TEXT}</Text>
            <Text style={styles.reservationNote}>
              {t('reservationLabel')}: {RESERVATION_PERCENTAGE}% ·{' '}
              {t('docBalanceDueLine')}: {BALANCE_PERCENTAGE}%
            </Text>
          </View>
        </View>
      </PdfDocumentPage>

      <PdfDocumentPage quoteNumber={quoteNumber} logoSrc={logoSrc} pscsSrc={pscsSrc}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('docRulesSectionTitle')}</Text>
          <RulesBlock title={t('docMinOrderRuleTitle')} items={IMPORTANT_RULES.minimumOrder} />
          <RulesBlock title={t('docMileageSection')} items={IMPORTANT_RULES.mileage} />
          <RulesBlock title={t('reservationLabel')} items={IMPORTANT_RULES.reservation} />
          <RulesBlock title={t('docFoodPolicyRuleTitle')} items={IMPORTANT_RULES.foodPolicy} />
          <RulesBlock title={t('docLatePaymentRuleTitle')} items={IMPORTANT_RULES.latePayment} />
          <RulesBlock
            title={t('docDecJanRuleTitle')}
            items={IMPORTANT_RULES.decemberJanuary}
          />
          <RulesBlock
            title={t('docCancellationPolicyRuleTitle')}
            items={CANCELLATION_POLICY_SUMMARY}
          />
        </View>
      </PdfDocumentPage>
    </Document>
  )
}

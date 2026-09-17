import React from 'react'
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { PdfLogoSource } from '@/Lib/cdlLogo'
import { tEventFinancialCloseout } from '@/Lib/i18n/eventFinancialCloseout'
import { invoiceStatusLabel, tPayments } from '@/Lib/i18n/payments'
import { INVOICE_LOGO_PDF } from '@/Lib/payments/invoiceBrand'
import { buildInvoiceFinancialPresentation } from '@/Lib/payments/invoiceFinancialPresentation'
import type { InvoiceRecord } from '@/Lib/payments/types'

const colors = {
  dark: '#111111',
  muted: '#6B6560',
  border: '#E8E2D9',
  light: '#FAF7F2',
  accent: '#D62828',
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: colors.dark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
    paddingBottom: 12,
  },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  muted: { color: colors.muted, marginTop: 3 },
  section: { marginTop: 14 },
  heading: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  box: {
    backgroundColor: colors.light,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 10,
    marginTop: 8,
  },
  notice: {
    backgroundColor: '#FFF7E6',
    borderColor: '#E7C77A',
    borderWidth: 1,
    padding: 9,
    marginTop: 10,
  },
  total: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
})

function money(value: number, currency = 'USD') {
  return `${currency} ${Number(value || 0).toFixed(2)}`
}

export function InvoicePdfDocument({
  invoice,
  logo,
}: {
  invoice: InvoiceRecord
  logo?: PdfLogoSource | null
}) {
  const snap = invoice.snapshot
  const lang = invoice.locale
  const adjustment = snap.adjustment
  const presentation = buildInvoiceFinancialPresentation({
    snapshot: snap,
    invoiceKind: invoice.invoice_kind,
    subtotal: invoice.subtotal,
    total: invoice.total,
    depositAmount: invoice.deposit_amount,
    balanceAmount: invoice.balance_amount,
    paidTotal: invoice.paid_total,
    currency: invoice.currency_code,
  })

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            {logo?.filePath || logo?.src ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image
                src={logo.filePath || logo.src || ''}
                style={{
                  width: INVOICE_LOGO_PDF.width,
                  height: INVOICE_LOGO_PDF.height,
                  objectFit: 'contain',
                }}
              />
            ) : (
              <Text style={styles.title}>
                {tPayments(lang, 'invoiceTitle')}
              </Text>
            )}
          </View>
          <View>
            <Text style={styles.title}>
              {tPayments(lang, 'invoiceNumber', { number: invoice.invoice_number })}
            </Text>
            <Text style={styles.muted}>
              {tPayments(lang, 'sourceQuote')}: {snap.quote.number || '—'}
            </Text>
            <Text style={styles.muted}>
              {tPayments(lang, 'paymentStatus')}: {invoiceStatusLabel(invoice.status, lang)}
            </Text>
            {invoice.created_at ? (
              <Text style={styles.muted}>
                {tPayments(lang, 'issuedAt')}: {String(invoice.created_at).slice(0, 10)}
              </Text>
            ) : null}
            {adjustment ? (
              <Text style={styles.muted}>{tEventFinancialCloseout(lang, 'supplementalInvoice')}</Text>
            ) : null}
          </View>
        </View>

        {adjustment ? (
          <View style={styles.notice}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>
              {tEventFinancialCloseout(lang, 'supplementalInvoice')}
            </Text>
            <Text style={styles.muted}>
              {tEventFinancialCloseout(lang, 'originalInvoice')}: {adjustment.originalInvoiceNumber} · OS {adjustment.serviceOrderNumber}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.heading}>{snap.customer.name}</Text>
          <Text>{snap.customer.email || snap.customer.phone || '—'}</Text>
          <Text style={styles.muted}>
            {[snap.event.date, snap.event.address].filter(Boolean).join(' · ') || '—'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>{tPayments(lang, 'sectionPackage')}</Text>
          <Text>{presentation.packageName || snap.package.key}</Text>
          <Text>
            {tPayments(lang, 'adults')}: {presentation.guests.adults} ·{' '}
            {tPayments(lang, 'children4To12')}: {presentation.guests.children4To12} ·{' '}
            {tPayments(lang, 'childrenUnder3')}: {presentation.guests.childrenUnder3}
          </Text>
          <Text style={styles.muted}>
            {tPayments(lang, 'billableGuests')}: {presentation.guests.billableGuestCount} ·{' '}
            {tPayments(lang, 'physicalGuests')}: {presentation.guests.physicalGuestCount}
          </Text>
          <Text style={styles.muted}>
            {tPayments(lang, 'eventDate')}: {snap.event.date || '—'}
          </Text>
          {snap.event.startTime || snap.event.endTime ? (
            <Text style={styles.muted}>
              {tPayments(lang, 'eventTime')}: {[snap.event.startTime, snap.event.endTime].filter(Boolean).join(' – ')}
            </Text>
          ) : null}
          {snap.event.name ? (
            <Text style={styles.muted}>
              {tPayments(lang, 'event')}: {snap.event.name}
            </Text>
          ) : null}
          <Text style={styles.muted}>
            {tPayments(lang, 'eventAddress')}: {snap.event.address || '—'}
          </Text>
        </View>

        <View style={styles.box}>
          {presentation.chargeRows
            .filter((row) => row.amount != null)
            .map((row, index, rows) => {
              const prev = rows[index - 1]
              const sectionTitle =
                row.kind === 'package' && prev?.kind !== 'package'
                  ? tPayments(lang, 'sectionPackage')
                  : row.kind === 'garnish' && prev?.kind !== 'garnish'
                    ? tPayments(lang, 'sectionSides')
                    : row.kind === 'additional' && prev?.kind !== 'additional'
                      ? tPayments(lang, 'sectionAddons')
                      : null
              return (
                <View key={row.id}>
                  {sectionTitle ? (
                    <Text style={[styles.heading, { marginTop: 6 }]}>{sectionTitle}</Text>
                  ) : null}
                  <View style={styles.row}>
                    <Text>
                      {row.labelText || tPayments(lang, row.labelKey as Parameters<typeof tPayments>[1])}
                      {row.formula ? ` (${row.formula})` : ''}
                      {row.included ? ` — ${tPayments(lang, 'included')}` : ''}
                    </Text>
                    <Text>
                      {row.included ? tPayments(lang, 'included') : money(Number(row.amount), invoice.currency_code)}
                    </Text>
                  </View>
                </View>
              )
            })}
          {presentation.mileage.visible ? (
            <View style={[styles.box, { marginTop: 8 }]}>
              <Text style={styles.heading}>{tPayments(lang, 'mileage')}</Text>
              <Text>
                {tPayments(lang, 'mileageDistance')}: {presentation.mileage.distance ?? '—'} mi
              </Text>
              <Text>
                {tPayments(lang, 'mileageIncluded')}:{' '}
                {presentation.mileage.freeLimit == null
                  ? '—'
                  : tPayments(lang, 'mileageCourtesyValue', { n: presentation.mileage.freeLimit })}
              </Text>
              <Text>
                {tPayments(lang, 'mileageChargeable')}: {presentation.mileage.chargeable ?? '—'} mi
              </Text>
              <Text>
                {tPayments(lang, 'mileageRate')}: {money(Number(presentation.mileage.rate), invoice.currency_code)} / mi
              </Text>
              <Text>
                {tPayments(lang, 'mileageTotal')}: {money(presentation.mileage.fee, invoice.currency_code)}
              </Text>
              <Text style={styles.muted}>
                {tPayments(lang, 'mileageCourtesyHelp', {
                  n: presentation.mileage.freeLimit ?? 20,
                })}
              </Text>
              {presentation.mileage.fullTrip ? (
                <Text style={styles.muted}>{tPayments(lang, 'mileageFullTrip')}</Text>
              ) : null}
            </View>
          ) : null}
          {[...presentation.reconcileRows, ...presentation.reservationRows, ...presentation.paidRows, ...presentation.adjustmentRows].map((row) => (
            <View key={row.id} style={styles.row}>
              <Text style={row.emphasize ? styles.total : undefined}>
                {tPayments(lang, row.labelKey as Parameters<typeof tPayments>[1])}
              </Text>
              <Text style={row.emphasize ? styles.total : undefined}>
                {row.amount == null
                  ? row.quantity != null
                    ? String(row.quantity)
                    : '—'
                  : money(row.amount, invoice.currency_code)}
              </Text>
            </View>
          ))}
        </View>
        {adjustment?.notes ? <Text style={[styles.muted, { marginTop: 8 }]}>{adjustment.notes}</Text> : null}
        <Text style={[styles.muted, { marginTop: 10 }]}>{tPayments(lang, 'noTax')}</Text>
      </Page>
    </Document>
  )
}

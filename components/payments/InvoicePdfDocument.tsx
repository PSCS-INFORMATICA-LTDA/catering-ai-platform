import React from 'react'
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { PdfLogoSource } from '@/Lib/cdlLogo'
import { tPayments } from '@/Lib/i18n/payments'
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
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            {logo?.filePath || logo?.src ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image
                src={logo.filePath || logo.src || ''}
                style={{ width: 92, height: 48 }}
              />
            ) : (
              <Text style={styles.title}>CDL BBQ AT HOME</Text>
            )}
            <Text style={styles.muted}>Orlando, Florida</Text>
          </View>
          <View>
            <Text style={styles.title}>
              {tPayments(lang, 'invoiceNumber', { number: invoice.invoice_number })}
            </Text>
            <Text style={styles.muted}>
              {tPayments(lang, 'paymentStatus')}: {invoice.status}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>{snap.customer.name}</Text>
          <Text>{snap.customer.email || snap.customer.phone || '—'}</Text>
          <Text style={styles.muted}>
            {snap.event.date} · {snap.event.address}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>{snap.package.name || snap.package.key}</Text>
          <Text>
            {tPayments(lang, 'guests')}: {snap.guests.adults} {tPayments(lang, 'adults')} /{' '}
            {snap.guests.childrenUnder3 + snap.guests.children4To12}{' '}
            {tPayments(lang, 'children')}
          </Text>
          <Text style={styles.muted}>
            {tPayments(lang, 'eventDate')}: {snap.event.date || '—'}
          </Text>
          <Text style={styles.muted}>
            {tPayments(lang, 'eventAddress')}: {snap.event.address || '—'}
          </Text>
        </View>

        <View style={styles.box}>
          <View style={styles.row}>
            <Text>{tPayments(lang, 'packageLine')}</Text>
            <Text>{money(snap.package.total || 0, invoice.currency_code)}</Text>
          </View>
          {snap.garnishes?.included ? (
            <View style={styles.row}>
              <Text>
                {tPayments(lang, 'garnishes')}
                {snap.garnishes.description ? ` — ${snap.garnishes.description}` : ''}
              </Text>
              <Text>{money(snap.garnishes.total, invoice.currency_code)}</Text>
            </View>
          ) : null}
          {snap.additionals.map((line) => (
            <View key={line.itemId} style={styles.row}>
              <Text>
                {line.label} × {line.quantity}
              </Text>
              <Text>{money(line.total, invoice.currency_code)}</Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text>{tPayments(lang, 'mileage')}</Text>
            <Text>{money(snap.mileage.fee || 0, invoice.currency_code)}</Text>
          </View>
          <View style={styles.row}>
            <Text>{tPayments(lang, 'grill')}</Text>
            <Text>{money(snap.grill.total, invoice.currency_code)}</Text>
          </View>
          {snap.commercial.discount > 0 ? (
            <View style={styles.row}>
              <Text>{tPayments(lang, 'discount')}</Text>
              <Text>-{money(snap.commercial.discount, invoice.currency_code)}</Text>
            </View>
          ) : null}
          {snap.commercial.holidaySurcharge > 0 ? (
            <View style={styles.row}>
              <Text>{tPayments(lang, 'seasonalSurcharge')}</Text>
              <Text>{money(snap.commercial.holidaySurcharge, invoice.currency_code)}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text>{tPayments(lang, 'subtotal')}</Text>
            <Text>{money(invoice.subtotal, invoice.currency_code)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.total}>{tPayments(lang, 'total')}</Text>
            <Text style={styles.total}>{money(invoice.total, invoice.currency_code)}</Text>
          </View>
          <View style={styles.row}>
            <Text>{tPayments(lang, 'deposit')}</Text>
            <Text>{money(invoice.deposit_amount, invoice.currency_code)}</Text>
          </View>
          <View style={styles.row}>
            <Text>{tPayments(lang, 'balance')}</Text>
            <Text>{money(invoice.balance_amount, invoice.currency_code)}</Text>
          </View>
          <View style={styles.row}>
            <Text>{tPayments(lang, 'paid')}</Text>
            <Text>{money(invoice.paid_total, invoice.currency_code)}</Text>
          </View>
        </View>
        <Text style={[styles.muted, { marginTop: 10 }]}>{tPayments(lang, 'noTax')}</Text>
      </Page>
    </Document>
  )
}

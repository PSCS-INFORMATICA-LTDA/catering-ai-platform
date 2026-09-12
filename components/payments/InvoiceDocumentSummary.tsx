'use client'

import Link from 'next/link'
import { toBcp47Locale } from '@/Lib/i18n/locales'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type { InvoiceBackofficeDetail } from '@/Lib/payments/fetchInvoiceBackoffice'

type Copy = {
  document: string
  items: string
  description: string
  quantity: string
  unitPrice: string
  total: string
  package: string
  garnishes: string
  grill: string
  mileage: string
  holiday: string
  discount: string
  subtotal: string
  paid: string
  outstanding: string
  deposit: string
  balance: string
  quote: string
  serviceOrder: string
  customer: string
  event: string
  eventDate: string
  empty: string
  original: string
  adjustment: string
}

const COPY: Record<'pt' | 'en' | 'es', Copy> = {
  pt: {
    document: 'Documento da fatura',
    items: 'Itens da fatura',
    description: 'Descrição',
    quantity: 'Qtd.',
    unitPrice: 'Preço unitário',
    total: 'Total',
    package: 'Pacote',
    garnishes: 'Acompanhamentos',
    grill: 'Locação de churrasqueira',
    mileage: 'Deslocamento',
    holiday: 'Adicional de feriado',
    discount: 'Desconto',
    subtotal: 'Subtotal',
    paid: 'Recebido',
    outstanding: 'Em aberto',
    deposit: 'Reserva / sinal',
    balance: 'Saldo contratual',
    quote: 'Cotação',
    serviceOrder: 'OS',
    customer: 'Cliente',
    event: 'Evento',
    eventDate: 'Data',
    empty: 'Esta fatura não possui linhas comerciais no snapshot.',
    original: 'Fatura original',
    adjustment: 'Ajuste pós-evento',
  },
  en: {
    document: 'Invoice document',
    items: 'Invoice items',
    description: 'Description',
    quantity: 'Qty.',
    unitPrice: 'Unit price',
    total: 'Total',
    package: 'Package',
    garnishes: 'Sides',
    grill: 'Grill rental',
    mileage: 'Mileage',
    holiday: 'Holiday surcharge',
    discount: 'Discount',
    subtotal: 'Subtotal',
    paid: 'Received',
    outstanding: 'Outstanding',
    deposit: 'Reservation / deposit',
    balance: 'Contract balance',
    quote: 'Quote',
    serviceOrder: 'Service order',
    customer: 'Customer',
    event: 'Event',
    eventDate: 'Date',
    empty: 'This invoice has no commercial lines in its snapshot.',
    original: 'Original invoice',
    adjustment: 'Post-event adjustment',
  },
  es: {
    document: 'Documento de la factura',
    items: 'Ítems de la factura',
    description: 'Descripción',
    quantity: 'Cant.',
    unitPrice: 'Precio unitario',
    total: 'Total',
    package: 'Paquete',
    garnishes: 'Acompañamientos',
    grill: 'Alquiler de parrilla',
    mileage: 'Desplazamiento',
    holiday: 'Recargo de feriado',
    discount: 'Descuento',
    subtotal: 'Subtotal',
    paid: 'Recibido',
    outstanding: 'Pendiente',
    deposit: 'Reserva / señal',
    balance: 'Saldo contractual',
    quote: 'Presupuesto',
    serviceOrder: 'OS',
    customer: 'Cliente',
    event: 'Evento',
    eventDate: 'Fecha',
    empty: 'Esta factura no tiene líneas comerciales en el snapshot.',
    original: 'Factura original',
    adjustment: 'Ajuste post-evento',
  },
}

type InvoiceLine = {
  key: string
  label: string
  quantity: number | null
  unitPrice: number | null
  total: number
}

function money(value: number, currency: string, locale: string | null | undefined) {
  try {
    return new Intl.NumberFormat(toBcp47Locale(locale), {
      style: 'currency',
      currency: currency || 'USD',
    }).format(Number(value || 0))
  } catch {
    return `${currency || 'USD'} ${Number(value || 0).toFixed(2)}`
  }
}

function dateLabel(value: string | null | undefined, locale: string | null | undefined) {
  if (!value) return '—'
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(toBcp47Locale(locale), { dateStyle: 'medium' }).format(parsed)
}

export default function InvoiceDocumentSummary({ invoice }: { invoice: InvoiceBackofficeDetail }) {
  const locale = useAuthLocaleFromMe()
  const language = locale === 'en' || locale === 'es' ? locale : 'pt'
  const copy = COPY[language]
  const snapshot = invoice.snapshot

  const lines: InvoiceLine[] = []
  if (snapshot?.package?.name && Number(snapshot.package.total || 0) !== 0) {
    lines.push({
      key: 'package',
      label: `${copy.package}: ${snapshot.package.name}`,
      quantity: Number(snapshot.guests?.billableGuestCount || 0) || null,
      unitPrice: snapshot.package.unitPrice == null ? null : Number(snapshot.package.unitPrice),
      total: Number(snapshot.package.total || 0),
    })
  }
  for (const item of snapshot?.additionals ?? []) {
    lines.push({
      key: `additional-${item.itemId}-${item.sourceRef ?? item.label}`,
      label: item.label,
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      total: Number(item.total || 0),
    })
  }
  if (snapshot?.garnishes?.included && Number(snapshot.garnishes.total || 0) !== 0) {
    lines.push({
      key: 'garnishes',
      label: snapshot.garnishes.description || copy.garnishes,
      quantity: 1,
      unitPrice: Number(snapshot.garnishes.total || 0),
      total: Number(snapshot.garnishes.total || 0),
    })
  }
  if (snapshot?.grill?.required && Number(snapshot.grill.total || 0) !== 0) {
    const quantity = Math.max(1, Number(snapshot.grill.quantity || 1))
    lines.push({
      key: 'grill',
      label: copy.grill,
      quantity,
      unitPrice: Number(snapshot.grill.total || 0) / quantity,
      total: Number(snapshot.grill.total || 0),
    })
  }
  if (Number(snapshot?.mileage?.fee || 0) !== 0) {
    lines.push({
      key: 'mileage',
      label: copy.mileage,
      quantity: snapshot?.mileage?.distance == null ? null : Number(snapshot.mileage.distance),
      unitPrice: snapshot?.mileage?.rate == null ? null : Number(snapshot.mileage.rate),
      total: Number(snapshot?.mileage?.fee || 0),
    })
  }
  if (Number(snapshot?.commercial?.holidaySurcharge || 0) !== 0) {
    lines.push({
      key: 'holiday',
      label: copy.holiday,
      quantity: 1,
      unitPrice: Number(snapshot?.commercial?.holidaySurcharge || 0),
      total: Number(snapshot?.commercial?.holidaySurcharge || 0),
    })
  }
  if (Number(snapshot?.commercial?.discount || 0) !== 0) {
    lines.push({
      key: 'discount',
      label: copy.discount,
      quantity: 1,
      unitPrice: -Math.abs(Number(snapshot?.commercial?.discount || 0)),
      total: -Math.abs(Number(snapshot?.commercial?.discount || 0)),
    })
  }

  return (
    <section className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm" data-invoice-document>
      <div className="border-b border-neutral-200 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">{copy.document}</p>
            <h1 className="mt-1 text-2xl font-black text-neutral-950">{invoice.invoice_number}</h1>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
              {invoice.invoice_kind === 'post_event_adjustment' ? copy.adjustment : copy.original}
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-[32rem]">
            <Meta label={copy.customer} value={snapshot?.customer?.name || invoice.customer_name || '—'} />
            <Meta label={copy.event} value={snapshot?.event?.name || invoice.event_name || '—'} />
            <Meta label={copy.eventDate} value={dateLabel(snapshot?.event?.date || invoice.event_date, locale)} />
            <div className="rounded-xl bg-neutral-50 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{copy.quote} / {copy.serviceOrder}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-bold text-neutral-900">
                <Link href={`/quotes/${invoice.quote_id}`} className="text-[var(--brand-primary-2)] hover:underline">
                  {invoice.quote_number || copy.quote}
                </Link>
                {invoice.service_order_id ? (
                  <Link href={`/orders/${invoice.service_order_id}`} className="text-[var(--brand-primary-2)] hover:underline">
                    {copy.serviceOrder}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5">
        <h2 className="text-sm font-black uppercase tracking-wider text-neutral-800">{copy.items}</h2>
        {lines.length === 0 ? (
          <p className="mt-3 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-500">{copy.empty}</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full min-w-[42rem] border-collapse text-sm">
              <thead className="bg-neutral-50 text-left text-[10px] font-black uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3">{copy.description}</th>
                  <th className="px-4 py-3 text-right">{copy.quantity}</th>
                  <th className="px-4 py-3 text-right">{copy.unitPrice}</th>
                  <th className="px-4 py-3 text-right">{copy.total}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {lines.map((line) => (
                  <tr key={line.key}>
                    <td className="px-4 py-3 font-semibold text-neutral-900">{line.label}</td>
                    <td className="px-4 py-3 text-right text-neutral-700">{line.quantity == null ? '—' : line.quantity}</td>
                    <td className="px-4 py-3 text-right text-neutral-700">{line.unitPrice == null ? '—' : money(line.unitPrice, invoice.currency_code, locale)}</td>
                    <td className="px-4 py-3 text-right font-black text-neutral-950">{money(line.total, invoice.currency_code, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Money label={copy.subtotal} value={invoice.subtotal} invoice={invoice} locale={locale} />
          <Money label={copy.total} value={invoice.total} invoice={invoice} locale={locale} strong />
          <Money label={copy.deposit} value={invoice.deposit_amount} invoice={invoice} locale={locale} />
          <Money label={copy.balance} value={invoice.balance_amount} invoice={invoice} locale={locale} />
          <Money label={copy.paid} value={invoice.paid_total} invoice={invoice} locale={locale} />
          <Money label={copy.outstanding} value={invoice.outstanding_amount} invoice={invoice} locale={locale} strong />
        </div>
      </div>
    </section>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 font-bold text-neutral-900">{value}</p>
    </div>
  )
}

function Money({
  label,
  value,
  invoice,
  locale,
  strong = false,
}: {
  label: string
  value: number
  invoice: InvoiceBackofficeDetail
  locale: string | null | undefined
  strong?: boolean
}) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 ${strong ? 'text-lg font-black' : 'font-bold'} text-neutral-950`}>
        {money(value, invoice.currency_code, locale)}
      </p>
    </div>
  )
}

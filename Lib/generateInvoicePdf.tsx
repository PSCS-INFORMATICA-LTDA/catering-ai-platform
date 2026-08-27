import { renderToBuffer } from '@react-pdf/renderer'
import { InvoicePdfDocument } from '@/components/payments/InvoicePdfDocument'
import { resolveCdlLogoForPdf } from '@/Lib/cdlLogoForPdf'
import type { InvoiceRecord } from '@/Lib/payments/types'

export async function generateInvoicePdfBuffer(invoice: InvoiceRecord) {
  const logo = resolveCdlLogoForPdf()
  return renderToBuffer(<InvoicePdfDocument invoice={invoice} logo={logo} />)
}

export function getInvoicePdfResponseHeaders(invoice: InvoiceRecord) {
  return {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
    'Cache-Control': 'no-store, no-transform',
    'X-Content-Type-Options': 'nosniff',
  }
}

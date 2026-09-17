import { renderToBuffer } from '@react-pdf/renderer'
import { InvoicePdfDocument } from '@/components/payments/InvoicePdfDocument'
import { resolveCdlLogoForPdf, resolvePublicImageForPdf } from '@/Lib/cdlLogoForPdf'
import type { InvoiceRecord } from '@/Lib/payments/types'
import {
  resolveCompanyPublicBrand,
  type CompanyPublicBrandInput,
} from '@/Lib/tenant/companyPublicBrand'

function resolveInvoiceLogo(logoUrl: string | null | undefined) {
  const rel = logoUrl?.trim() || ''
  if (rel.startsWith('/')) {
    return resolvePublicImageForPdf(rel.replace(/^\//, ''))
  }
  if (rel === '/cdl/logo.png' || rel.endsWith('/cdl/logo.png')) {
    return resolveCdlLogoForPdf()
  }
  return { filePath: null, src: null }
}

export async function generateInvoicePdfBuffer(
  invoice: InvoiceRecord,
  brandInput: CompanyPublicBrandInput = {},
) {
  const brand = resolveCompanyPublicBrand(brandInput)
  const logo = resolveInvoiceLogo(brand.logoUrl)
  return renderToBuffer(
    <InvoicePdfDocument
      invoice={invoice}
      logo={logo}
      brand={{ displayName: brand.displayName, location: brand.location }}
    />,
  )
}

export function getInvoicePdfResponseHeaders(invoice: InvoiceRecord) {
  return {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
    'Cache-Control': 'no-store, no-transform',
    'X-Content-Type-Options': 'nosniff',
  }
}

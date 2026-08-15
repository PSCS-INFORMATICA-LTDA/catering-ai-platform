import { renderToBuffer } from '@react-pdf/renderer'
import { QuotePdfDocument } from '@/app/quotes/[id]/QuotePdfDocument'
import type { QuoteDetail } from '@/app/quotes/[id]/quoteDetailTypes'
import {
  resolveCdlLogoForPdf,
  resolvePublicImageForPdf,
} from '@/Lib/cdlLogoForPdf'
import { getQuotePdfContentDisposition } from '@/Lib/quotePdfFilename'

export async function generateQuotePdfBuffer(quote: QuoteDetail) {
  const logo = resolveCdlLogoForPdf()
  const pscs = resolvePublicImageForPdf('brand/pscs-one.png')
  return renderToBuffer(
    <QuotePdfDocument quote={quote} logo={logo} pscs={pscs} />,
  )
}

export function getQuotePdfResponseHeaders(quote: QuoteDetail) {
  return {
    'Content-Type': 'application/pdf',
    'Content-Disposition': getQuotePdfContentDisposition(quote),
    'Cache-Control': 'no-store, no-transform',
    'X-Content-Type-Options': 'nosniff',
  }
}

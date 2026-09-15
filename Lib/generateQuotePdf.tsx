import { renderToBuffer } from '@react-pdf/renderer'
import { QuotePdfDocument } from '@/app/quotes/[id]/QuotePdfDocument'
import type { QuoteDetail } from '@/app/quotes/[id]/quoteDetailTypes'
import { omitInternalNotes } from '@/Lib/commercialReview/internalNotes'
import {
  resolveCdlLogoForPdf,
  resolvePublicImageForPdf,
} from '@/Lib/cdlLogoForPdf'
import { resolveRemoteImageForPdf } from '@/Lib/packageImageForPdf'
import { getQuotePdfContentDisposition } from '@/Lib/quotePdfFilename'

export async function generateQuotePdfBuffer(quote: QuoteDetail) {
  const publicQuote = omitInternalNotes(quote as QuoteDetail & Record<string, unknown>) as QuoteDetail
  const logo = resolveCdlLogoForPdf()
  const pscs = resolvePublicImageForPdf('brand/pscs-one.png')
  const packageImageSrc = await resolveRemoteImageForPdf(publicQuote.package_image_url)
  return renderToBuffer(
    <QuotePdfDocument
      quote={publicQuote}
      logo={logo}
      pscs={pscs}
      packageImageSrc={packageImageSrc}
    />,
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

import CommercialReviewWorkspace from '@/components/commercial-review/CommercialReviewWorkspace'
import type { CommercialReviewExtras } from '@/Lib/commercialReview/loadWorkspaceExtras'
import type { QuoteDetail } from './quoteDetailTypes'

const EMPTY_EXTRAS: CommercialReviewExtras = {
  currentVersion: null,
  sharedVersionId: null,
  sharedBy: null,
  capacity: {
    state: 'unknown',
    capacity: 1,
    reservedCount: 0,
    thisQuoteReserved: false,
    hasEventWindow: false,
  },
  history: [],
}

/** Compatibility wrapper. The quote detail route now renders Commercial Review. */
export default function QuoteDetailView({
  quote,
  extras = EMPTY_EXTRAS,
  canConvert = false,
  canManageInvoice = false,
  canManageCoupons = false,
  canManageNotes = false,
  uiLocale,
}: {
  quote: QuoteDetail
  extras?: CommercialReviewExtras
  canConvert?: boolean
  canManageInvoice?: boolean
  canManageCoupons?: boolean
  canManageNotes?: boolean
  uiLocale?: string | null
}) {
  return (
    <CommercialReviewWorkspace
      quote={quote}
      extras={extras}
      canConvert={canConvert}
      canManageInvoice={canManageInvoice}
      canManageCoupons={canManageCoupons}
      canManageNotes={canManageNotes}
      uiLocale={uiLocale}
    />
  )
}

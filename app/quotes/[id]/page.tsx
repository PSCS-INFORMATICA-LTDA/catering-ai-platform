import { fetchQuoteDetail } from '../../../Lib/fetchQuoteDetail'
import CommercialReviewWorkspace from '@/components/commercial-review/CommercialReviewWorkspace'
import type { QuoteDetail } from './quoteDetailTypes'
import { getAuthSession } from '@/Lib/auth/session'
import { hasPermission } from '@/Lib/auth/permissions'
import { resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { resolveAuthLocale } from '@/Lib/i18n/authUsers'
import { logDevServerTiming } from '@/Lib/observability/serverTiming'
import { tw } from '@/Lib/quoteTranslations'
import { loadCommercialReviewExtras } from '@/Lib/commercialReview/loadWorkspaceExtras'
import { readContractLifecycle } from '@/Lib/payments/paidContractAdvance'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const started = Date.now()

  const session = await getAuthSession()
  const authMs = Date.now() - started
  const uiLocale = resolveAuthLocale(session?.appUser?.preferred_language)
  const companyId = session ? resolveAuthorizedCompanyId(session) : undefined
  const dbStarted = Date.now()
  const { data, error } = await fetchQuoteDetail(id, uiLocale, { companyId })
  logDevServerTiming(`/quotes/${id}`, {
    authMs,
    quoteDbMs: Date.now() - dbStarted,
    renderMs: Date.now() - started,
  })

  if (error) {
    const locale = resolveAuthLocale(session?.appUser?.preferred_language)
    return (
      <main className="min-h-screen bg-cdl-bg p-6 text-cdl-fg sm:p-10">
        <h1 className="text-2xl font-bold text-cdl-title">
          {tw(locale, 'loadQuoteError')}
        </h1>
        <pre className="mt-4 rounded-2xl border border-cdl-border bg-cdl-surface p-4 text-sm text-red-400">
          {error.message}
        </pre>
      </main>
    )
  }

  const extras = companyId
    ? await loadCommercialReviewExtras({ companyId, quote: data as QuoteDetail })
    : {
        currentVersion: null,
        sharedVersionId: null,
        sharedBy: null,
        capacity: {
          state: 'unknown' as const,
          capacity: 1,
          reservedCount: 0,
          thisQuoteReserved: false,
          hasEventWindow: false,
        },
        history: [],
        lifecycle: readContractLifecycle({ proposalAccepted: false }),
      }

  const canConvert = Boolean(
    session?.isPlatformAdmin || hasPermission(session?.permissions, 'quotes.convert'),
  )
  const canManageInvoice = Boolean(
    session?.isPlatformAdmin ||
      (hasPermission(session?.permissions, 'quotes.manage') &&
        hasPermission(session?.permissions, 'finance.invoices.view')),
  )
  const canManageCoupons = Boolean(
    session?.isPlatformAdmin || hasPermission(session?.permissions, 'commercial.coupons.manage'),
  )
  const canManageNotes = Boolean(
    session?.isPlatformAdmin || hasPermission(session?.permissions, 'quotes.manage'),
  )

  return (
    <CommercialReviewWorkspace
      quote={data as QuoteDetail}
      extras={extras}
      canConvert={canConvert}
      canManageInvoice={canManageInvoice}
      canManageCoupons={canManageCoupons}
      canManageNotes={canManageNotes}
      uiLocale={uiLocale}
    />
  )
}

import { fetchQuoteDetail } from '../../../Lib/fetchQuoteDetail'
import QuoteDetailView from './QuoteDetailView'
import type { QuoteDetail } from './quoteDetailTypes'
import { getAuthSession } from '@/Lib/auth/session'
import { hasPermission } from '@/Lib/auth/permissions'
import { resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { resolveAuthLocale } from '@/Lib/i18n/authUsers'
import { logDevServerTiming } from '@/Lib/observability/serverTiming'
import { tw } from '@/Lib/quoteTranslations'

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

  const canConvert = Boolean(
    session?.isPlatformAdmin || hasPermission(session?.permissions, 'quotes.convert'),
  )
  const canManageInvoice = Boolean(
    session?.isPlatformAdmin || hasPermission(session?.permissions, 'quotes.manage'),
  )

  return (
    <QuoteDetailView
      quote={data as QuoteDetail}
      canConvert={canConvert}
      canManageInvoice={canManageInvoice}
      uiLocale={uiLocale}
    />
  )
}

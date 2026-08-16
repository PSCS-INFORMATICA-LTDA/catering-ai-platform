import { fetchQuoteList } from '../../Lib/fetchQuoteList'
import QuotesDashboard from '../../components/QuotesDashboard'
import { getAuthSession } from '@/Lib/auth/session'
import { hasPermission } from '@/Lib/auth/permissions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function QuotesPage() {
  const [{ data, error }, session] = await Promise.all([
    fetchQuoteList(),
    getAuthSession(),
  ])

  if (error) {
    return (
      <main className="min-h-screen bg-cdl-bg p-10 text-cdl-fg">
        <h1 className="text-2xl font-bold text-red-400">Erro</h1>
        <pre className="mt-4 rounded-3xl bg-cdl-surface p-4 text-sm text-red-400">
          {error.message}
        </pre>
      </main>
    )
  }

  const canConvert = Boolean(
    session?.isPlatformAdmin || hasPermission(session?.permissions, 'quotes.convert'),
  )

  return <QuotesDashboard initialQuotes={data ?? []} canConvert={canConvert} />
}
